/**
 * In-process attachment cache — L1 for the current isolate.
 * Durable copies live in D1 via persist.ts (opaque UUID ids only).
 */

import type { AttachmentMeta } from './types';

export type StoredAttachment = AttachmentMeta & { bytes: Uint8Array };

const STORE = new Map<string, StoredAttachment>();
/** Memory cache TTL (D1 holds longer). */
const TTL_MS = 60 * 60 * 1000;

function purge(): void {
  const now = Date.now();
  for (const [id, row] of STORE) {
    if (now - row.createdAt > TTL_MS) STORE.delete(id);
  }
}

export function putAttachment(
  meta: Omit<AttachmentMeta, 'id' | 'createdAt' | 'size'> & { bytes: Uint8Array },
): AttachmentMeta {
  purge();
  const id = crypto.randomUUID();
  const row: StoredAttachment = {
    id,
    filename: meta.filename,
    mime: meta.mime,
    format: meta.format,
    sourceAgent: meta.sourceAgent,
    conversationId: meta.conversationId,
    createdAt: Date.now(),
    size: meta.bytes.byteLength,
    bytes: meta.bytes,
  };
  STORE.set(id, row);
  const { bytes: _b, ...publicMeta } = row;
  return publicMeta;
}

export function cacheAttachment(row: StoredAttachment): void {
  purge();
  STORE.set(row.id, row);
}

export function getAttachment(id: string): StoredAttachment | null {
  purge();
  const row = STORE.get(id);
  if (!row) return null;
  if (Date.now() - row.createdAt > TTL_MS) {
    STORE.delete(id);
    return null;
  }
  return row;
}

/** Test helper — drop L1 cache so D1 path can be verified. */
export function clearAttachmentCacheForTests(): void {
  STORE.clear();
}
