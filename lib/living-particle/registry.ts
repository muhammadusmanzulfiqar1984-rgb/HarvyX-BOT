import type { AgentDefinition } from './types';

const registry = new Map<string, AgentDefinition>();
const aliasIndex = new Map<string, string>();

/** Register an agent for the Living Particle Agent engine (Bot Factory extensibility). */
export function registerAgent(def: AgentDefinition): void {
  const id = def.id.toLowerCase();
  registry.set(id, def);
  aliasIndex.set(id, id);
  for (const a of def.aliases ?? []) {
    aliasIndex.set(a.toLowerCase(), id);
  }
}

export function getAgent(idOrAlias: string): AgentDefinition | undefined {
  const key = aliasIndex.get(idOrAlias.toLowerCase());
  if (!key) return undefined;
  return registry.get(key);
}

export function requireAgent(idOrAlias: string): AgentDefinition {
  const found = getAgent(idOrAlias);
  if (!found) {
    throw new Error(`LivingParticleAgent: unknown agent "${idOrAlias}"`);
  }
  return found;
}

export function listAgents(): AgentDefinition[] {
  return Array.from(registry.values());
}

export function hasAgent(idOrAlias: string): boolean {
  return aliasIndex.has(idOrAlias.toLowerCase());
}

/** Resolve agent id from roster slug (mian → manager, etc.). */
export function resolveAgentId(slug: string): string | null {
  const key = aliasIndex.get(slug.toLowerCase());
  return key ?? null;
}
