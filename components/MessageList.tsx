'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { isToolUIPart } from 'ai';
import type { ManagerUIMessage } from '@/lib/agents/manager';
import { AgentActivity } from './AgentActivity';
import { GreatLionMark, type LionMarkState } from './GreatLionMark';
import { MessageAttachments } from './MessageAttachments';
import { AttachmentCard } from './AttachmentCard';
import { parseUserMessage, scrubArtifactLabels } from '@/lib/attachments/message-pack';

const SPECIALIST_TOOL_NAMES = new Set([
  'delegateToOps',
  'delegateToAnalyst',
  'delegateToSocial',
  'delegateToScrape',
]);

const CONNECTOR_LABELS: Record<string, string> = {
  gmail: 'Gmail',
  harvyxSend: 'HarvYX Send',
  calendar: 'Calendar',
};

function EmptyState({
  onChip,
  lionState,
  listening,
  onLionClick,
  variant = 'chat',
}: {
  onChip: (text: string) => void;
  lionState: LionMarkState;
  listening: boolean;
  onLionClick: () => void;
  variant?: 'chat' | 'team';
}) {
  return (
    <div className="chat-empty hx-empty">
      <div className="hx-empty-copy">
        <GreatLionMark
          hero
          state={lionState}
          size={168}
          interactive
          onClick={onLionClick}
          label={
            listening
              ? 'HARVYX listening — click or Escape to stop'
              : 'HARVYX BOT — Manager lion'
          }
        />
        {listening && (
          <p className="hx-orb-caption">Listening — speak to dictate · Esc to cancel</p>
        )}
        <div className="chat-empty-brand">{variant === 'team' ? 'TEAM' : 'HARVYX BOT'}</div>
        <div className="chat-empty-tagline">
          {variant === 'team'
            ? 'Shared command room · Manager coordinates specialists.'
            : 'Manager · Private intelligence. Ask anything.'}
        </div>
        <div className="chat-empty-chips">
          {(variant === 'team'
            ? ['Research competitors and CRM pipeline', 'Open this URL and summarize with sources', 'Draft outreach then critique for LinkedIn']
            : ['Pipeline status', 'Draft outreach', 'Market analysis']
          ).map((chip) => (
            <button key={chip} type="button" className="chat-chip" onClick={() => onChip(chip)}>
              {chip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConnectorStep({ toolName, done, errored }: { toolName: string; done: boolean; errored: boolean }) {
  const label = CONNECTOR_LABELS[toolName] ?? toolName;
  const status = errored ? 'Error' : done ? 'Complete' : 'Working';
  return (
    <div className={`connector-module${errored ? ' is-error' : done ? ' is-done' : ' is-working'}`}>
      <span className="connector-name">{label}</span>
      <span className="connector-status">{status}</span>
    </div>
  );
}

export function MessageList({
  messages,
  onChipSend,
  streaming,
  lionState = 'idle',
  listening = false,
  onLionClick,
  variant = 'chat',
}: {
  messages: ManagerUIMessage[];
  onChipSend?: (text: string) => void;
  streaming?: boolean;
  lionState?: LionMarkState;
  listening?: boolean;
  onLionClick?: () => void;
  variant?: 'chat' | 'team';
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <EmptyState
        onChip={onChipSend ?? (() => {})}
        lionState={lionState}
        listening={listening}
        onLionClick={onLionClick ?? (() => {})}
        variant={variant}
      />
    );
  }

  return (
    <div className="message-list hx-message-list">
      <div className="message-list-inner">
        {messages.map((message) => {
          if (message.role === 'user') {
            const text = message.parts
              .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
              .map((p) => p.text)
              .join('\n');
            const { displayText, attachments } = parseUserMessage(text);
            return (
              <div key={message.id} className="message-row user">
                <div className="message-block">
                  <div className="message-identity">You</div>
                  {attachments.length > 0 ? (
                    <div className="hx-attachments-list hx-user-attachments">
                      {attachments.map((a) => (
                        <AttachmentCard key={a.id} attachment={a} />
                      ))}
                    </div>
                  ) : null}
                  {displayText ? <div className="message-bubble user-bubble">{displayText}</div> : null}
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className="message-row assistant">
              <div className="message-stack">
                {message.parts.map((part, i) => {
                  if (part.type === 'text') {
                    if (!part.text?.trim()) return null;
                    const isLastText =
                      streaming &&
                      !message.parts.slice(i + 1).some((p) => p.type === 'text' && Boolean(p.text?.trim()));
                    const showExport = !streaming || !isLastText;
                    return (
                      <div key={i} className="message-block manager-block">
                        <div className="message-identity">
                          <GreatLionMark
                            state={isLastText ? 'thinking' : 'idle'}
                            size={28}
                            metal="gold"
                            label="HARVYX BOT Manager"
                          />
                          <span className="message-identity-stack">
                            <span className="message-identity-primary">
                              {variant === 'team' ? 'MANAGER' : 'HARVYX BOT'}
                            </span>
                            <span className="message-identity-role">
                              {variant === 'team' ? 'Team coordinator' : 'Manager'}
                            </span>
                          </span>
                        </div>
                        <div className="message-bubble manager-bubble exec-sheet">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                            {scrubArtifactLabels(part.text)}
                          </ReactMarkdown>
                        </div>
                        {showExport && part.text.trim().length > 40 ? (
                          <MessageAttachments
                            markdown={part.text}
                            title={variant === 'team' ? 'HarvyX-Pipeline-Report' : 'HARVYX BOT Manager'}
                            sourceAgent={variant === 'team' ? 'TEAM → MANAGER' : 'MANAGER'}
                          />
                        ) : null}
                      </div>
                    );
                  }

                  if (isToolUIPart(part)) {
                    const toolName = part.type.slice('tool-'.length);
                    if (SPECIALIST_TOOL_NAMES.has(toolName)) {
                      return (
                        <div key={i} className="message-block specialist-block">
                          <AgentActivity toolType={part.type} part={part} />
                        </div>
                      );
                    }
                    const done = part.state === 'output-available';
                    const errored = part.state === 'output-error';
                    return (
                      <div key={i} className="message-block">
                        <ConnectorStep toolName={toolName} done={done} errored={errored} />
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
