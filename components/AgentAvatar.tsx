'use client';

import {
  LivingParticleAgent,
  type LivingAgentState,
} from './LivingParticleAgent';
import type { ParticleMetal } from '@/lib/living-particle';
import {
  animalLabel,
  mapUxStateToEngine,
  resolveAgentIdentity,
  type AgentUxState,
} from '@/lib/agent-avatar/identity';

export type { AgentUxState };

type Props = {
  /** Bot slug, particle id, or alias (mian, research, manager, ops, …). */
  agent: string;
  /** UX activity — mapped onto the living-particle engine. */
  state?: AgentUxState | LivingAgentState;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  label?: string;
  size?: number;
  metal?: ParticleMetal;
  /** Hero entrance roar — Manager lion only. */
  entranceRoar?: boolean;
};

const ENGINE_STATES = new Set<string>([
  'idle',
  'thinking',
  'listening',
  'speaking',
  'error',
]);

function toEngineState(state: AgentUxState | LivingAgentState | undefined): LivingAgentState {
  if (!state) return 'idle';
  if (ENGINE_STATES.has(state)) return state as LivingAgentState;
  return mapUxStateToEngine(state as AgentUxState);
}

/**
 * Reusable animal identity for HARVYX-BOT agents.
 * Resolves the correct living-particle creature — never Lucide/emoji.
 */
export function AgentAvatar({
  agent,
  state = 'idle',
  className,
  interactive,
  onClick,
  label,
  size = 48,
  metal,
  entranceRoar = false,
}: Props) {
  const identity = resolveAgentIdentity(agent);
  const engineState = toEngineState(state);
  const isManager = identity.particleAgent === 'manager';
  const resolvedMetal = metal ?? (isManager ? 'gold' : 'silver');

  return (
    <LivingParticleAgent
      agent={identity.particleAgent}
      state={engineState}
      className={`hx-agent-avatar animal-${identity.animal} ux-${state} ${className ?? ''}`.trim()}
      interactive={interactive}
      onClick={onClick}
      label={
        label ??
        `HARVYX ${identity.label} · ${animalLabel(identity.animal)} · ${state}`
      }
      size={size}
      metal={resolvedMetal}
      entranceRoar={entranceRoar && isManager}
    />
  );
}
