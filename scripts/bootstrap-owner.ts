import { createHash } from 'node:crypto';
import { getAdminAuth, getAdminFirestore } from '../server/firebaseAdmin.ts';
import { parseOwnerUids } from '../server/rbac.ts';

async function main() {
  const targetUid = process.env.BOOTSTRAP_OWNER_UID?.trim() || '';
  const ownerUids = parseOwnerUids(process.env.OWNER_UIDS);
  if (!targetUid || !ownerUids.has(targetUid) || process.env.BOOTSTRAP_OWNER_CONFIRMATION !== 'BOOTSTRAP OWNER') {
    throw new Error('OWNER_BOOTSTRAP_REJECTED');
  }
  const adminAuth = getAdminAuth();
  const target = await adminAuth.getUser(targetUid);
  if (!target.emailVerified) throw new Error('OWNER_EMAIL_UNVERIFIED');

  const auditRef = getAdminFirestore().collection('_adminAudit').doc(
    createHash('sha256').update(`bootstrap-owner:${targetUid}`).digest('hex'),
  );
  if ((await auditRef.get()).exists) throw new Error('OWNER_ALREADY_BOOTSTRAPPED');
  await auditRef.create({ action: 'bootstrap_owner', targetUid, status: 'pending', createdAt: Date.now() });
  try {
    await adminAuth.setCustomUserClaims(targetUid, { ...(target.customClaims || {}), role: 'owner' });
    await auditRef.update({ status: 'applied', completedAt: Date.now() });
    process.stdout.write(JSON.stringify({ status: 'applied', targetUid, role: 'owner', tokenRefreshRequired: true }) + '\n');
  } catch (error) {
    await auditRef.update({ status: 'failed', completedAt: Date.now() });
    throw error;
  }
}

main().catch(() => {
  process.stderr.write('Owner bootstrap failed. Review the server-only audit record.\n');
  process.exitCode = 1;
});
