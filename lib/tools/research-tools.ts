/**
 * Agent tools: webSearch + saveResearchToKnowledge (+ runResearch helper tool).
 */

import { tool } from 'ai';
import { z } from 'zod';
import { webSearch, type WebSearchEnv } from '@/lib/research/search/provider';
import { runResearchPipeline, getResearchBundle } from '@/lib/research/workflow';
import { saveResearchToKnowledge } from '@/lib/research/save-to-knowledge';
import { normalizeScopeInputs } from '@/lib/knowledge/permissions';
import type { EmbeddingEnv } from '@/lib/knowledge/embeddings/provider';

export type ResearchToolEnv = WebSearchEnv &
  EmbeddingEnv & {
    DB?: D1Database;
  };

export type ResearchToolContext = {
  botSlug: string;
  projectId?: string | null;
};

export function webSearchTool(env: WebSearchEnv) {
  return tool({
    description:
      'Search the live web for current external information. Returns real titles, URLs, snippets, and domains from a configured search provider. ' +
      'Use for current events, regulations, market research, competitor pages — NOT for internal Knowledge documents. ' +
      'Never invent URLs. If search fails, say so plainly.',
    inputSchema: z.object({
      query: z.string().min(1).max(500),
      maxResults: z.number().int().min(1).max(15).optional(),
    }),
    execute: async ({ query, maxResults }) => {
      const result = await webSearch(env, query, { maxResults });
      if (!result.ok) {
        return {
          ok: false as const,
          error: result.error,
          provider: result.provider,
          query: result.query,
          results: [] as [],
          notice: 'Do not invent search results or claim a search succeeded.',
        };
      }
      return {
        ok: true as const,
        provider: result.provider,
        query: result.query,
        resultCount: result.results.length,
        results: result.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          domain: r.domain,
          rank: r.rank,
          score: r.score,
        })),
        notice:
          'These are search hits only. Fetch/scrape specific URLs with scrapeUrl or runResearch before asserting page contents.',
      };
    },
  });
}

export function runResearchTool(env: ResearchToolEnv, ctx: ResearchToolContext) {
  return tool({
    description:
      'Run a multi-source research job: web search → scrape top URLs → build an evidence pack with citations. ' +
      'Use when the user asks to research a topic, compare external facts, or investigate something requiring multiple sources. ' +
      'Returns structured sources and an evidence pack for Analyst synthesis. Does not invent facts.',
    inputSchema: z.object({
      query: z.string().min(1).max(500),
      maxSources: z.number().int().min(1).max(8).optional(),
    }),
    execute: async ({ query, maxSources }) => {
      if (!env.DB) {
        return { ok: false as const, error: 'Database unavailable for research jobs.' };
      }
      const bundle = await runResearchPipeline(env.DB, env, {
        query,
        maxSources,
        projectId: ctx.projectId,
        createdBy: ctx.botSlug,
      });
      return {
        ok: bundle.job.status === 'complete',
        jobId: bundle.job.id,
        status: bundle.job.status,
        error: bundle.job.error_message || undefined,
        sourcesFound: bundle.job.sources_found,
        sourcesFetched: bundle.job.sources_fetched,
        sourcesFailed: bundle.job.sources_failed,
        citations: bundle.citations,
        sources: bundle.sources.map((s) => ({
          title: s.page_title || s.title,
          url: s.url,
          domain: s.domain,
          status: s.status,
          error: s.error_message || undefined,
          excerpt: (s.content || s.snippet).slice(0, 400),
        })),
        evidencePack: bundle.evidencePack.slice(0, 24_000),
        notice:
          'Pass evidencePack to Analyst for FACT/SOURCE CLAIM/INFERENCE/UNCERTAINTY analysis. Cite URLs in the final answer. ' +
          'Use saveResearchToKnowledge only after the user explicitly asks to save.',
      };
    },
  });
}

export function saveResearchToKnowledgeTool(env: ResearchToolEnv, ctx: ResearchToolContext) {
  return tool({
    description:
      'Save a COMPLETED research job into persistent Knowledge (chunks + embeddings). ' +
      'ONLY call this when the user explicitly asks to save research to Knowledge. Never auto-save.',
    inputSchema: z.object({
      jobId: z.string().uuid(),
      title: z.string().max(200).optional(),
      scopes: z
        .array(
          z.object({
            scope_kind: z.enum(['shared', 'bot', 'project']),
            bot_slug: z.string().optional(),
            project_id: z.string().optional(),
          }),
        )
        .optional(),
    }),
    execute: async ({ jobId, title, scopes }) => {
      if (!env.DB) {
        return { ok: false as const, error: 'Database unavailable.' };
      }
      // Server-side bot cannot escalate: if scopes omit bot, default to calling bot private or shared
      const normalized = normalizeScopeInputs(scopes ?? [{ scope_kind: 'shared' }]);
      // Prevent saving as another bot unless shared/project — if bot scope present, must match ctx
      for (const s of normalized) {
        if (s.scope_kind === 'bot' && s.bot_slug !== ctx.botSlug && ctx.botSlug !== 'mian') {
          return {
            ok: false as const,
            error: `Bot "${ctx.botSlug}" cannot save knowledge into bot scope "${s.bot_slug}".`,
          };
        }
      }
      const result = await saveResearchToKnowledge(env.DB, env, {
        jobId,
        title,
        scopes: normalized,
      });
      if (!result.ok) return { ok: false as const, error: result.error };
      return {
        ok: true as const,
        knowledgeId: result.knowledgeId,
        notice: 'Document is indexing. It becomes searchable via searchKnowledge when status=READY.',
      };
    },
  });
}

export function getResearchJobTool(env: ResearchToolEnv) {
  return tool({
    description: 'Load a research job by id (status, sources, citations, evidence pack).',
    inputSchema: z.object({ jobId: z.string().uuid() }),
    execute: async ({ jobId }) => {
      if (!env.DB) return { ok: false as const, error: 'Database unavailable.' };
      const bundle = await getResearchBundle(env.DB, jobId);
      if (!bundle) return { ok: false as const, error: 'Not found.' };
      return {
        ok: true as const,
        job: {
          id: bundle.job.id,
          query: bundle.job.query,
          status: bundle.job.status,
          synthesis: bundle.job.synthesis,
          sourcesFetched: bundle.job.sources_fetched,
          sourcesFailed: bundle.job.sources_failed,
          knowledgeDocId: bundle.job.knowledge_doc_id,
        },
        citations: bundle.citations,
        evidencePack: bundle.evidencePack.slice(0, 20_000),
      };
    },
  });
}
