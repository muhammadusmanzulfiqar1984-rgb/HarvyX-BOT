'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { isToolUIPart } from 'ai';
import type { ManagerUIMessage } from '@/lib/agents/manager';
import { AgentActivity } from './AgentActivity';

function toolLabel(toolName: string) {
  return `⟳ Consulting ${toolName === 'delegateToOps' ? 'OPS' : toolName} agent...`;
}

function EmptyState({ onChip }: { onChip: (text: string) => void }) {
  return (
    <div className="chat-empty">
      <div className="chat-empty-monogram">
        <span className="monogram-h">H</span>
        <span className="monogram-x">X</span>
      </div>
      <div className="chat-empty-tagline">Ask anything. MIAN is listening.</div>
      <div className="chat-empty-chips">
        {['Pipeline status', 'Draft outreach', 'Market analysis'].map((chip) => (
          <button key={chip} className="chat-chip" onClick={() => onChip(chip)}>
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  onChipSend,
}: {
  messages: ManagerUIMessage[];
  onChipSend?: (text: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return <EmptyState onChip={onChipSend ?? (() => {})} />;
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <div key={message.id} className={`message-row ${message.role}`}>
          <div className="message-wrapper">
            <div className="message-label">
              {message.role === 'user' ? 'MU' : 'MIAN'}
            </div>
            <div className="message-bubble">
              {message.parts.map((part, i) => {
                if (part.type === 'text') {
                  return (
                    <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {part.text}
                    </ReactMarkdown>
                  );
                }
                if (isToolUIPart(part)) {
                  const toolName = part.type.slice('tool-'.length);
                  if (toolName === 'delegateToOps' || toolName === 'delegateToAnalyst') {
                    return <AgentActivity key={i} toolType={part.type} part={part} />;
                  }
                  const done = part.state === 'output-available' || part.state === 'output-error';
                  return (
                    <div key={i} className="tool-step">
                      {done ? `✓ ${toolLabel(toolName)}` : toolLabel(toolName)}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
