import { createAgentUIStreamResponse } from 'ai';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createManagerAgent, type ManagerUIMessage } from '@/lib/agents/manager';
import { ensureBotRegistrySeeded, getBotDefinition } from '@/lib/bots';
import { getOrCreateConversation, appendMessagesSafe } from '@/lib/db/conversations';
import { logSafe, logSafeError, sanitizeForLog } from '@/lib/observability';
import { resolveManagerProvider } from '@/lib/models/router';

export const runtime = 'nodejs';

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const started = Date.now();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const { messages, conversationId } = (body ?? {}) as {
    messages?: ManagerUIMessage[];
    conversationId?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError('messages must be a non-empty array.', 400);
  }

  if (messages.length > 100) {
    return jsonError('Too many messages in one request.', 400);
  }

  try {
    const { env, ctx } = await getCloudflareContext({ async: true });

    const h100Env = env as {
      HARVYX_H100_BASE_URL?: string;
      HARVYX_H100_MODEL?: string;
      HARVYX_H100_API_KEY?: string;
      HARVYX_H100_ENABLE_THINKING?: string;
      MANAGER_PROVIDER?: string;
    };

    // Local next-dev: merge process.env when Cloudflare bindings omit a key.
    const runtimeEnv = {
      ...env,
      HARVYX_API_KEY: env.HARVYX_API_KEY || process.env.HARVYX_API_KEY || '',
      HARVYX_API_BASE: env.HARVYX_API_BASE || process.env.HARVYX_API_BASE || '',
      GROQ_API_KEY: env.GROQ_API_KEY || process.env.GROQ_API_KEY || '',
      GROQ_FAST_MODEL: env.GROQ_FAST_MODEL || process.env.GROQ_FAST_MODEL,
      NVIDIA_API_KEY: env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY || '',
      NVIDIA_SMART_MODEL: env.NVIDIA_SMART_MODEL || process.env.NVIDIA_SMART_MODEL,
      SMART_PROVIDER: env.SMART_PROVIDER || process.env.SMART_PROVIDER,
      NEBIUS_API_KEY: env.NEBIUS_API_KEY || process.env.NEBIUS_API_KEY,
      NEBIUS_BASE_URL: env.NEBIUS_BASE_URL || process.env.NEBIUS_BASE_URL,
      NEBIUS_SMART_MODEL: env.NEBIUS_SMART_MODEL || process.env.NEBIUS_SMART_MODEL,
      CLOUDFLARE_API_TOKEN: (env as { CLOUDFLARE_API_TOKEN?: string }).CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN,
      CLOUDFLARE_ACCOUNT_ID: (env as { CLOUDFLARE_ACCOUNT_ID?: string }).CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID,
      // local_h100 (opt-in; unset in production = no behaviour change)
      HARVYX_H100_BASE_URL: h100Env.HARVYX_H100_BASE_URL || process.env.HARVYX_H100_BASE_URL,
      HARVYX_H100_MODEL: h100Env.HARVYX_H100_MODEL || process.env.HARVYX_H100_MODEL,
      HARVYX_H100_API_KEY: h100Env.HARVYX_H100_API_KEY || process.env.HARVYX_H100_API_KEY,
      HARVYX_H100_ENABLE_THINKING: h100Env.HARVYX_H100_ENABLE_THINKING || process.env.HARVYX_H100_ENABLE_THINKING,
    };
    const managerProvider = resolveManagerProvider(
      h100Env.MANAGER_PROVIDER || process.env.MANAGER_PROVIDER,
    );

    if (!runtimeEnv.GROQ_API_KEY) {
      logSafe('chat_misconfigured', { operation: 'POST /api/chat', category: 'provider' });
      return jsonError('Chat is not configured (missing model provider key).', 503);
    }

    const conversation = await getOrCreateConversation(env.DB, conversationId);
    // Phase 0: keep Bot records in D1 in sync with canonical definitions (no behavior change).
    await ensureBotRegistrySeeded(env.DB);
    const managerAgent = createManagerAgent(runtimeEnv as typeof env, { provider: managerProvider });
    const managerBot = getBotDefinition('mian');
    logSafe('manager_model', {
      agent: 'Manager',
      bot: managerBot.slug,
      particle: managerBot.visual.particleAgent,
      modelTier: managerBot.modelPolicy.tier,
      operation: 'POST /api/chat',
      provider: managerProvider,
      message:
        managerProvider === 'local_h100'
          ? runtimeEnv.HARVYX_H100_MODEL
          : runtimeEnv.GROQ_FAST_MODEL || 'openai/gpt-oss-120b',
    });

    return createAgentUIStreamResponse({
      agent: managerAgent,
      uiMessages: messages,
      originalMessages: messages,
      generateMessageId: () => crypto.randomUUID(),
      onEnd: ({ messages: finalMessages }) => {
        ctx.waitUntil(
          appendMessagesSafe(env.DB, conversation.id, finalMessages).then((ok) => {
            logSafe(ok ? 'chat_persisted' : 'chat_persist_skipped', {
              operation: 'onEnd',
              elapsedMs: Date.now() - started,
              category: ok ? undefined : 'persistence',
            });
          }),
        );
      },
    });
  } catch (err) {
    logSafeError('chat_route_failed', err, {
      operation: 'POST /api/chat',
      category: 'provider',
      elapsedMs: Date.now() - started,
    });
    return jsonError(
      sanitizeForLog(err).includes('Code model')
        ? 'This capability is not configured.'
        : 'The assistant failed to start. Please try again.',
      500,
    );
  }
}
