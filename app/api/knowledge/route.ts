import { putAttachment } from '@/lib/attachments/store';
import {
  getAttachmentsDb,
  persistAttachmentBestEffort,
  resolveAttachment,
} from '@/lib/attachments/persist';
import {
  createKnowledge,
  getKnowledge,
  listDocScopes,
  listKnowledge,
  searchKnowledgeMeta,
} from '@/lib/db/knowledge';
import { jsonError, requireDb } from '@/lib/api/shell';
import { normalizeScopeInputs } from '@/lib/knowledge/permissions';
import { hasProductionEmbeddingConfig } from '@/lib/knowledge/embeddings/provider';
import {
  ingestAttachmentAsKnowledge,
  runKnowledgePipeline,
} from '@/lib/knowledge/pipeline';
import { retrieveKnowledge } from '@/lib/knowledge/retrieve';
import { validateKnowledgeUpload } from '@/lib/knowledge/validate';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'nodejs';

function embeddingEnvFrom(env: Record<string, unknown> | undefined) {
  const e = env ?? {};
  return {
    EMBEDDING_PROVIDER: String(e.EMBEDDING_PROVIDER || process.env.EMBEDDING_PROVIDER || ''),
    EMBEDDING_BASE_URL: String(e.EMBEDDING_BASE_URL || process.env.EMBEDDING_BASE_URL || ''),
    EMBEDDING_API_KEY: String(e.EMBEDDING_API_KEY || process.env.EMBEDDING_API_KEY || ''),
    EMBEDDING_MODEL: String(e.EMBEDDING_MODEL || process.env.EMBEDDING_MODEL || ''),
    CLOUDFLARE_ACCOUNT_ID: String(
      e.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '',
    ),
    CLOUDFLARE_API_TOKEN: String(
      e.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '',
    ),
    CLOUDFLARE_EMBEDDING_MODEL: String(
      e.CLOUDFLARE_EMBEDDING_MODEL || process.env.CLOUDFLARE_EMBEDDING_MODEL || '',
    ),
    EMBEDDING_FORCE_DETERMINISTIC: String(
      e.EMBEDDING_FORCE_DETERMINISTIC || process.env.EMBEDDING_FORCE_DETERMINISTIC || '',
    ),
  };
}

async function cfWaitUntil(): Promise<{
  env: Record<string, unknown>;
  waitUntil?: (p: Promise<unknown>) => void;
}> {
  try {
    const { env, ctx } = await getCloudflareContext({ async: true });
    return { env: env as unknown as Record<string, unknown>, waitUntil: ctx?.waitUntil?.bind(ctx) };
  } catch {
    return { env: process.env as unknown as Record<string, unknown> };
  }
}

