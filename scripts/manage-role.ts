import { createHash } from 'node:crypto';
import { getAdminAuth, getAdminFirestore } from '../server/firebaseAdmin.ts';
import { evaluateRoleChangeSecurity, parseOwnerUids, parseRoleChangeRequest } from '../server/rbac.ts';

async function main() {
  const actorUid = process.env.ROLE_OPERATOR_UID?.trim() || '';
  const idempotencyKey = process.env.ROLE_CHANGE_IDEMPOTENCY_KEY?.trim() || '';
  const body = {
    targetUid: process.env.ROLE_TARGET_UID,
    requestedRole: process.env.ROLE_REQUESTED_ROLE,
    reason: process.env.ROLE_CHANGE_REASON,
    confirmation: process.env.ROLE_CHANGE_CONFIRMATION,
  };
  const request = parseRoleChangeRequest(body, idempotencyKey);
  const ownerUids = parseOwnerUids(process.env.OWNER_UIDS);
  if (!request || !actorUid || !ownerUids.has(actorUid)) throw new Error('ROLE_COMMAND_REJECTED');
  const evaluation = evaluateRoleChangeSecurity(request, {
    actorUid,
    actorRole: 'owner',
    actorAuthTime: Math.floor(Date.now() / 1000),
    ownerUids,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!evaluation.allowed) throw new Error('ROLE_COMMAND_REJECTED');

  const db = getAdminFirestore();
  const auditId = createHash('sha256').update(`${actorUid}:${idempotencyKey}`).digest('hex');
  const auditRef = db.collection('_adminAudit').doc(auditId);
  if ((await auditRef.get()).exists) throw new Error('DUPLICATE_ROLE_COMMAND');
  await auditRef.create({ action: 'role_change_cli', actorUid, targetUid: request.targetUid, requestedRole: request.requestedRole, reason: request.reason, status: 'pending', checks: evaluation.checks, createdAt: Date.now() });

  try {
    const adminAuth = getAdminAuth();
    const target = await adminAuth.getUser(request.targetUid);
    if (!target.emailVerified || target.customClaims?.role === 'owner') throw new Error('TARGET_NOT_ELIGIBLE');
    await adminAuth.setCustomUserClaims(target.uid, { ...(target.customClaims || {}), role: request.requestedRole });
    await auditRef.update({ status: 'applied', completedAt: Date.now() });
    process.stdout.write(JSON.stringify({ status: 'applied', targetUid: target.uid, role: request.requestedRole, tokenRefreshRequired: true }) + '\n');
  } catch (error) {
    await auditRef.update({ status: 'failed', completedAt: Date.now() });
    throw error;
  }
}

main().catch(() => {
  process.stderr.write('Role command failed. Review the server-only audit record.\n');
  process.exitCode = 1;
});
