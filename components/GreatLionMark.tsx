'use client';

import {
  LivingParticleAgent,
  type LivingAgentState,
} from './LivingParticleAgent';
import type { ParticleMetal } from '@/lib/living-particle';

export type LionMarkState = LivingAgentState;
export type { ParticleMetal };

type Props = {
  state?: LionMarkState;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  label?: string;
  /** Pixel size. Default 168. */
  size?: number;
  /**
   * gold = champagne (hero)
   * silver = secondary marks
   */
  metal?: ParticleMetal;
  /**
   * Hero entrance: form → one roar → living idle.
   * No hover/click/state roar loops. No break-apart reform.
   */
  hero?: boolean;
};

/**
 * Manager lion mark — thin wrapper over LivingParticleAgent.
 * Kept for existing Chat / MessageList / MessageInput call sites.
 */
export function GreatLionMark({
  state = 'idle',
  className,
  interactive,
  onClick,
  label,
  size = 168,
  metal = 'silver',
  hero = false,
}: Props) {
  return (
    <LivingParticleAgent
      agent="manager"
      state={state}
      className={className}
      interactive={interactive}
      onClick={onClick}
      label={label ?? `HARVYX ${state}`}
      size={size}
      metal={hero ? 'gold' : metal}
      entranceRoar={hero}
    />
  );
}
