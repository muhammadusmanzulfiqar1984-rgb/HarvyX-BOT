/**
 * Gmail connector tools — server-side only.
 *
 * These functions are NOT automatically attached to Manager/OPS/Analyst.
 * They are exposed through the future Bot permission layer.
 *
 * SEND operations are marked approval-sensitive: callers must pass
 * `requireApproval: true` explicitly to prevent silent autonomous sends.
 */

import { logSafeError } from '../observability';
import { getConnectorAccountRow } from './db';
import { getValidAccessToken, type GmailEnv } from './gmail-oauth';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function gmailFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gmail API ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json();
}

// ─── Context ────────────────────────────────────────────────────────────────

export interface GmailContext {
  db: D1Database;
  env: GmailEnv;
}

async function getToken(ctx: GmailContext): Promise<string> {
  const row = await getConnectorAccountRow(ctx.db, 'gmail');
  if (!row) throw new Error('Gmail not connected. Please connect Gmail in Settings.');
  return getValidAccessToken(ctx.db, ctx.env, row);
}

// ─── READ ────────────────────────────────────────────────────────────────────

export interface SearchEmailsParams {
  query: string;
  maxResults?: number;
  pageToken?: string;
}

export async function searchEmails(ctx: GmailContext, params: SearchEmailsParams) {
  const token = await getToken(ctx);
  const qs = new URLSearchParams({ q: params.query, maxResults: String(params.maxResults ?? 20) });
  if (params.pageToken) qs.set('pageToken', params.pageToken);
  return gmailFetch(token, `/messages?${qs}`);
}

export interface GetEmailParams {
  messageId: string;
  format?: 'full' | 'metadata' | 'minimal' | 'raw';
}

export async function getEmail(ctx: GmailContext, params: GetEmailParams) {
  const token = await getToken(ctx);
  const qs = new URLSearchParams({ format: params.format ?? 'full' });
  return gmailFetch(token, `/messages/${params.messageId}?${qs}`);
}

export interface GetThreadParams {
  threadId: string;
  format?: 'full' | 'metadata' | 'minimal';
}

export async function getThread(ctx: GmailContext, params: GetThreadParams) {
  const token = await getToken(ctx);
  const qs = new URLSearchParams({ format: params.format ?? 'full' });
  return gmailFetch(token, `/threads/${params.threadId}?${qs}`);
}

export interface ListThreadsParams {
  query?: string;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
}

export async function listThreads(ctx: GmailContext, params: ListThreadsParams = {}) {
  const token = await getToken(ctx);
  const qs = new URLSearchParams({ maxResults: String(params.maxResults ?? 20) });
  if (params.query) qs.set('q', params.query);
  if (params.pageToken) qs.set('pageToken', params.pageToken);
  if (params.labelIds?.length) {
    for (const id of params.labelIds) qs.append('labelIds', id);
  }
  return gmailFetch(token, `/threads?${qs}`);
}

export interface GetAttachmentParams {
  messageId: string;
  attachmentId: string;
}

export async function getAttachment(ctx: GmailContext, params: GetAttachmentParams) {
  const token = await getToken(ctx);
  return gmailFetch(token, `/messages/${params.messageId}/attachments/${params.attachmentId}`);
}

// ─── DRAFT ───────────────────────────────────────────────────────────────────

function encodeMimeMessage(opts: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
  ];
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) lines.push(`References: ${opts.references}`);
  lines.push('', opts.body);
  return btoa(unescape(encodeURIComponent(lines.join('\r\n'))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface CreateDraftParams {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

export async function createDraft(ctx: GmailContext, params: CreateDraftParams) {
  const token = await getToken(ctx);
  const raw = encodeMimeMessage(params);
  const payload: Record<string, unknown> = { message: { raw } };
  if (params.threadId) (payload.message as Record<string, unknown>).threadId = params.threadId;
  return gmailFetch(token, '/drafts', { method: 'POST', body: JSON.stringify(payload) });
}

export interface UpdateDraftParams {
  draftId: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

export async function updateDraft(ctx: GmailContext, params: UpdateDraftParams) {
  const token = await getToken(ctx);
  const raw = encodeMimeMessage(params);
  const payload: Record<string, unknown> = { message: { raw } };
  if (params.threadId) (payload.message as Record<string, unknown>).threadId = params.threadId;
  return gmailFetch(token, `/drafts/${params.draftId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteDraft(ctx: GmailContext, draftId: string) {
  const token = await getToken(ctx);
  const res = await fetch(`${GMAIL_BASE}/drafts/${draftId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Gmail draft delete failed: ${res.status}`);
  }
  return { deleted: true, draftId };
}

// ─── SEND (approval-sensitive) ───────────────────────────────────────────────

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  /** Must be explicitly true — prevents silent autonomous sends. */
  requireApproval: true;
}

export async function sendEmail(ctx: GmailContext, params: SendEmailParams) {
  const token = await getToken(ctx);
  const raw = encodeMimeMessage(params);
  const payload: Record<string, unknown> = { raw };
  if (params.threadId) payload.threadId = params.threadId;
  return gmailFetch(token, '/messages/send', { method: 'POST', body: JSON.stringify(payload) });
}

export interface ReplyToThreadParams {
  threadId: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo: string;
  references: string;
  /** Must be explicitly true — prevents silent autonomous sends. */
  requireApproval: true;
}

export async function replyToThread(ctx: GmailContext, params: ReplyToThreadParams) {
  return sendEmail(ctx, {
    to: params.to,
    subject: params.subject,
    body: params.body,
    threadId: params.threadId,
    inReplyTo: params.inReplyTo,
    references: params.references,
    requireApproval: true,
  });
}

export interface ForwardEmailParams {
  to: string;
  subject: string;
  body: string;
  /** Must be explicitly true — prevents silent autonomous sends. */
  requireApproval: true;
}

export async function forwardEmail(ctx: GmailContext, params: ForwardEmailParams) {
  return sendEmail(ctx, {
    to: params.to,
    subject: params.subject,
    body: params.body,
    requireApproval: true,
  });
}

// ─── Convenience: send a saved draft ─────────────────────────────────────────

export interface SendDraftParams {
  draftId: string;
  /** Must be explicitly true — prevents silent autonomous sends. */
  requireApproval: true;
}

export async function sendDraft(ctx: GmailContext, params: SendDraftParams) {
  const token = await getToken(ctx);
  return gmailFetch(token, '/drafts/send', {
    method: 'POST',
    body: JSON.stringify({ id: params.draftId }),
  });
}

// ─── Safe wrapper for tool-loop use ──────────────────────────────────────────

export async function safeGmailCall<T>(
  fn: () => Promise<T>,
  operation: string,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    logSafeError('gmail_tool_error', err, { operation, category: 'auth' });
    const msg = err instanceof Error ? err.message : 'Gmail operation failed';
    return { ok: false, error: msg };
  }
}
