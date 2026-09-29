/**
 * Canonical HARVYX-BOT agent → animal identity.
 * Recovered from lib/bots/definitions.ts + lib/living-particle/agents/defaults.ts.
 * Do not invent Lucide/emoji substitutes.
 */

import { resolveAgentId, type AgentVisualState } from '@/lib/living-particle';

/** UX-facing activity states (real runtime / tool / chat status). */
export type AgentUxState =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'researching'
  | 'scraping'
  | 'analyzing'
  | 'delegating'
  | 'completed'
  | 'error';

/** States the LivingParticleEngine accepts from UI wrappers. */
export type AgentEngineState = Exclude<
  AgentVisualState,
  'roar' | 'forming' | 'formed' | 'transition'
>;

export type AgentAnimalSymbol = 'lion' | 'horse' | 'owl' | 'falcon' | 'hummingbird';

export type AgentIdentity = {
  /** Roster / bot slug (mian, ops, …). */
  slug: string;
  /** Living-particle registry id (manager, ops, …). */
  particleAgent: string;
  /** Symbolic animal. */
  animal: AgentAnimalSymbol;
  label: string;
};

/** Canonical mapping — source of truth for UI. */
export const AGENT_IDENTITIES: readonly AgentIdentity[] = [
  { slug: 'mian', particleAgent: 'manager', animal: 'lion', label: 'MANAGER' },
  { slug: 'ops', particleAgent: 'ops', animal: 'horse', label: 'OPS' },
  { slug: 'analyst', particleAgent: 'analyst', animal: 'owl', label: 'ANALYST' },
  { slug: 'scrape', particleAgent: 'scrape', animal: 'falcon', label: 'SCRAPE' },
  { slug: 'social', particleAgent: 'social', animal: 'hummingbird', label: 'SOCIAL' },
] as const;

const BY_SLUG = new Map(AGENT_IDENTITIES.map((a) => [a.slug, a]));
const BY_PARTICLE = new Map(AGENT_IDENTITIES.map((a) => [a.particleAgent, a]));

/** Alias keys that resolve to a roster identity. */
const ALIASES: Record<string, string> = {
  mian: 'mian',
  manager: 'mian',
  harvyx: 'mian',
  'harvyx-bot': 'mian',
  lion: 'mian',
  ops: 'ops',
  operations: 'ops',
  analyst: 'analyst',
  reasoning: 'analyst',
  scrape: 'scrape',
  hawk: 'scrape',
  research: 'scrape',
  social: 'social',
  comms: 'social',
};

export function resolveAgentIdentity(agentKey: string): AgentIdentity {
  const key = agentKey.trim().toLowerCase();
  const slug = ALIASES[key] ?? key;
  const known = BY_SLUG.get(slug) ?? BY_PARTICLE.get(slug);
  if (known) return known;

  const particle = resolveAgentId(key) ?? key;
  const fromParticle = BY_PARTICLE.get(particle);
  if (fromParticle) return fromParticle;

  return {
    slug: key,
    particleAgent: particle,
    animal: 'lion',
    label: key.toUpperCase(),
  };
}

/**
 * Map UX activity → LivingParticleEngine states.
 * Engine supports: idle | thinking | listening | speaking | error.
 */
export function mapUxStateToEngine(state: AgentUxState): AgentEngineState {
  switch (state) {
    case 'idle':
      return 'idle';
    case 'thinking':
    case 'analyzing':
      return 'thinking';
    case 'delegating':
      return 'listening';
    case 'working':
    case 'researching':
    case 'scraping':
      return 'speaking';
    case 'completed':
      return 'idle';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

/** Prefer agent-specific active verbs when tool is live. */
export function activeUxForAgent(slug: string, phase: 'thinking' | 'working'): AgentUxState {
  const id = resolveAgentIdentity(slug).slug;
  if (phase === 'thinking') {
    if (id === 'analyst') return 'analyzing';
    if (id === 'scrape') return 'researching';
    if (id === 'mian') return 'thinking';
    return 'thinking';
  }
  if (id === 'scrape') return 'scraping';
  if (id === 'analyst') return 'analyzing';
  if (id === 'mian') return 'delegating';
  return 'working';
}

export function animalLabel(animal: AgentAnimalSymbol): string {
  switch (animal) {
    case 'lion':
      return 'Lion';
    case 'horse':
      return 'Horse';
    case 'owl':
      return 'Owl';
    case 'falcon':
      return 'Falcon';
    case 'hummingbird':
      return 'Hummingbird';
  }
}
