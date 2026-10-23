/**
 * Embedding provider abstraction.
 * Configured via env — never hard-codes a single vendor. Never uses HARVYX H100 / Qwen.
 */

import { createHash } from 'node:crypto';

export type EmbeddingEnv = {
  EMBEDDING_PROVIDER?: string;
  EMBEDDING_BASE_URL?: string;
  EMBEDDING_API_KEY?: string;
  EMBEDDING_MODEL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_EMBEDDING_MODEL?: string;
  /** Test-only: force deterministic embeddings. Never set in production. */
  EMBEDDING_FORCE_DETERMINISTIC?: string;
};

export type EmbeddingProvider = {
  id: string;
  model: string;
  dims: number;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
};

const MISSING_EMBEDDING_CONFIG =
  'No production embedding provider configured. ' +
  'Set EMBEDDING_PROVIDER=openai-compatible with EMBEDDING_BASE_URL, EMBEDDING_API_KEY, EMBEDDING_MODEL; ' +
  'or EMBEDDING_PROVIDER=cloudflare-ai with CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN ' +
  '(optional CLOUDFLARE_EMBEDDING_MODEL=@cf/baai/bge-base-en-v1.5). ' +
  'Deterministic embeddings are test-only (EMBEDDING_FORCE_DETERMINISTIC=1). ' +
  'H100/Qwen must never be used for embeddings.';

/** True when a real (non-deterministic) embedding provider can be resolved. */
export function hasProductionEmbeddingConfig(env: EmbeddingEnv): boolean {
  if (env.EMBEDDING_FORCE_DETERMINISTIC?.trim() === '1') return false;
  const provider = (env.EMBEDDING_PROVIDER || '').trim().toLowerCase();
  if (provider === 'deterministic') return false;
  if (
    provider === 'openai-compatible' ||
    provider === 'openai' ||
    (env.EMBEDDING_BASE_URL?.trim() && env.EMBEDDING_API_KEY?.trim())
  ) {
    return Boolean(env.EMBEDDING_BASE_URL?.trim() && env.EMBEDDING_API_KEY?.trim());
  }
  if (provider === 'cloudflare-ai' || provider === 'workers-ai') {
    return Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_API_TOKEN?.trim());
  }
  if (!provider) {
    if (env.EMBEDDING_BASE_URL?.trim() && env.EMBEDDING_API_KEY?.trim()) return true;
    if (env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_API_TOKEN?.trim()) return true;
  }
  return false;
}

export function resolveEmbeddingProvider(env: EmbeddingEnv): EmbeddingProvider {
  const forced =
    env.EMBEDDING_FORCE_DETERMINISTIC?.trim() === '1' ||
    env.EMBEDDING_PROVIDER?.trim().toLowerCase() === 'deterministic';
  if (forced) return deterministicProvider();

  const provider = (env.EMBEDDING_PROVIDER || '').trim().toLowerCase();

  if (provider === 'openai-compatible' || provider === 'openai') {
    return openaiCompatibleProvider(env);
  }
  if (provider === 'cloudflare-ai' || provider === 'workers-ai') {
    return cloudflareAiProvider(env);
  }
  if (provider === 'deterministic') {
    return deterministicProvider();
  }
  if (provider) {
    throw new Error(
      `Unknown EMBEDDING_PROVIDER="${provider}". Use openai-compatible or cloudflare-ai. ` +
        'Deterministic is test-only via EMBEDDING_FORCE_DETERMINISTIC=1. H100/Qwen are not embedding providers.',
    );
  }

  // Auto-select: prefer explicit OpenAI-compatible config, then Cloudflare AI token.
  if (env.EMBEDDING_BASE_URL?.trim() && env.EMBEDDING_API_KEY?.trim()) {
    return openaiCompatibleProvider(env);
  }
  if (env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_API_TOKEN?.trim()) {
    return cloudflareAiProvider(env);
  }

  throw new Error(MISSING_EMBEDDING_CONFIG);
}

