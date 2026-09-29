/**
 * Webhook primitives — verify, receive, map, audit.
 * Never execute payloads as shell/code.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getWebhookByPath, writeAudit } from './persist';
import { containsCredentialLike } from './schemas';

export type WebhookReceiveResult =
  | { ok: true; webhookId: string; providerId: string; event: string }
  | { ok: false; error: string };

/**
 * Verify HMAC-SHA256 signature when secret is provided via env ref.
 * secretRef names an env var — raw secret never stored in marketplace tables.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.replace(/^sha256=/i, '').trim();
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function receiveWebhookEvent(
  db: D1Database | undefined,
  urlPath: string,
  rawBody: string,
  headers: Headers,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Promise<WebhookReceiveResult> {
  const wh = await getWebhookByPath(db, urlPath);
  if (!wh) return { ok: false, error: 'Unknown webhook.' };

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: 'Invalid JSON body.' };
  }
  if (containsCredentialLike(payload)) {
    return { ok: false, error: 'Payload appears to contain credentials — rejected.' };
  }

  if (wh.secretRef) {
    const secret = env[wh.secretRef];
    const sig =
      headers.get('x-hub-signature-256') ||
      headers.get('x-signature') ||
      headers.get('x-harvyx-signature');
    if (!verifyWebhookSignature(rawBody, sig, secret)) {
      await writeAudit(db, {
        providerId: wh.providerId,
        capabilityId: wh.capabilityId || 'webhooks.receive',
        status: 'WEBHOOK_REJECTED',
        durationMs: 0,
        approval: 'none',
        resultMeta: { reason: 'bad_signature' },
      });
      return { ok: false, error: 'Invalid webhook signature.' };
    }
  }

  const event =
    typeof (payload as { event?: string }).event === 'string'
      ? (payload as { event: string }).event
      : 'webhook.received';

  await writeAudit(db, {
    providerId: wh.providerId,
    capabilityId: wh.capabilityId || 'webhooks.register',
    status: 'WEBHOOK_RECEIVED',
    durationMs: 0,
    approval: 'none',
    resultMeta: {
      webhookId: wh.id,
      event,
      // Never store full payload if large — keys only
      keys: payload && typeof payload === 'object' ? Object.keys(payload as object).slice(0, 20) : [],
    },
  });

  return { ok: true, webhookId: wh.id, providerId: wh.providerId, event };
}
