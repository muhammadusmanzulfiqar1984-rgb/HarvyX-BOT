'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart } from 'ai';
import { useEffect, useMemo, useState } from 'react';
import type { ManagerUIMessage } from '@/lib/agents/manager';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TeamActivityStrip, deriveTeamUxStates } from './TeamActivityStrip';
import { type LionMarkState } from './GreatLionMark';
import { TEAM_MEMBER_LABELS } from '@/lib/team/roster';
import type { AgentUxState } from '@/lib/agent-avatar/identity';

export function TeamChat({
  conversationId,
  onBusyChange,
  onRosterChange,
}: {
  conversationId: string;
  onBusyChange?: (busy: boolean) => void;
  onRosterChange?: (states: Partial<Record<string, AgentUxState>>) => void;
}) {
  const { messages, sendMessage, status, error, clearError } = useChat<ManagerUIMessage>({
    id: `team:${conversationId}`,
    transport: new DefaultChatTransport({
      api: '/api/team',
      body: { conversationId: `team:${conversationId}` },
    }),
  });

  const busy = status === 'submitted' || status === 'streaming';
  const failed = status === 'error' || Boolean(error);
  const [listening, setListening] = useState(false);
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (busy) setListening(false);
  }, [busy]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && listening) setListening(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listening]);

  const teamStates = useMemo(
    () => deriveTeamUxStates(messages, busy),
    [messages, busy],
  );

  useEffect(() => {
    if (!onRosterChange) return;
    const next: Partial<Record<string, AgentUxState>> = {};
    for (const [k, v] of Object.entries(teamStates)) {
      next[k] = v === 'synthesizing' ? 'working' : v;
    }
    if (failed) next.mian = 'error';
    onRosterChange(next);
    return () => onRosterChange({});
  }, [teamStates, failed, onRosterChange]);

  const anyWorkerLive = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last) return false;
    return last.parts.some(
      (p) =>
        isToolUIPart(p) &&
        p.state !== 'output-available' &&
        p.state !== 'output-error',
    );
  }, [messages]);

  const lionState: LionMarkState = useMemo(() => {
    if (failed) return 'error';
    if (listening) return 'listening';
    if (busy && anyWorkerLive) return 'listening';
    if (busy) return 'thinking';
    if (drafting) return 'speaking';
    return 'idle';
  }, [failed, listening, busy, drafting, anyWorkerLive]);

  return (
    <div className="hx-chat hx-team-chat">
      <div className="team-command-header">
        <div className="team-command-title">
          <span className="team-command-kicker">Command room</span>
          <h2>TEAM</h2>
          <p>One shared conversation · {Object.values(TEAM_MEMBER_LABELS).join(' · ')}</p>
        </div>
        <TeamActivityStrip messages={messages} streaming={busy} />
      </div>

      {failed && (
        <div className="chat-error-banner" role="alert">
          <span>
            {error?.message?.slice(0, 200) ||
              'Something went wrong generating a team reply. You can try sending again.'}
          </span>
          <button type="button" className="chat-error-dismiss" onClick={() => clearError?.()}>
            Dismiss
          </button>
        </div>
      )}

      <div className="hx-chat-stage">
        <MessageList
          messages={messages}
          streaming={busy}
          variant="team"
          onChipSend={(text) => sendMessage({ text })}
          lionState={lionState}
          listening={listening}
          onLionClick={() => {
            if (!busy) setListening((v) => !v);
          }}
        />
      </div>

      <MessageInput
        disabled={busy}
        voiceListening={listening}
        orbState={lionState}
        onDraftChange={setDrafting}
        conversationId={`team:${conversationId}`}
        onToggleVoice={() => {
          if (!busy) setListening((v) => !v);
        }}
        onVoiceStop={() => setListening(false)}
        agentHint={
          busy
            ? anyWorkerLive
              ? 'Delegating…'
              : 'Team working…'
            : listening
              ? 'Listening…'
              : drafting
                ? 'Writing…'
                : undefined
        }
        onSend={(text) => {
          setListening(false);
          setDrafting(false);
          sendMessage({ text });
        }}
      />
    </div>
  );
}
