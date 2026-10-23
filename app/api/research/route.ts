import { jsonError, requireDb } from '@/lib/api/shell';
import { listResearchJobs } from '@/lib/db/research';
import { runResearchPipeline } from '@/lib/research/workflow';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'nodejs';

function researchEnv(env: Record<string, unknown>) {
  const g = (k: string) => String(env[k] || process.env[k] || '');
  return {
    WEB_SEARCH_PROVIDER: g('WEB_SEARCH_PROVIDER'),
    TAVILY_API_KEY: g('TAVILY_API_KEY'),
    SERPER_API_KEY: g('SERPER_API_KEY'),
    BRAVE_SEARCH_API_KEY: g('BRAVE_SEARCH_API_KEY'),
    SEARXNG_BASE_URL: g('SEARXNG_BASE_URL'),
    WEB_SEARCH_FORCE_MOCK: g('WEB_SEARCH_FORCE_MOCK'),
    RESEARCH_SYNTH_STUB: g('RESEARCH_SYNTH_STUB'),
    // Analyst (smart tier) — existing model stack
    SMART_PROVIDER: g('SMART_PROVIDER'),
    NVIDIA_API_KEY: g('NVIDIA_API_KEY'),
    NVIDIA_SMART_MODEL: g('NVIDIA_SMART_MODEL'),
    NEBIUS_API_KEY: g('NEBIUS_API_KEY'),
    NEBIUS_BASE_URL: g('NEBIUS_BASE_URL'),
    NEBIUS_SMART_MODEL: g('NEBIUS_SMART_MODEL'),
    CLOUDFLARE_API_TOKEN: g('CLOUDFLARE_API_TOKEN'),
    CLOUDFLARE_ACCOUNT_ID: g('CLOUDFLARE_ACCOUNT_ID'),
    CLOUDFLARE_PARETO_MODEL: g('CLOUDFLARE_PARETO_MODEL'),
    CLOUDFLARE_AI_TIMEOUT_MS: g('CLOUDFLARE_AI_TIMEOUT_MS'),
    HARVYX_H100_BASE_URL: g('HARVYX_H100_BASE_URL'),
    HARVYX_H100_MODEL: g('HARVYX_H100_MODEL'),
    HARVYX_H100_API_KEY: g('HARVYX_H100_API_KEY'),
    GROQ_API_KEY: g('GROQ_API_KEY'),
    GROQ_FAST_MODEL: g('GROQ_FAST_MODEL'),
    // Embeddings (not used by pipeline fetch; used if tools share env)
    EMBEDDING_PROVIDER: g('EMBEDDING_PROVIDER'),
    EMBEDDING_BASE_URL: g('EMBEDDING_BASE_URL'),
    EMBEDDING_API_KEY: g('EMBEDDING_API_KEY'),
    EMBEDDING_MODEL: g('EMBEDDING_MODEL'),
    CLOUDFLARE_EMBEDDING_MODEL: g('CLOUDFLARE_EMBEDDING_MODEL'),
    EMBEDDING_FORCE_DETERMINISTIC: g('EMBEDDING_FORCE_DETERMINISTIC'),
  };
}

async function cf() {
  try {
    const { env, ctx } = await getCloudflareContext({ async: true });
    return {
      env: env as unknown as Record<string, unknown>,
      waitUntil: ctx?.waitUntil?.bind(ctx) as ((p: Promise<unknown>) => void) | undefined,
    };
  } catch {
    return { env: process.env as unknown as Record<string, unknown> };
  }
}

export async function GET() {
  const { db, error } = await requireDb();
  if (error) return error;
  try {
    const jobs = await listResearchJobs(db, 40);
    return Response.json({ ok: true, research: jobs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list research.';
    return jsonError(msg, 500);
  }
}

export async function POST(request: Request) {
  const { db, error } = await requireDb();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const { query, maxSources, projectId } = (body ?? {}) as {
    query?: string;
    maxSources?: number;
    projectId?: string | null;
  };
  if (!query?.trim()) return jsonError('query is required.', 400);

  try {
    const { env } = await cf();
    const bundle = await runResearchPipeline(db, researchEnv(env), {
      query: query.trim(),
      maxSources,
      projectId: projectId ?? null,
    });
    return Response.json(
      {
        ok: bundle.job.status === 'complete',
        research: bundle.job,
        sources: bundle.sources,
        citations: bundle.citations,
        evidencePack: bundle.evidencePack,
      },
      { status: bundle.job.status === 'failed' ? 502 : 201 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Research failed.';
    return jsonError(msg, 500);
  }
}
