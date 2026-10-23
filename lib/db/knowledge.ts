/**
 * Knowledge DB layer — extends knowledge_docs + scopes + chunks.
 */

import type {
  KnowledgeChunkRecord,
  KnowledgeDocRecord,
  KnowledgeScope,
  KnowledgeStatus,
} from '../knowledge/types';
import type { ScopeInput } from '../knowledge/permissions';
import { normalizeScopeInputs } from '../knowledge/permissions';

export type { KnowledgeDocRecord as KnowledgeDoc };

function mapDoc(row: KnowledgeDocRecord): KnowledgeDocRecord {
  return {
    ...row,
    status: (row.status || 'unindexed') as KnowledgeStatus,
    owner: row.owner || 'operator',
    error_message: row.error_message || '',
    archived: Number(row.archived) || 0,
    version: Number(row.version) || 1,
    source_meta_json: row.source_meta_json || '{}',
    checksum: row.checksum ?? null,
    indexed_at: row.indexed_at ?? null,
  };
}

export async function listKnowledge(
  db: D1Database,
  opts?: {
    projectId?: string;
    status?: KnowledgeStatus;
    includeArchived?: boolean;
    botSlug?: string;
    scopeKind?: string;
  },
): Promise<KnowledgeDocRecord[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (!opts?.includeArchived) {
    clauses.push(`archived = 0`);
  }
  if (opts?.projectId) {
    clauses.push(`project_id = ?`);
    binds.push(opts.projectId);
  }
  if (opts?.status) {
    clauses.push(`status = ?`);
    binds.push(opts.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await db
    .prepare(`SELECT * FROM knowledge_docs ${where} ORDER BY updated_at DESC`)
    .bind(...binds)
    .all<KnowledgeDocRecord>();
  let docs = (results ?? []).map(mapDoc);

  if (opts?.botSlug || opts?.scopeKind) {
    const filtered: KnowledgeDocRecord[] = [];
    for (const d of docs) {
      const scopes = await listDocScopes(db, d.id);
      const ok = scopes.some((s) => {
        if (opts.scopeKind && s.scope_kind !== opts.scopeKind) return false;
        if (opts.botSlug && s.scope_kind === 'bot' && s.bot_slug !== opts.botSlug) return false;
        if (opts.botSlug && s.scope_kind === 'shared') return true;
        if (!opts.botSlug) return true;
        return s.scope_kind === 'bot' && s.bot_slug === opts.botSlug;
      });
      if (ok) filtered.push(d);
    }
    docs = filtered;
  }
  return docs;
}

export async function getKnowledge(
  db: D1Database,
  id: string,
): Promise<KnowledgeDocRecord | null> {
  const row = await db
    .prepare(`SELECT * FROM knowledge_docs WHERE id = ?`)
    .bind(id)
    .first<KnowledgeDocRecord>();
  return row ? mapDoc(row) : null;
}

export async function createKnowledge(
  db: D1Database,
  input: {
    title: string;
    filename: string;
    mime: string;
    size?: number;
    attachmentId?: string | null;
    projectId?: string | null;
    excerpt?: string;
    status?: KnowledgeStatus;
    owner?: string;
    checksum?: string | null;
    scopes?: ScopeInput[];
  },
): Promise<KnowledgeDocRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const title = input.title.trim().slice(0, 300) || 'Untitled';
  const filename = input.filename.trim().slice(0, 300) || 'file';
  const mime = input.mime.trim().slice(0, 120) || 'application/octet-stream';
  const size = Math.max(0, Math.floor(input.size ?? 0));
  const attachment_id = input.attachmentId ?? null;
  const project_id = input.projectId ?? null;
  const excerpt = (input.excerpt ?? '').slice(0, 4000);
  const status: KnowledgeStatus = input.status ?? 'uploading';
  const owner = (input.owner ?? 'operator').slice(0, 120);

  await db
    .prepare(
      `INSERT INTO knowledge_docs
        (id, title, filename, mime, size, attachment_id, project_id, excerpt,
         status, owner, checksum, error_message, archived, version, source_meta_json,
         indexed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, 1, '{}', NULL, ?, ?)`,
    )
    .bind(
      id,
      title,
      filename,
      mime,
      size,
      attachment_id,
      project_id,
      excerpt,
      status,
      owner,
      input.checksum ?? null,
      now,
      now,
    )
    .run();

  const scopes = normalizeScopeInputs(input.scopes ?? []);
  if (project_id && !scopes.some((s) => s.scope_kind === 'project')) {
    scopes.push({ scope_kind: 'project', project_id });
  }
  if (scopes.length) await replaceDocScopes(db, id, scopes);

  const doc = await getKnowledge(db, id);
  if (!doc) throw new Error('Failed to create knowledge document.');
  return doc;
}

export async function updateKnowledge(
  db: D1Database,
  id: string,
  patch: Partial<{
    title: string;
    excerpt: string;
    status: KnowledgeStatus;
    error_message: string;
    archived: boolean;
    checksum: string | null;
    version: number;
    source_meta_json: string;
    indexed_at: string | null;
    project_id: string | null;
  }>,
): Promise<KnowledgeDocRecord | null> {
  const existing = await getKnowledge(db, id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const title = patch.title?.trim().slice(0, 300) ?? existing.title;
  const excerpt = patch.excerpt != null ? patch.excerpt.slice(0, 4000) : existing.excerpt;
  const status = patch.status ?? existing.status;
  const error_message =
    patch.error_message != null ? patch.error_message.slice(0, 2000) : existing.error_message;
  const archived = patch.archived != null ? (patch.archived ? 1 : 0) : existing.archived;
  const checksum = patch.checksum !== undefined ? patch.checksum : existing.checksum;
  const version = patch.version ?? existing.version;
  const source_meta_json = patch.source_meta_json ?? existing.source_meta_json;
  const indexed_at = patch.indexed_at !== undefined ? patch.indexed_at : existing.indexed_at;
  const project_id = patch.project_id !== undefined ? patch.project_id : existing.project_id;

  await db
    .prepare(
      `UPDATE knowledge_docs SET
        title = ?, excerpt = ?, status = ?, error_message = ?, archived = ?,
        checksum = ?, version = ?, source_meta_json = ?, indexed_at = ?,
        project_id = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      title,
      excerpt,
      status,
      error_message,
      archived,
      checksum,
      version,
      source_meta_json,
      indexed_at,
      project_id,
      now,
      id,
    )
    .run();

  return getKnowledge(db, id);
}

export async function deleteKnowledge(db: D1Database, id: string): Promise<boolean> {
  await db.prepare(`DELETE FROM knowledge_chunks WHERE doc_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM knowledge_doc_scopes WHERE doc_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM knowledge_doc_versions WHERE doc_id = ?`).bind(id).run();
  const result = await db.prepare(`DELETE FROM knowledge_docs WHERE id = ?`).bind(id).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function archiveKnowledge(db: D1Database, id: string): Promise<KnowledgeDocRecord | null> {
  return updateKnowledge(db, id, { archived: true, status: 'archived' });
}

export async function listDocScopes(db: D1Database, docId: string): Promise<KnowledgeScope[]> {
  const { results } = await db
    .prepare(
      `SELECT id, doc_id, scope_kind, bot_slug, project_id, created_at
       FROM knowledge_doc_scopes WHERE doc_id = ? ORDER BY created_at ASC`,
    )
    .bind(docId)
    .all<KnowledgeScope>();
  return results ?? [];
}

export async function replaceDocScopes(
  db: D1Database,
  docId: string,
  scopes: ScopeInput[],
): Promise<KnowledgeScope[]> {
  await db.prepare(`DELETE FROM knowledge_doc_scopes WHERE doc_id = ?`).bind(docId).run();
  const now = new Date().toISOString();
  const normalized = normalizeScopeInputs(scopes);
  for (const s of normalized) {
    const id = crypto.randomUUID();
    const bot_slug = s.scope_kind === 'bot' ? s.bot_slug : null;
    const project_id = s.scope_kind === 'project' ? s.project_id : null;
    await db
      .prepare(
        `INSERT INTO knowledge_doc_scopes (id, doc_id, scope_kind, bot_slug, project_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, docId, s.scope_kind, bot_slug, project_id, now)
      .run();
  }
  await db
    .prepare(`UPDATE knowledge_docs SET updated_at = ? WHERE id = ?`)
    .bind(now, docId)
    .run();
  return listDocScopes(db, docId);
}

export async function deleteChunksForDoc(db: D1Database, docId: string): Promise<void> {
  await db.prepare(`DELETE FROM knowledge_chunks WHERE doc_id = ?`).bind(docId).run();
}

export async function insertChunks(
  db: D1Database,
  docId: string,
  version: number,
  chunks: Array<{
    chunk_index: number;
    text: string;
    page: number | null;
    section: string | null;
    char_start: number;
    char_end: number;
    token_estimate: number;
    embedding: number[];
    embedding_model: string;
  }>,
): Promise<void> {
  const now = new Date().toISOString();
  for (const c of chunks) {
    await db
      .prepare(
        `INSERT INTO knowledge_chunks
          (id, doc_id, version, chunk_index, text, page, section, char_start, char_end,
           token_estimate, embedding_json, embedding_model, embedding_dims, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        docId,
        version,
        c.chunk_index,
        c.text,
        c.page,
        c.section,
        c.char_start,
        c.char_end,
        c.token_estimate,
        JSON.stringify(c.embedding),
        c.embedding_model,
        c.embedding.length,
        now,
      )
      .run();
  }
}

export async function listChunksForAuthorizedDocs(
  db: D1Database,
  docIds: string[],
): Promise<KnowledgeChunkRecord[]> {
  if (!docIds.length) return [];
  // D1 bind limit — batch
  const out: KnowledgeChunkRecord[] = [];
  for (let i = 0; i < docIds.length; i += 40) {
    const batch = docIds.slice(i, i + 40);
    const placeholders = batch.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `SELECT * FROM knowledge_chunks WHERE doc_id IN (${placeholders}) ORDER BY doc_id, chunk_index`,
      )
      .bind(...batch)
      .all<KnowledgeChunkRecord>();
    out.push(...(results ?? []));
  }
  return out;
}

export async function insertDocVersion(
  db: D1Database,
  input: {
    docId: string;
    version: number;
    attachmentId: string | null;
    checksum: string | null;
    size: number;
    mime: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO knowledge_doc_versions
        (id, doc_id, version, attachment_id, checksum, size, mime, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.docId,
      input.version,
      input.attachmentId,
      input.checksum,
      input.size,
      input.mime,
      new Date().toISOString(),
    )
    .run();
}

/** Keyword fallback search on metadata (not a substitute for vector retrieval). */
export async function searchKnowledgeMeta(
  db: D1Database,
  query: string,
  limit = 20,
): Promise<KnowledgeDocRecord[]> {
  const q = query.trim();
  if (!q) return [];
  const like = `%${q.replace(/%/g, '').replace(/_/g, '')}%`;
  const { results } = await db
    .prepare(
      `SELECT * FROM knowledge_docs
       WHERE archived = 0 AND (title LIKE ? OR excerpt LIKE ? OR filename LIKE ?)
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .bind(like, like, like, Math.min(Math.max(limit, 1), 100))
    .all<KnowledgeDocRecord>();
  return (results ?? []).map(mapDoc);
}

/** @deprecated use searchKnowledgeMeta — kept name for older imports */
export const searchKnowledge = searchKnowledgeMeta;
