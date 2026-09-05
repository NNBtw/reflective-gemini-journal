import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_ROLE_REVIEW_INSTRUCTION,
  evaluateRoleChangeSecurity,
  parseRoleChangeRequest,
} from '../server/rbac.ts';

const validRequest = {
  targetUid: 'target-user-123',
  requestedRole: 'admin' as const,
  reason: 'Operational support administrator',
  confirmation: 'GRANT ADMIN',
  idempotencyKey: 'role-change-1234567890',
};

test('allows only a recent, allowlisted owner to grant admin to another user', () => {
  const result = evaluateRoleChangeSecurity(validRequest, {
    actorUid: 'owner-user',
    actorRole: 'owner',
    actorAuthTime: 1_000,
    ownerUids: new Set(['owner-user']),
    nowSeconds: 1_200,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.checks.every((check) => check.passed), true);
});

test('rejects self-promotion, stale authentication, wrong role, or missing owner allowlist', () => {
  const contexts = [
    { actorUid: validRequest.targetUid, actorRole: 'owner' as const, actorAuthTime: 1_000, ownerUids: new Set([validRequest.targetUid]), nowSeconds: 1_100 },
    { actorUid: 'owner-user', actorRole: 'owner' as const, actorAuthTime: 1_000, ownerUids: new Set(['owner-user']), nowSeconds: 1_301 },
    { actorUid: 'admin-user', actorRole: 'admin' as const, actorAuthTime: 1_000, ownerUids: new Set(['admin-user']), nowSeconds: 1_100 },
    { actorUid: 'owner-user', actorRole: 'owner' as const, actorAuthTime: 1_000, ownerUids: new Set<string>(), nowSeconds: 1_100 },
  ];
  for (const context of contexts) assert.equal(evaluateRoleChangeSecurity(validRequest, context).allowed, false);
});

test('requires exact confirmation, bounded reason, target UID, and idempotency key', () => {
  assert.equal(parseRoleChangeRequest({ ...validRequest, confirmation: 'grant admin' }, validRequest.idempotencyKey)?.confirmation, 'grant admin');
  assert.equal(parseRoleChangeRequest({ ...validRequest, reason: 'short' }, validRequest.idempotencyKey), null);
  assert.equal(parseRoleChangeRequest({ ...validRequest, targetUid: '../escape' }, validRequest.idempotencyKey), null);
  assert.equal(parseRoleChangeRequest(validRequest, 'tiny'), null);
});

test('AI policy is advisory and explicitly denies authorization and credential handling', () => {
  assert.match(ADMIN_ROLE_REVIEW_INSTRUCTION, /not an authorization authority/i);
  assert.match(ADMIN_ROLE_REVIEW_INSTRUCTION, /Never approve/i);
  assert.match(ADMIN_ROLE_REVIEW_INSTRUCTION, /credentials/i);
});
