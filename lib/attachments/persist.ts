/**
 * D1 persistence for attachments — survives Worker cold starts / page reload.
 * Opaque UUID keys only; never exposes filesystem paths.
 */

import type { AttachmentFormat, AttachmentMeta } from './types';
import { cacheAttachment, type StoredAttachment } from './store';
import { logSafeError } from '../observability';

/** Keep generated/uploaded files for 7 days. */
export const ATTACHMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AttachmentRow = {
  id: string;
  filename: string;
  mime: string;
  format: string;
  size: number;
  source_agent: string | null;
  conversation_id: string | null;
  bytes: ArrayBuffer | Uint8Array;
  created_at: string;
  expires_at: string;
};

function toBytes(raw: ArrayBuffer | Uint8Array): Uint8Array {
  if (raw instanceof Uint8Array) {
    const copy = new Uint8Array(raw.byteLength);
    copy.set(raw);
    return copy;
  }
  return new Uint8Array(raw);
}

export async function saveAttachmentToDb(
  db: D1Database,
  row: StoredAttachment,
): Promise<void> {
  const createdAt = new Date(row.createdAt).toISOString();
  const expiresAt = new Date(row.createdAt + ATTACHMENT_TTL_MS).toISOString();
  await db
    .prepare(
      `INSERT OR REPLACE INTO attachments
        (id, filename, mime, format, size, source_agent, conversation_id, bytes, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.filename,
      row.mime,
      row.format,
      row.size,
      row.sourceAgent ?? null,
      row.conversationId ?? null,
      row.bytes,
      createdAt,
      expiresAt,
    )
    .run();

  // Opportunistic purge (best-effort)
  try {
    await db
      .prepare(`DELETE FROM attachments WHERE expires_at < ?`)
      .bind(new Date().toISOString())
      .run();
  } catch {
    /* ignore purge errors */
  }
}

export async function loadAttachmentFromDb(
  db: D1Database,
  id: string,
): Promise<StoredAttachment | null> {
  const row = await db
    .prepare(
      `SELECT id, filename, mime, format, size, source_agent, conversation_id, bytes, created_at, expires_at
       FROM attachments WHERE id = ?`,
    )
    .bind(id)
    .first<AttachmentRow>();

  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    try {
      await db.prepare(`DELETE FROM attachments WHERE id = ?`).bind(id).run();
    } catch {
      /* ignore */
    }
    return null;
  }

  const stored: StoredAttachment = {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    format: row.format as AttachmentFormat | 'upload',
    size: row.size,
    sourceAgent: row.source_agent ?? undefined,
    conversationId: row.conversation_id ?? undefined,
    createdAt: Date.parse(row.created_at) || Date.now(),
    bytes: toBytes(row.bytes),
  };

  cacheAttachment(stored);
  return stored;
}

export async function resolveAttachment(
  id: string,
  db?: D1Database | null,
): Promise<StoredAttachment | null> {
  const { getAttachment } = await import('./store');
  const mem = getAttachment(id);
  if (mem) return mem;
  if (!db) return null;
  try {
    return await loadAttachmentFromDb(db, id);
  } catch (err) {
    logSafeError('attachment_load_failed', err, {
      operation: 'resolveAttachment',
      category: 'persistence',
    });
    return null;
  }
}

export async function persistAttachmentBestEffort(
  db: D1Database | null | undefined,
  meta: AttachmentMeta,
): Promise<void> {
  if (!db) return;
  const { getAttachment } = await import('./store');
  const row = getAttachment(meta.id);
  if (!row) return;
  try {
    await saveAttachmentToDb(db, row);
  } catch (err) {
    logSafeError('attachment_save_failed', err, {
      operation: 'persistAttachmentBestEffort',
      category: 'persistence',
    });
  }
}

/** Safe DB handle from Cloudflare / OpenNext; null when unavailable (pure unit tests). */
export async function getAttachmentsDb(): Promise<D1Database | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    return (env as { DB?: D1Database }).DB ?? null;
  } catch {
    return null;
  }
}

export type { AttachmentMeta };
