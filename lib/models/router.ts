/**
 * Thin provider-neutral model router.
 * Tiers map to existing factories — no automatic fallback.
 *
 * Registered smart providers (via SMART_PROVIDER):
 * - (default) NVIDIA NIM
 * - nebius
 * - pareto | cloudflare-pareto | cloudflare  → unbiased/pareto
 */
import { fastModel } from './groq';
import { isParetoProvider, PARETO_MODEL_ID } from './pareto';
import { smartModel, type SmartModelEnv } from './smart';

export type ModelTier = 'fast' | 'reasoning' | 'code';

export type FastModelEnv = {
  GROQ_API_KEY: string;
  GROQ_FAST_MODEL?: string;
};

export type { SmartModelEnv };

export function resolveModel(tier: ModelTier, env: FastModelEnv | SmartModelEnv) {
  switch (tier) {
    case 'fast':
      return fastModel(env as FastModelEnv);
    case 'reasoning':
      return smartModel(env as SmartModelEnv);
    case 'code':
      throw new Error('Code model not configured');
    default: {
      const _exhaustive: never = tier;
      throw new Error(`Unknown model tier: ${String(_exhaustive)}`);
    }
  }
}

/** Which smart-tier backend label is active (for settings / tests). */
export function resolveSmartProviderLabel(env: Pick<SmartModelEnv, 'SMART_PROVIDER'>): string {
  if (isParetoProvider(env.SMART_PROVIDER)) return `cloudflare · ${PARETO_MODEL_ID}`;
  if (env.SMART_PROVIDER === 'nebius') return 'nebius';
  return 'nvidia-nim';
}
