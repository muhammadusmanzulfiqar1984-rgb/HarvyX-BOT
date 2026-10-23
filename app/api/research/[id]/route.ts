import { jsonError, requireDb } from '@/lib/api/shell';
import { getResearchBundle } from '@/lib/research/workflow';
import { saveResearchToKnowledge } from '@/lib/research/save-to-knowledge';
import { normalizeScopeInputs } from '@/lib/knowledge/permissions';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

function embEnv(env: Record<string, unknown>) {
  return {
    EMBEDDING_PROVIDER: String(env.EMBEDDING_PROVIDER || process.env.EMBEDDING_PROVIDER || ''),
    EMBEDDING_BASE_URL: String(env.EMBEDDING_BASE_URL || process.env.EMBEDDING_BASE_URL || ''),
    EMBEDDING_API_KEY: String(env.EMBEDDING_API_KEY || process.env.EMBEDDING_API_KEY || ''),
    EMBEDDING_MODEL: String(env.EMBEDDING_MODEL || process.env.EMBEDDING_MODEL || ''),
    CLOUDFLARE_ACCOUNT_ID: String(env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || ''),
    CLOUDFLARE_API_TOKEN: String(env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || ''),
    CLOUDFLARE_EMBEDDING_MODEL: String(
      env.CLOUDFLARE_EMBEDDING_MODEL || process.env.CLOUDFLARE_EMBEDDING_MODEL || '',
    ),
    EMBEDDING_FORCE_DETERMINISTIC: String(
      env.EMBEDDING_FORCE_DETERMINISTIC || process.env.EMBEDDING_FORCE_DETERMINISTIC || '',
    ),
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const { db, error } = await requireDb();
  if (error) return error;
  const { id } = await ctx.params;
  try {
    const bundle = await getResearchBundle(db, id);
    if (!bundle) return jsonError('Research job not found.', 404);
    return Response.json({
      ok: true,
      research: bundle.job,
      sources: bundle.sources,
      citations: bundle.citations,
      evidencePack: bundle.evidencePack,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load research.';
    return jsonError(msg, 500);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const { db, error } = await requireDb();
  if (error) return error;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const { action, scopes, title } = (body ?? {}) as {
    action?: string;
    scopes?: unknown;
    title?: string;
  };

  if (action !== 'save-to-knowledge') {
    return jsonError('Unsupported action. Use action=save-to-knowledge.', 400);
  }

  try {
    let env: Record<string, unknown> = process.env as unknown as Record<string, unknown>;
    let waitUntil: ((p: Promise<unknown>) => void) | undefined;
    try {
      const cf = await getCloudflareContext({ async: true });
      env = cf.env as unknown as Record<string, unknown>;
      waitUntil = cf.ctx?.waitUntil?.bind(cf.ctx);
    } catch {
      /* local */
    }

    const result = await saveResearchToKnowledge(db, embEnv(env), {
      jobId: id,
      title,
      scopes: normalizeScopeInputs(scopes ?? [{ scope_kind: 'shared' }]),
      waitUntil,
    });
    if (!result.ok) return jsonError(result.error, 400);
    const bundle = await getResearchBundle(db, id);
    return Response.json({
      ok: true,
      knowledgeId: result.knowledgeId,
      attachmentId: result.attachmentId || undefined,
      research: bundle?.job,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed.';
    return jsonError(msg, 500);
  }
}
