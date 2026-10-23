/**
 * Knowledge ingestion pipeline:
 * UPLOAD → validate → store metadata → extract → normalize → chunk → embed → index → READY|FAILED
 *
 * Never marks READY unless embeddings were stored. Runs outside the chat request path.
 */

import { resolveAttachment } from '@/lib/attachments/persist';
import {
  createKnowledge,
  deleteChunksForDoc,
  getKnowledge,
  insertChunks,
  insertDocVersion,
  replaceDocScopes,
  updateKnowledge,
} from '@/lib/db/knowledge';
import { chunkDocumentText } from './chunk';
import { extractKnowledgeText } from './extract';
import { embedDocuments, type EmbeddingEnv } from './embeddings/provider';
import type { ScopeInput } from './permissions';
import type { KnowledgeDocRecord } from './types';

export type KnowledgePipelineEnv = EmbeddingEnv & {
  DB?: D1Database;
};

const EMBED_BATCH = 16;

export async function runKnowledgePipeline(
  db: D1Database,
  docId: string,
  env: EmbeddingEnv,
): Promise<KnowledgeDocRecord> {
  const doc = await getKnowledge(db, docId);
  if (!doc) throw new Error('Knowledge document not found.');
  if (doc.archived) throw new Error('Cannot index an archived document.');

  await updateKnowledge(db, docId, {
    status: 'processing',
    error_message: '',
  });

  try {
    if (!doc.attachment_id) {
      throw new Error('Document has no attachment bytes to index.');
    }
    const resolved = await resolveAttachment(doc.attachment_id, db);
    if (!resolved?.bytes?.length) {
      throw new Error('Attachment bytes unavailable for extraction.');
    }

    const extracted = extractKnowledgeText(resolved.bytes, doc.filename, doc.mime);
    if (!extracted.ok) {
      await updateKnowledge(db, docId, {
        status: 'failed',
        error_message: extracted.error,
        checksum: extracted.checksum ?? null,
      });
      const failed = await getKnowledge(db, docId);
      if (!failed) throw new Error(extracted.error);
      return failed;
    }

    await updateKnowledge(db, docId, {
      status: 'indexing',
      checksum: extracted.checksum,
      excerpt: extracted.text.slice(0, 2000),
      source_meta_json: JSON.stringify(extracted.meta),
    });

    const drafts = chunkDocumentText(extracted.text);
    if (!drafts.length) {
      await updateKnowledge(db, docId, {
        status: 'failed',
        error_message: 'No chunks produced from extracted text.',
      });
      return (await getKnowledge(db, docId))!;
    }

    const { vectors, provider } = await embedDocuments(
      env,
      drafts.map((d) => d.text),
    );
    if (vectors.length !== drafts.length) {
      throw new Error('Embedding count mismatch.');
    }

    const version = doc.version || 1;
    await deleteChunksForDoc(db, docId);
    await insertChunks(
      db,
      docId,
      version,
      drafts.map((d, i) => ({
        chunk_index: d.chunk_index,
        text: d.text,
        page: d.page ?? null,
        section: d.section ?? null,
        char_start: d.char_start,
        char_end: d.char_end,
        token_estimate: d.token_estimate,
        embedding: vectors[i]!,
        embedding_model: provider.model,
      })),
    );

    await insertDocVersion(db, {
      docId,
      version,
      attachmentId: doc.attachment_id,
      checksum: extracted.checksum,
      size: doc.size,
      mime: doc.mime,
    });

    const ready = await updateKnowledge(db, docId, {
      status: 'ready',
      error_message: '',
      indexed_at: new Date().toISOString(),
      checksum: extracted.checksum,
      excerpt: extracted.text.slice(0, 2000),
      source_meta_json: JSON.stringify({
        ...extracted.meta,
        chunkCount: drafts.length,
        embeddingModel: provider.model,
        embeddingProvider: provider.id,
        dims: vectors[0]?.length ?? 0,
      }),
    });
    if (!ready || ready.status !== 'ready') {
      throw new Error('Failed to mark document READY after indexing.');
    }
    return ready;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Indexing failed.';
    await updateKnowledge(db, docId, {
      status: 'failed',
      error_message: msg,
    });
    const failed = await getKnowledge(db, docId);
    if (!failed) throw err;
    return failed;
  }
}

/**
 * Create a knowledge doc from an existing attachment and kick off indexing.
 */
export async function ingestAttachmentAsKnowledge(
  db: D1Database,
  env: EmbeddingEnv,
  input: {
    attachmentId: string;
    title?: string;
    filename: string;
    mime: string;
    size: number;
    projectId?: string | null;
    scopes?: ScopeInput[];
    owner?: string;
    /** When true, await pipeline; otherwise caller should schedule waitUntil. */
    awaitPipeline?: boolean;
  },
): Promise<{ doc: KnowledgeDocRecord; processed?: KnowledgeDocRecord }> {
  const doc = await createKnowledge(db, {
    title: input.title || input.filename,
    filename: input.filename,
    mime: input.mime,
    size: input.size,
    attachmentId: input.attachmentId,
    projectId: input.projectId ?? null,
    status: 'uploading',
    owner: input.owner,
    scopes: input.scopes,
  });

  await updateKnowledge(db, doc.id, { status: 'processing' });

  if (input.awaitPipeline) {
    const processed = await runKnowledgePipeline(db, doc.id, env);
    return { doc: processed, processed };
  }
  return { doc: (await getKnowledge(db, doc.id))! };
}

export async function setKnowledgeScopes(
  db: D1Database,
  docId: string,
  scopes: ScopeInput[],
): Promise<KnowledgeDocRecord | null> {
  const doc = await getKnowledge(db, docId);
  if (!doc) return null;
  await replaceDocScopes(db, docId, scopes);
  const projectScope = scopes.find((s) => s.scope_kind === 'project');
  if (projectScope && projectScope.scope_kind === 'project') {
    await updateKnowledge(db, docId, { project_id: projectScope.project_id });
  }
  return getKnowledge(db, docId);
}

/** Schedule pipeline without blocking the response when waitUntil is available. */
export function scheduleKnowledgePipeline(
  db: D1Database,
  docId: string,
  env: EmbeddingEnv,
  waitUntil?: (p: Promise<unknown>) => void,
): void {
  const job = runKnowledgePipeline(db, docId, env).catch(() => {
    /* status already FAILED in pipeline */
  });
  if (typeof waitUntil === 'function') {
    waitUntil(job);
  } else {
    void job;
  }
}
