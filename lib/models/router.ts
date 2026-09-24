/**
 * Thin provider-neutral model router.
 * Tiers map to existing factories — no automatic fallback.
 *
 * Registered smart providers (via SMART_PROVIDER):
 * - (default) NVIDIA NIM
 * - nebius
 * - pareto | cloudflare-pareto | cloudflare  → unbiased/pareto
 * - local_h100                               → HARVYX H100 (opt-in)
 *
 * Explicit provider override (per agent, opt-in):
 * - resolveModel(tier, env, { provider: 'local_h100' }) bypasses the tier's
 *   default backend. Omitting `provider` keeps current behaviour exactly.
 */
import { fastModel } from './groq';
import { isParetoProvider, PARETO_MODEL_ID } from './pareto';
import { smartModel, type SmartModelEnv } from './smart';
import {
  isLocalH100Provider,
  LOCAL_H100_PROVIDER,
  localH100Model,
  type LocalH100Env,
} from './local-h100';

export type ModelTier = 'fast' | 'reasoning' | 'code';

/** Providers that can be selected explicitly, overriding a tier's default backend. */
export type ExplicitProvider = typeof LOCAL_H100_PROVIDER;

export type ResolveModelOptions = {
  provider?: ExplicitProvider;
};

export type FastModelEnv = {
  GROQ_API_KEY: string;
  GROQ_FAST_MODEL?: string;
};

export type { SmartModelEnv, LocalH100Env };

export function resolveModel(
  tier: ModelTier,
  env: FastModelEnv | SmartModelEnv,
  options: ResolveModelOptions = {},
) {
  if (options.provider !== undefined) {
    if (isLocalH100Provider(options.provider)) return localH100Model(env as LocalH100Env);
    throw new Error(`Unknown explicit model provider: ${String(options.provider)}`);
  }

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

/**
 * Manager backend selection. Unset / '' / 'groq' → current Groq path (default).
 * 'local_h100' → H100. Anything else is a misconfiguration and throws.
 */
export type ManagerProvider = 'groq' | ExplicitProvider;

export function resolveManagerProvider(value: string | undefined): ManagerProvider {
  const v = value?.trim().toLowerCase();
  if (!v || v === 'groq') return 'groq';
  if (isLocalH100Provider(v)) return LOCAL_H100_PROVIDER;
  throw new Error(`Unknown MANAGER_PROVIDER: ${value}`);
}

/** Which smart-tier backend label is active (for settings / tests). */
export function resolveSmartProviderLabel(env: Pick<SmartModelEnv, 'SMART_PROVIDER'>): string {
  if (isParetoProvider(env.SMART_PROVIDER)) return `cloudflare · ${PARETO_MODEL_ID}`;
  if (isLocalH100Provider(env.SMART_PROVIDER)) return LOCAL_H100_PROVIDER;
  if (env.SMART_PROVIDER === 'nebius') return 'nebius';
  return 'nvidia-nim';
}

/** Provider id used in specialist logs. Existing values are unchanged. */
export function resolveSmartProviderLogId(env: Pick<SmartModelEnv, 'SMART_PROVIDER'>): string {
  if (env.SMART_PROVIDER === 'nebius') return 'nebius';
  if (isParetoProvider(env.SMART_PROVIDER)) return 'cloudflare-pareto';
  if (isLocalH100Provider(env.SMART_PROVIDER)) return LOCAL_H100_PROVIDER;
  return 'nvidia';
}
