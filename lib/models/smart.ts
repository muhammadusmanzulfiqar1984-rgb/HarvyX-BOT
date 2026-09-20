import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { isParetoProvider, paretoModel, type ParetoModelEnv } from './pareto';

export interface SmartModelEnv {
  SMART_PROVIDER?: string;
  NVIDIA_API_KEY: string;
  NVIDIA_SMART_MODEL?: string;
  NEBIUS_API_KEY?: string;
  NEBIUS_BASE_URL?: string;
  NEBIUS_SMART_MODEL?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_PARETO_MODEL?: string;
  CLOUDFLARE_AI_TIMEOUT_MS?: string;
}

const NVIDIA_NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/**
 * "Smart" tier — backs the Analyst agent. Defaults to NVIDIA NIM;
 * set SMART_PROVIDER=nebius for Nebius, or SMART_PROVIDER=pareto for
 * Cloudflare Unbiased Pareto (unbiased/pareto).
 */
export function smartModel(env: SmartModelEnv) {
  if (isParetoProvider(env.SMART_PROVIDER)) {
    return paretoModel(env as ParetoModelEnv);
  }

  if (env.SMART_PROVIDER === 'nebius') {
    if (!env.NEBIUS_BASE_URL) {
      throw new Error('NEBIUS_BASE_URL is required when SMART_PROVIDER=nebius');
    }
    const nebius = createOpenAICompatible({
      name: 'nebius',
      baseURL: env.NEBIUS_BASE_URL,
      apiKey: env.NEBIUS_API_KEY,
    });
    return nebius.chatModel(env.NEBIUS_SMART_MODEL || 'meta-llama/Llama-3.3-70B-Instruct');
  }

  const nim = createOpenAICompatible({
    name: 'nim',
    baseURL: NVIDIA_NIM_BASE_URL,
    apiKey: env.NVIDIA_API_KEY,
  });
  return nim.chatModel(env.NVIDIA_SMART_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b');
}
