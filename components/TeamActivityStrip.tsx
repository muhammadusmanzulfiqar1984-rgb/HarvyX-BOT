'use client';

import { isToolUIPart } from 'ai';
import type { ManagerUIMessage } from '@/lib/agents/manager';
import { TEAM_MEMBER_LABELS, TEAM_MEMBER_SLUGS } from '@/lib/team/roster';
import { AgentAvatar } from './AgentAvatar';
import {
  activeUxForAgent,
  type AgentUxState,
} from '@/lib/agent-avatar/identity';

const TOOL_TO_SLUG: Record<string, string> = {
  delegateToOps: 'ops',
  delegateToAnalyst: 'analyst',
  delegateToSocial: 'social',
  delegateToScrape: 'scrape',
};

export type TeamChipState = AgentUxState | 'synthesizing';

export function deriveTeamUxStates(
  messages: ManagerUIMessage[],
  streaming: boolean,
): Record<string, TeamChipState> {
  const states: Record<string, TeamChipState> = {
    mian: streaming ? 'thinking' : 'idle',
    ops: 'idle',
    analyst: 'idle',
    scrape: 'idle',
    social: 'idle',
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) return states;

  let anyWorking = false;
  let anyComplete = false;
  let anyError = false;

  for (const part of lastAssistant.parts) {
    if (!isToolUIPart(part)) continue;
    const toolName = part.type.slice('tool-'.length);
    const slug = TOOL_TO_SLUG[toolName];
    if (!slug) continue;
    if (part.state === 'output-error') {
      states[slug] = 'error';
      anyError = true;
    } else if (part.state === 'output-available') {
      states[slug] = 'completed';
      anyComplete = true;
    } else if (part.state === 'input-streaming') {
      states[slug] = activeUxForAgent(slug, 'thinking');
      anyWorking = true;
    } else {
      states[slug] = activeUxForAgent(slug, 'working');
      anyWorking = true;
    }
  }

  if (streaming) {
    if (anyWorking) {
      states.mian = 'delegating';
    } else if (anyComplete || lastAssistant.parts.some((p) => p.type === 'text')) {
      states.mian = 'synthesizing';
    } else {
      states.mian = 'thinking';
    }
  } else if (anyError && !anyWorking) {
    states.mian = anyComplete ? 'completed' : 'error';
  } else if (
    anyComplete ||
    lastAssistant.parts.some((p) => p.type === 'text' && Boolean((p as { text?: string }).text?.trim()))
  ) {
    states.mian = 'completed';
  }

  return states;
}

function labelFor(state: TeamChipState): string {
  switch (state) {
    case 'working':
      return 'WORKING';
    case 'researching':
      return 'RESEARCHING';
    case 'scraping':
      return 'SCRAPING';
    case 'analyzing':
      return 'ANALYZING';
    case 'thinking':
      return 'THINKING';
    case 'delegating':
      return 'DELEGATING';
    case 'completed':
      return 'COMPLETE';
    case 'error':
      return 'ERROR';
    case 'synthesizing':
      return 'SYNTHESIZING';
    default:
      return 'READY';
  }
}

function avatarState(state: TeamChipState): AgentUxState {
  if (state === 'synthesizing') return 'working';
  return state;
}

export function TeamActivityStrip({
  messages,
  streaming,
}: {
  messages: ManagerUIMessage[];
  streaming: boolean;
}) {
  const states = deriveTeamUxStates(messages, streaming);
  return (
    <div className="team-activity-strip" aria-label="Team execution status">
      {TEAM_MEMBER_SLUGS.map((slug) => {
        const state = states[slug] ?? 'idle';
        return (
          <span key={slug} className={`team-chip state-${state}`}>
            <AgentAvatar
              agent={slug}
              state={avatarState(state)}
              size={28}
              className="hx-agent-avatar--chip"
            />
            <span className="team-chip-name">{TEAM_MEMBER_LABELS[slug]}</span>
            <span className="team-chip-state">{labelFor(state)}</span>
          </span>
        );
      })}
    </div>
  );
}