function openaiCompatibleProvider(env: EmbeddingEnv): EmbeddingProvider {
  const baseURL = (env.EMBEDDING_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (env.EMBEDDING_API_KEY || '').trim();
  const model = (env.EMBEDDING_MODEL || 'text-embedding-3-small').trim();
  if (!baseURL) throw new Error('EMBEDDING_BASE_URL is required for openai-compatible embeddings.');
  if (!apiKey) throw new Error('EMBEDDING_API_KEY is required for openai-compatible embeddings.');

  let dims = 0;

  async function embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const url = `${baseURL}/embeddings`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: texts }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Embedding API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      data?: Array<{ embedding?: number[]; index?: number }>;
    };
    const rows = [...(data.data || [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const vectors = rows.map((r) => r.embedding || []);
    if (vectors.some((v) => !v.length)) throw new Error('Embedding API returned empty vectors.');
    dims = vectors[0]!.length;
    return vectors;
  }

  return {
    id: 'openai-compatible',
    model,
    get dims() {
      return dims;
    },
    embedDocuments: embed,
    embedQuery: async (text) => (await embed([text]))[0]!,
  };
}

function cloudflareAiProvider(env: EmbeddingEnv): EmbeddingProvider {
  const accountId = (env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const token = (env.CLOUDFLARE_API_TOKEN || '').trim();
  const model = (
    env.CLOUDFLARE_EMBEDDING_MODEL ||
    env.EMBEDDING_MODEL ||
    '@cf/baai/bge-base-en-v1.5'
  ).trim();
  if (!accountId || !token) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN required for cloudflare-ai embeddings.');
  }

  let dims = 0;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  async function embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const out: number[][] = [];
    for (const text of texts) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: [text] }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Cloudflare AI embedding ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        result?: { data?: number[][] } | number[][];
        data?: number[][];
      };
      const vectors =
        (data.result && !Array.isArray(data.result) ? data.result.data : undefined) ||
        (Array.isArray(data.result) ? data.result : undefined) ||
        data.data ||
        [];
      const vec = vectors[0];
      if (!vec?.length) throw new Error('Cloudflare AI returned empty embedding.');
      dims = vec.length;
      out.push(vec);
    }
    return out;
  }

  return {
    id: 'cloudflare-ai',
    model,
    get dims() {
      return dims;
    },
    embedDocuments: embed,
    embedQuery: async (text) => (await embed([text]))[0]!,
  };
}

/** Offline / test provider — deterministic pseudo-embeddings. Not for production READY claims. */
export function deterministicProvider(dims = 64): EmbeddingProvider {
  function embedOne(text: string): number[] {
    const vec = new Array<number>(dims).fill(0);
    const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    for (const tok of tokens) {
      const h = createHash('sha256').update(tok).digest();
      for (let i = 0; i < dims; i++) {
        vec[i]! += ((h[i % h.length]! / 255) * 2 - 1) / Math.sqrt(tokens.length || 1);
      }
    }
    let n = 0;
    for (const v of vec) n += v * v;
    n = Math.sqrt(n) || 1;
    return vec.map((v) => v / n);
  }

  return {
    id: 'deterministic',
    model: `deterministic-${dims}`,
    dims,
    embedDocuments: async (texts) => texts.map(embedOne),
    embedQuery: async (text) => embedOne(text),
  };
}

export async function embedDocuments(
  env: EmbeddingEnv,
  texts: string[],
): Promise<{ vectors: number[][]; provider: EmbeddingProvider }> {
  const provider = resolveEmbeddingProvider(env);
  const vectors = await provider.embedDocuments(texts);
  return { vectors, provider };
}

export async function embedQuery(
  env: EmbeddingEnv,
  text: string,
): Promise<{ vector: number[]; provider: EmbeddingProvider }> {
  const provider = resolveEmbeddingProvider(env);
  const vector = await provider.embedQuery(text);
  return { vector, provider };
}
