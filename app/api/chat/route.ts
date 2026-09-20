import { createAgentUIStreamResponse } from 'ai';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createManagerAgent, type ManagerUIMessage } from '@/lib/agents/manager';
import { ensureBotRegistrySeeded } from '@/lib/bots';
import { getOrCreateConversation, appendMessagesSafe } from '@/lib/db/conversations';
import { logSafe, logSafeError, sanitizeForLog } from '@/lib/observability';

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

    if (!env.GROQ_API_KEY) {
      logSafe('chat_misconfigured', { operation: 'POST /api/chat', category: 'provider' });
      return jsonError('Chat is not configured (missing model provider key).', 503);
    }

    const conversation = await getOrCreateConversation(env.DB, conversationId);
    // Phase 0: keep Bot records in D1 in sync with canonical definitions (no behavior change).
    await ensureBotRegistrySeeded(env.DB);
    const managerAgent = createManagerAgent(env);

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
