import {
  archiveKnowledge,
  deleteKnowledge,
  getKnowledge,
  listDocScopes,
  replaceDocScopes,
  updateKnowledge,
} from '@/lib/db/knowledge';
import { jsonError, requireDb } from '@/lib/api/shell';
import { normalizeScopeInputs } from '@/lib/knowledge/permissions';
import { runKnowledgePipeline, scheduleKnowledgePipeline } from '@/lib/knowledge/pipeline';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

function embeddingEnv() {
  return {
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    EMBEDDING_BASE_URL: process.env.EMBEDDING_BASE_URL,
    EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY,
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_EMBEDDING_MODEL: process.env.CLOUDFLARE_EMBEDDING_MODEL,
    EMBEDDING_FORCE_DETERMINISTIC: process.env.EMBEDDING_FORCE_DETERMINISTIC,
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const { db, error } = await requireDb();
  if (error) return error;
  const { id } = await ctx.params;

  try {
    const doc = await getKnowledge(db, id);
    if (!doc) return jsonError('Knowledge document not found.', 404);
    const scopes = await listDocScopes(db, id);
    return Response.json({ ok: true, knowledge: { ...doc, scopes } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load knowledge.';
    return jsonError(msg, 500);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { db, error } = await requireDb();
  if (error) return error;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const {
    title,
    scopes,
    archived,
    projectId,
    reindex,
  } = (body ?? {}) as {
    title?: string;
    scopes?: unknown;
    archived?: boolean;
    projectId?: string | null;
    reindex?: boolean;
  };

  try {
    const existing = await getKnowledge(db, id);
    if (!existing) return jsonError('Knowledge document not found.', 404);

    if (scopes) {
      await replaceDocScopes(db, id, normalizeScopeInputs(scopes));
    }

    if (archived === true) {
      await archiveKnowledge(db, id);
    } else if (archived === false) {
      await updateKnowledge(db, id, {
        archived: false,
        status: existing.status === 'archived' ? 'unindexed' : existing.status,
      });
    }

    if (title != null || projectId !== undefined) {
      await updateKnowledge(db, id, {
        title,
        project_id: projectId,
      });
    }

    if (reindex) {
      let waitUntil: ((p: Promise<unknown>) => void) | undefined;
      let env = embeddingEnv();
      try {
        const cf = await getCloudflareContext({ async: true });
        waitUntil = cf.ctx?.waitUntil?.bind(cf.ctx);
        env = {
          EMBEDDING_PROVIDER:
            (cf.env as { EMBEDDING_PROVIDER?: string }).EMBEDDING_PROVIDER || env.EMBEDDING_PROVIDER,
          EMBEDDING_BASE_URL:
            (cf.env as { EMBEDDING_BASE_URL?: string }).EMBEDDING_BASE_URL || env.EMBEDDING_BASE_URL,
          EMBEDDING_API_KEY:
            (cf.env as { EMBEDDING_API_KEY?: string }).EMBEDDING_API_KEY || env.EMBEDDING_API_KEY,
          EMBEDDING_MODEL:
            (cf.env as { EMBEDDING_MODEL?: string }).EMBEDDING_MODEL || env.EMBEDDING_MODEL,
          CLOUDFLARE_ACCOUNT_ID:
            (cf.env as { CLOUDFLARE_ACCOUNT_ID?: string }).CLOUDFLARE_ACCOUNT_ID ||
            env.CLOUDFLARE_ACCOUNT_ID,
          CLOUDFLARE_API_TOKEN:
            (cf.env as { CLOUDFLARE_API_TOKEN?: string }).CLOUDFLARE_API_TOKEN ||
            env.CLOUDFLARE_API_TOKEN,
          CLOUDFLARE_EMBEDDING_MODEL:
            (cf.env as { CLOUDFLARE_EMBEDDING_MODEL?: string }).CLOUDFLARE_EMBEDDING_MODEL ||
            env.CLOUDFLARE_EMBEDDING_MODEL,
          EMBEDDING_FORCE_DETERMINISTIC: env.EMBEDDING_FORCE_DETERMINISTIC,
        };
      } catch {
        /* local */
      }
      if (waitUntil) {
        scheduleKnowledgePipeline(db, id, env, waitUntil);
      } else {
        await runKnowledgePipeline(db, id, env);
      }
    }

    const doc = await getKnowledge(db, id);
    const scopesOut = await listDocScopes(db, id);
    return Response.json({ ok: true, knowledge: { ...doc, scopes: scopesOut } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update knowledge.';
    return jsonError(msg, 500);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { db, error } = await requireDb();
  if (error) return error;
  const { id } = await ctx.params;

  try {
    const existing = await getKnowledge(db, id);
    if (!existing) return jsonError('Knowledge document not found.', 404);
    await deleteKnowledge(db, id);
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete knowledge.';
    return jsonError(msg, 500);
  }
}
