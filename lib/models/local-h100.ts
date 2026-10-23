import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

/**
 * local_h100 — HARVYX's own H100 (vLLM, OpenAI-compatible) behind Cloudflare Tunnel.
 *
 * Opt-in only. Never a default:
 *  - Smart tier (Analyst/Social): SMART_PROVIDER=local_h100
 *  - Manager:                     MANAGER_PROVIDER=local_h100
 *
 * Endpoint and model come from env only — no URLs or model ids in app logic.
 */
export const LOCAL_H100_PROVIDER = 'local_h100' as const;

export interface LocalH100Env {
  HARVYX_H100_BASE_URL?: string;
  HARVYX_H100_MODEL?: string;
  /** Optional bearer token, for when the endpoint is put behind auth. */
  HARVYX_H100_API_KEY?: string;
  /** Qwen3 chat-template thinking. 'true' enables it; anything else = off (default). */
  HARVYX_H100_ENABLE_THINKING?: string;
}

export function isLocalH100Provider(value: string | undefined): boolean {
  return value?.trim() === LOCAL_H100_PROVIDER;
}

export interface LocalH100Config {
  baseURL: string;
  modelId: string;
  apiKey?: string;
  enableThinking: boolean;
}

export function resolveLocalH100Config(env: LocalH100Env): LocalH100Config {
  const baseURL = env.HARVYX_H100_BASE_URL?.trim().replace(/\/+$/, '');
  const modelId = env.HARVYX_H100_MODEL?.trim();
  if (!baseURL) throw new Error('HARVYX_H100_BASE_URL is required when using local_h100');
  if (!modelId) throw new Error('HARVYX_H100_MODEL is required when using local_h100');
  return {
    baseURL,
    modelId,
    apiKey: env.HARVYX_H100_API_KEY?.trim() || undefined,
    enableThinking: env.HARVYX_H100_ENABLE_THINKING?.trim().toLowerCase() === 'true',
  };
}

/**
 * Injects vLLM `chat_template_kwargs` into every chat-completions body.
 * Done at the fetch layer so it is independent of SDK provider-option plumbing.
 */
function withChatTemplateKwargs(kwargs: Record<string, unknown>): typeof fetch {
  return async (input, init) => {
    if (init?.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        const existing = (body.chat_template_kwargs ?? {}) as Record<string, unknown>;
        body.chat_template_kwargs = { ...kwargs, ...existing };
        init = { ...init, body: JSON.stringify(body) };
      } catch {
        // Non-JSON body: pass through untouched.
      }
    }
    return fetch(input, init);
  };
}

export function localH100Model(env: LocalH100Env) {
  const cfg = resolveLocalH100Config(env);
  const provider = createOpenAICompatible({
    name: LOCAL_H100_PROVIDER,
    baseURL: cfg.baseURL,
    apiKey: cfg.apiKey,
    includeUsage: true,
    fetch: withChatTemplateKwargs({ enable_thinking: cfg.enableThinking }),
  });
  return provider.chatModel(cfg.modelId);
}
