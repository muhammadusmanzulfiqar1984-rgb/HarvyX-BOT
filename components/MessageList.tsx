'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { isToolUIPart } from 'ai';
import type { ManagerUIMessage } from '@/lib/agents/manager';
import { AgentActivity } from './AgentActivity';

function toolLabel(toolName: string) {
  return `Running ${toolName}…`;
}

export function MessageList({ messages }: { messages: ManagerUIMessage[] }) {
  return (
    <div className="message-list">
      {messages.map((message) => (
        <div key={message.id} className={`message-row ${message.role}`}>
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
      ))}
    </div>
  );
}
