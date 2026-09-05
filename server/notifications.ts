export const NOTIFICATION_EVENT_TYPES = ['summary_ready', 'weekly_reminder', 'manual_test'] as const;
export type NotificationEventType = typeof NOTIFICATION_EVENT_TYPES[number];
export type NotificationChannel = 'email' | 'slack' | 'discord';

export interface NotificationPreferences {
  enabled: boolean;
  email: boolean;
  slack: boolean;
  discord: boolean;
  eventTypes: NotificationEventType[];
  consentVersion: '2026-09-04';
  updatedAt: number;
}

export interface ExternalNotification {
  subject: string;
  text: string;
}

export interface DeliveryResult {
  channel: NotificationChannel;
  status: 'sent' | 'disabled' | 'not_configured' | 'failed';
}

export function parseNotificationPreferences(value: unknown): NotificationPreferences | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowedKeys = ['enabled', 'email', 'slack', 'discord', 'eventTypes', 'consentVersion', 'updatedAt'];
  if (Object.keys(input).length !== allowedKeys.length || Object.keys(input).some((key) => !allowedKeys.includes(key))) return null;
  const eventTypes = Array.isArray(input.eventTypes)
    ? input.eventTypes.filter((event): event is NotificationEventType =>
        typeof event === 'string' && NOTIFICATION_EVENT_TYPES.includes(event as NotificationEventType))
    : [];
  if (
    typeof input.enabled !== 'boolean' ||
    typeof input.email !== 'boolean' ||
    typeof input.slack !== 'boolean' ||
    typeof input.discord !== 'boolean' ||
    input.consentVersion !== '2026-09-04' ||
    typeof input.updatedAt !== 'number' ||
    !Number.isSafeInteger(input.updatedAt) ||
    eventTypes.length !== (Array.isArray(input.eventTypes) ? input.eventTypes.length : -1) ||
    eventTypes.length > NOTIFICATION_EVENT_TYPES.length
  ) return null;

  return {
    enabled: input.enabled,
    email: input.email,
    slack: input.slack,
    discord: input.discord,
    eventTypes,
    consentVersion: '2026-09-04',
    updatedAt: input.updatedAt,
  };
}

export function buildExternalNotification(eventType: NotificationEventType, appUrl: string): ExternalNotification {
  let safeUrl = 'https://reflective-journal-ai-companion.ai.studio/';
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol === 'https:') safeUrl = parsed.toString().slice(0, 500);
  } catch {
    // Fail closed to the known production URL.
  }
  const descriptions: Record<NotificationEventType, string> = {
    summary_ready: 'Your reflection summary is ready.',
    weekly_reminder: 'Your optional weekly reflection reminder is ready.',
    manual_test: 'Your Reflective notification test succeeded.',
  };
  return {
    subject: 'Reflective notification',
    text: `${descriptions[eventType]} Sign in to view it: ${safeUrl}`,
  };
}

export function encodeGmailMessage(sender: string, recipient: string, notification: ExternalNotification): string {
  const cleanHeader = (value: string) => value.replace(/[\r\n]/g, '').trim();
  const mime = [
    `From: ${cleanHeader(sender)}`,
    `To: ${cleanHeader(recipient)}`,
    `Subject: ${cleanHeader(notification.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    notification.text,
  ].join('\r\n');
  return Buffer.from(mime, 'utf8').toString('base64url');
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
}

export function isAllowedWebhookUrl(channel: 'slack' | 'discord', value: string | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    if (channel === 'slack') return parsed.hostname === 'hooks.slack.com' && parsed.pathname.startsWith('/services/');
    return (parsed.hostname === 'discord.com' || parsed.hostname === 'discordapp.com') && parsed.pathname.startsWith('/api/webhooks/');
  } catch {
    return false;
  }
}

async function getGmailAccessToken(env: NodeJS.ProcessEnv): Promise<string | null> {
  const clientId = env.GMAIL_CLIENT_ID?.trim();
  const clientSecret = env.GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = env.GMAIL_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('gmail_token_exchange_failed');
  const payload = await response.json() as { access_token?: unknown };
  return typeof payload.access_token === 'string' && payload.access_token ? payload.access_token : null;
}

export async function deliverExternalNotification(options: {
  preferences: NotificationPreferences;
  eventType: NotificationEventType;
  recipientEmail?: string;
  appUrl: string;
  env?: NodeJS.ProcessEnv;
}): Promise<DeliveryResult[]> {
  const env = options.env || process.env;
  const notification = buildExternalNotification(options.eventType, options.appUrl);
  const results: DeliveryResult[] = [];

  for (const channel of ['email', 'slack', 'discord'] as const) {
    if (!options.preferences.enabled || !options.preferences[channel] || !options.preferences.eventTypes.includes(options.eventType)) {
      results.push({ channel, status: 'disabled' });
      continue;
    }

    try {
      if (channel === 'email') {
        const sender = env.GMAIL_SENDER_EMAIL?.trim();
        if (!sender || !options.recipientEmail) {
          results.push({ channel, status: 'not_configured' });
          continue;
        }
        const accessToken = await getGmailAccessToken(env);
        if (!accessToken) {
          results.push({ channel, status: 'not_configured' });
          continue;
        }
        const response = await postJson(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
          { raw: encodeGmailMessage(sender, options.recipientEmail, notification) },
          { Authorization: `Bearer ${accessToken}` },
        );
        results.push({ channel, status: response.ok ? 'sent' : 'failed' });
      } else if (channel === 'slack') {
        const webhook = env.SLACK_WEBHOOK_URL?.trim();
        if (!isAllowedWebhookUrl('slack', webhook)) {
          results.push({ channel, status: 'not_configured' });
          continue;
        }
        const response = await postJson(webhook, { text: notification.text });
        results.push({ channel, status: response.ok ? 'sent' : 'failed' });
      } else {
        const webhook = env.DISCORD_WEBHOOK_URL?.trim();
        if (!isAllowedWebhookUrl('discord', webhook)) {
          results.push({ channel, status: 'not_configured' });
          continue;
        }
        const response = await postJson(webhook, { content: notification.text });
        results.push({ channel, status: response.ok ? 'sent' : 'failed' });
      }
    } catch {
      results.push({ channel, status: 'failed' });
    }
  }

  return results;
}
