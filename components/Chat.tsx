'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { ManagerUIMessage } from '@/lib/agents/manager';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export function Chat({ conversationId }: { conversationId: string }) {
  const { messages, sendMessage, status, error, clearError } = useChat<ManagerUIMessage>({
    id: conversationId,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { conversationId },
    }),
  });

  const busy = status === 'submitted' || status === 'streaming';
  const failed = status === 'error' || Boolean(error);

  return (
    <div className="main-panel">
      {failed && (
        <div className="chat-error-banner" role="alert">
          <span>
            {error?.message?.slice(0, 200) ||
              'Something went wrong generating a reply. You can try sending again.'}
          </span>
          <button
            type="button"
            className="chat-error-dismiss"
            onClick={() => clearError?.()}
          >
            Dismiss
          </button>
        </div>
      )}
      <MessageList messages={messages} />
      <MessageInput disabled={busy} onSend={(text) => sendMessage({ text })} />
    </div>
  );
}
