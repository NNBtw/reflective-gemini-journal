import { auth } from './firebase';
import { NotificationEventType } from '../types';

async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  const token = await user.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

export async function dispatchNotification(eventType: NotificationEventType, idempotencyKey: string) {
  const response = await authenticatedFetch('/api/notifications/dispatch', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ eventType }),
  });
  if (!response.ok && response.status !== 409) throw new Error('NOTIFICATION_FAILED');
  return response.json();
}

export async function getAdminOverview() {
  const response = await authenticatedFetch('/api/admin/overview');
  if (!response.ok) throw new Error('ADMIN_OVERVIEW_FAILED');
  return response.json();
}

export async function reviewRoleChange(input: {
  targetUid: string;
  requestedRole: 'user' | 'admin';
  reason: string;
  confirmation: string;
}, idempotencyKey: string) {
  const response = await authenticatedFetch('/api/admin/role-review', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('ROLE_REVIEW_FAILED');
  return response.json();
}

export async function applyRoleChange(input: {
  targetUid: string;
  requestedRole: 'user' | 'admin';
  reason: string;
  confirmation: string;
}, idempotencyKey: string) {
  const response = await authenticatedFetch('/api/admin/roles', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('ROLE_CHANGE_FAILED');
  return response.json();
}
