import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

/** Exact model id from Cloudflare AI docs — do not rewrite to @cf/... */
export const PARETO_MODEL_ID = 'unbiased/pareto';

export interface ParetoModelEnv {
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  /** Optional override; default unbiased/pareto */
  CLOUDFLARE_PARETO_MODEL?: string;
  /** Optional request timeout ms (default 60s, max 120s) */
  CLOUDFLARE_AI_TIMEOUT_MS?: string;
}

function accountBaseUrl(accountId: string): string {
  const id = accountId.trim();
  if (!id || id.includes('/') || id.includes('..')) {
    throw new Error('Invalid CLOUDFLARE_ACCOUNT_ID');
  }
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(id)}/ai/v1`;
}

function timeoutMs(env: ParetoModelEnv): number {
  const n = Number(env.CLOUDFLARE_AI_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 1000 ? Math.min(n, 120_000) : 60_000;
}

/**
 * Cloudflare AI (Unbiased Pareto) via OpenAI-compatible chat completions.
 * Server-side only — token must never reach the client.
 *
 * POST {base}/chat/completions
 * Authorization: Bearer CLOUDFLARE_API_TOKEN
 * model: unbiased/pareto
 */
export function paretoModel(env: ParetoModelEnv) {
  if (!env.CLOUDFLARE_API_TOKEN?.trim()) {
    throw new Error('CLOUDFLARE_API_TOKEN is required when SMART_PROVIDER=pareto');
  }
  if (!env.CLOUDFLARE_ACCOUNT_ID?.trim()) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is required when SMART_PROVIDER=pareto');
  }

  const ms = timeoutMs(env);
  const cf = createOpenAICompatible({
    name: 'cloudflare-pareto',
    baseURL: accountBaseUrl(env.CLOUDFLARE_ACCOUNT_ID),
    apiKey: env.CLOUDFLARE_API_TOKEN,
    fetch: async (input, init) => {
      const external = init?.signal;
      const timer = AbortSignal.timeout(ms);
      const signal =
        external && typeof AbortSignal.any === 'function'
          ? AbortSignal.any([timer, external])
          : timer;
      return fetch(input, { ...init, signal });
    },
  });

  return cf.chatModel(env.CLOUDFLARE_PARETO_MODEL?.trim() || PARETO_MODEL_ID);
}

/** Pure registration helpers for tests / settings (no network). */
export function isParetoProvider(smartProvider?: string): boolean {
  const p = (smartProvider || '').trim().toLowerCase();
  return p === 'pareto' || p === 'cloudflare-pareto' || p === 'cloudflare';
}

export function resolveParetoModelId(override?: string): string {
  const id = (override || '').trim();
  return id || PARETO_MODEL_ID;
}