export async function GET(request: Request) {
  const { db, error } = await requireDb();
  if (error) return error;

  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const q = url.searchParams.get('q') || '';
    const mode = url.searchParams.get('mode') || 'list';

    if (mode === 'search' && q.trim()) {
      const botSlug = url.searchParams.get('botSlug') || 'mian';
      const topK = Number(url.searchParams.get('topK') || '8');
      const { env } = await cfWaitUntil();
      const result = await retrieveKnowledge(db, embeddingEnvFrom(env), {
        query: q,
        access: { botSlug, projectId: projectId ?? null },
        topK: Number.isFinite(topK) ? topK : 8,
      });
      return Response.json({
        ok: true,
        query: result.query,
        results: result.chunks.map((c) => ({
          documentId: c.docId,
          title: c.title,
          filename: c.filename,
          excerpt: c.text.slice(0, 500),
          score: Number(c.score.toFixed(4)),
          citation: c.citation,
          page: c.page,
          section: c.section,
          scopes: c.scopes,
        })),
        sources: result.sources,
      });
    }

    if (q.trim()) {
      const docs = await searchKnowledgeMeta(db, q, 50);
      const withScopes = await Promise.all(
        docs.map(async (d) => ({ ...d, scopes: await listDocScopes(db, d.id) })),
      );
      return Response.json({ ok: true, knowledge: withScopes });
    }

    const docs = await listKnowledge(db, {
      projectId,
      status: status as never,
      includeArchived: url.searchParams.get('includeArchived') === '1',
    });
    const withScopes = await Promise.all(
      docs.map(async (d) => ({ ...d, scopes: await listDocScopes(db, d.id) })),
    );
    return Response.json({ ok: true, knowledge: withScopes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list knowledge.';
    return jsonError(msg, 500);
  }
}

export async function POST(request: Request) {
  const { db, error } = await requireDb();
  if (error) return error;

  const contentType = request.headers.get('content-type') || '';
  const { env, waitUntil } = await cfWaitUntil();
  const embEnv = embeddingEnvFrom(env);

  try {
    if (contentType.includes('multipart/form-data')) {
      return handleMultipart(db, request, embEnv, waitUntil);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body.', 400);
    }

    const {
      title,
      filename,
      mime,
      size,
      attachmentId,
      projectId,
      excerpt,
      scopes,
    } = (body ?? {}) as {
      title?: string;
      filename?: string;
      mime?: string;
      size?: number;
      attachmentId?: string;
      projectId?: string | null;
      excerpt?: string;
      scopes?: unknown;
    };

    // Chat → Knowledge / attachment link: process through the same pipeline
    if (attachmentId) {
      const allowTestEmbeddings = embEnv.EMBEDDING_FORCE_DETERMINISTIC?.trim() === '1';
      if (!hasProductionEmbeddingConfig(embEnv) && !allowTestEmbeddings) {
        return jsonError(
          'Knowledge indexing requires a production embedding provider (EMBEDDING_PROVIDER=cloudflare-ai or openai-compatible).',
          503,
        );
      }
      const att = await resolveAttachment(attachmentId, db);
      if (!att) return jsonError('Attachment not found.', 404);
      const scopeList = normalizeScopeInputs(scopes);
      const { doc } = await ingestAttachmentAsKnowledge(db, embEnv, {
        attachmentId,
        title: title || att.filename,
        filename: att.filename,
        mime: att.mime,
        size: att.size,
        projectId: projectId ?? null,
        scopes: scopeList.length ? scopeList : [{ scope_kind: 'shared' }],
      });
      // Await indexing so we never report success when embeddings fail.
      const processed = await runKnowledgePipeline(db, doc.id, embEnv);
      const scopesOut = await listDocScopes(db, processed.id);
      if (processed.status !== 'ready') {
        return Response.json(
          {
            ok: false,
            error: processed.error_message || 'Knowledge indexing failed.',
            knowledge: { ...processed, scopes: scopesOut },
          },
          { status: 422 },
        );
      }
      return Response.json(
        { ok: true, knowledge: { ...processed, scopes: scopesOut } },
        { status: 201 },
      );
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return jsonError('title is required.', 400);
    }
    if (!filename) {
      return jsonError('filename is required when no attachmentId is provided.', 400);
    }

    const doc = await createKnowledge(db, {
      title,
      filename: filename || title,
      mime: mime || 'application/octet-stream',
      size: size ?? 0,
      attachmentId: null,
      projectId: projectId ?? null,
      excerpt: excerpt ?? '',
      status: 'unindexed',
      scopes: normalizeScopeInputs(scopes),
    });

    const scopesOut = await listDocScopes(db, doc.id);
    return Response.json(
      { ok: true, knowledge: { ...doc, scopes: scopesOut } },
      { status: 201 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create knowledge.';
    return jsonError(msg, 500);
  }
}

async function handleMultipart(
  db: D1Database,
  request: Request,
  embEnv: ReturnType<typeof embeddingEnvFrom>,
  waitUntil?: (p: Promise<unknown>) => void,
) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Invalid multipart body.', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return jsonError('file is required.', 400);
  }

  const check = validateKnowledgeUpload({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (!check.ok) return jsonError(check.error, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = putAttachment({
    filename: file.name.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 120),
    mime: file.type || 'application/octet-stream',
    format: 'upload',
    bytes,
  });

  const attachmentsDb = (await getAttachmentsDb()) ?? db;
  await persistAttachmentBestEffort(attachmentsDb, meta);

  const title =
    String(form.get('title') || '').trim() ||
    meta.filename.replace(/\.[^.]+$/, '') ||
    'Untitled';
  const projectId = String(form.get('projectId') || '').trim() || null;

  let scopesRaw: unknown = [];
  const scopesField = form.get('scopes');
  if (typeof scopesField === 'string' && scopesField.trim()) {
    try {
      scopesRaw = JSON.parse(scopesField);
    } catch {
      scopesRaw = [];
    }
  }
  const botSlug = String(form.get('botSlug') || '').trim();
  const scopeShared = String(form.get('scope') || '').trim().toLowerCase();
  if (Array.isArray(scopesRaw) && scopesRaw.length === 0) {
    if (scopeShared === 'shared' || !botSlug && !projectId) {
      scopesRaw = [{ scope_kind: 'shared' }];
    } else if (botSlug) {
      scopesRaw = [{ scope_kind: 'bot', bot_slug: botSlug }];
    } else if (projectId) {
      scopesRaw = [{ scope_kind: 'project', project_id: projectId }];
    }
  }

  const allowTestEmbeddings = embEnv.EMBEDDING_FORCE_DETERMINISTIC?.trim() === '1';
  if (!hasProductionEmbeddingConfig(embEnv) && !allowTestEmbeddings) {
    return jsonError(
      'Knowledge indexing requires a production embedding provider (EMBEDDING_PROVIDER=cloudflare-ai or openai-compatible).',
      503,
    );
  }

  const { doc } = await ingestAttachmentAsKnowledge(db, embEnv, {
    attachmentId: meta.id,
    title,
    filename: meta.filename,
    mime: meta.mime,
    size: meta.size,
    projectId,
    scopes: normalizeScopeInputs(scopesRaw),
  });

  // Await indexing so clients never see ok:true / READY when embeddings failed.
  const processed = await runKnowledgePipeline(db, doc.id, embEnv);
  const scopesOut = await listDocScopes(db, processed.id);

  if (processed.status !== 'ready') {
    return Response.json(
      {
        ok: false,
        error: processed.error_message || 'Knowledge indexing failed.',
        knowledge: { ...processed, scopes: scopesOut },
        attachment: { id: meta.id, url: `/api/attachments/${meta.id}` },
      },
      { status: 422 },
    );
  }

  return Response.json(
    {
      ok: true,
      knowledge: { ...processed, scopes: scopesOut },
      attachment: { id: meta.id, url: `/api/attachments/${meta.id}` },
    },
    { status: 201 },
  );
}
