import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExternalNotification,
  encodeGmailMessage,
  isAllowedWebhookUrl,
  parseNotificationPreferences,
} from '../server/notifications.ts';

test('accepts an explicit opt-in preference document without credentials or content fields', () => {
  const parsed = parseNotificationPreferences({
    enabled: true,
    email: true,
    slack: false,
    discord: false,
    eventTypes: ['summary_ready', 'manual_test'],
    consentVersion: '2026-09-04',
    updatedAt: 1_700_000_000_000,
  });
  assert.equal(parsed?.enabled, true);
  assert.equal(parseNotificationPreferences({ ...parsed, journalText: 'private' }), null);
});

test('rejects invalid consent versions, event types, and timestamps', () => {
  const base = { enabled: true, email: true, slack: false, discord: false, eventTypes: ['summary_ready'], consentVersion: '2026-09-04', updatedAt: 1 };
  assert.equal(parseNotificationPreferences({ ...base, consentVersion: 'old' }), null);
  assert.equal(parseNotificationPreferences({ ...base, eventTypes: ['crisis_detected'] }), null);
  assert.equal(parseNotificationPreferences({ ...base, updatedAt: 1.5 }), null);
});

test('external payload contains only a generic event label and app URL', () => {
  const notification = buildExternalNotification('summary_ready', 'https://example.test/');
  assert.equal(notification.subject, 'Reflective notification');
  assert.match(notification.text, /summary is ready/);
  assert.doesNotMatch(notification.text, /journal|location|coordinate|suicid|uid/i);
});

test('webhook validation allows only HTTPS Slack and Discord webhook hosts and paths', () => {
  assert.equal(isAllowedWebhookUrl('slack', 'https://hooks.slack.com/services/T/B/X'), true);
  assert.equal(isAllowedWebhookUrl('slack', 'https://evil.example/services/T/B/X'), false);
  assert.equal(isAllowedWebhookUrl('discord', 'https://discord.com/api/webhooks/123/token'), true);
  assert.equal(isAllowedWebhookUrl('discord', 'http://discord.com/api/webhooks/123/token'), false);
});

test('Gmail MIME encoding removes injected header newlines', () => {
  const raw = encodeGmailMessage('sender@example.com\r\nBcc: attacker@example.com', 'user@example.com', {
    subject: 'Reflective notification\r\nBcc: attacker@example.com',
    text: 'A minimal event occurred.',
  });
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  assert.doesNotMatch(decoded, /\r\nBcc:/);
  assert.match(decoded, /A minimal event occurred/);
});
