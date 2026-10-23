/**
 * In-memory Bot Registry — canonical source of truth for which bots exist.
 * D1 seeding (registry.ts) mirrors flat identity fields for catalog persistence.
 * Living-particle visuals remain in lib/living-particle (referenced via bot.visual).
 */

import type {
  BotDefinition,
  BotLifecycleStatus,
  BotStatus,
} from './types';
import { normalizeBotStatus } from './types';
import { CANONICAL_BOTS, PLANNED_BOTS } from './definitions';

export class BotRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotRegistryError';
  }
}

export type BotRegistryPatch = Partial<
  Omit<BotDefinition, 'id' | 'slug'> & {
    /** Allow slug rename only via explicit update (rare). */
    slug?: string;
  }
>;

/**
 * Canonical Bot Registry.
 * register / get / list / update / activate / pause / archive
 */
export class BotRegistry {
  private bots = new Map<string, BotDefinition>();
  private bySlug = new Map<string, string>();

  /** Register a bot. Rejects duplicate id or slug. */
  register(bot: BotDefinition): BotDefinition {
    this.assertValid(bot);
    if (this.bots.has(bot.id)) {
      throw new BotRegistryError(`Duplicate bot id: ${bot.id}`);
    }
    if (this.bySlug.has(bot.slug.toLowerCase())) {
      throw new BotRegistryError(`Duplicate bot slug: ${bot.slug}`);
    }
    const stored = freezeBot(bot);
    this.bots.set(stored.id, stored);
    this.bySlug.set(stored.slug.toLowerCase(), stored.id);
    return stored;
  }

  /** Lookup by id or slug. */
  get(idOrSlug: string): BotDefinition | undefined {
    const byId = this.bots.get(idOrSlug);
    if (byId) return byId;
    const id = this.bySlug.get(idOrSlug.toLowerCase());
    return id ? this.bots.get(id) : undefined;
  }

  require(idOrSlug: string): BotDefinition {
    const bot = this.get(idOrSlug);
    if (!bot) throw new BotRegistryError(`Unknown bot: ${idOrSlug}`);
    return bot;
  }

  list(filter?: { status?: BotStatus | BotStatus[] }): BotDefinition[] {
    let all = Array.from(this.bots.values());
    if (filter?.status) {
      const set = new Set(
        (Array.isArray(filter.status) ? filter.status : [filter.status]).map(String),
      );
      all = all.filter((b) => set.has(b.status));
    }
    return all.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'orchestrator' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  update(idOrSlug: string, patch: BotRegistryPatch): BotDefinition {
    const current = this.require(idOrSlug);
    if (patch.slug && patch.slug !== current.slug) {
      const nextSlug = patch.slug.toLowerCase();
      if (this.bySlug.has(nextSlug) && this.bySlug.get(nextSlug) !== current.id) {
        throw new BotRegistryError(`Duplicate bot slug: ${patch.slug}`);
      }
      this.bySlug.delete(current.slug.toLowerCase());
      this.bySlug.set(nextSlug, current.id);
    }

    if (patch.version != null && patch.version < current.version) {
      throw new BotRegistryError(
        `version must be >= current (${current.version}); got ${patch.version}`,
      );
    }

    if (patch.status != null) {
      this.assertStatus(patch.status);
    }

    if (patch.modelPolicy && !patch.modelPolicy.tier) {
      throw new BotRegistryError('modelPolicy.tier is required');
    }

    if (patch.visual) {
      this.assertVisual(patch.visual);
    }

    const next: BotDefinition = freezeBot({
      ...current,
      ...patch,
      id: current.id,
      slug: patch.slug ?? current.slug,
      version: patch.version ?? current.version,
      modelTier: patch.modelPolicy?.tier ?? patch.modelTier ?? current.modelTier,
      toolPack: patch.capabilities?.toolPack ?? patch.toolPack ?? current.toolPack,
      modelPolicy: patch.modelPolicy
        ? { ...current.modelPolicy, ...patch.modelPolicy }
        : current.modelPolicy,
      capabilities: patch.capabilities
        ? { ...current.capabilities, ...patch.capabilities }
        : current.capabilities,
      behavior: patch.behavior ? { ...current.behavior, ...patch.behavior } : current.behavior,
      permissions: patch.permissions
        ? { ...current.permissions, ...patch.permissions }
        : current.permissions,
      visual: patch.visual ? { ...current.visual, ...patch.visual } : current.visual,
      updatedAt: new Date().toISOString(),
    });

    this.bots.set(next.id, next);
    return next;
  }

  activate(idOrSlug: string): BotDefinition {
    return this.setLifecycle(idOrSlug, 'active');
  }

  pause(idOrSlug: string): BotDefinition {
    return this.setLifecycle(idOrSlug, 'paused');
  }

  archive(idOrSlug: string): BotDefinition {
    return this.setLifecycle(idOrSlug, 'archived');
  }

  /** Soft-set testing status (Factory will use this before activation). */
  markTesting(idOrSlug: string): BotDefinition {
    return this.setLifecycle(idOrSlug, 'testing');
  }

  private setLifecycle(idOrSlug: string, status: BotLifecycleStatus): BotDefinition {
    return this.update(idOrSlug, { status });
  }

  private assertValid(bot: BotDefinition): void {
    if (!bot.id?.trim()) throw new BotRegistryError('bot.id is required');
    if (!bot.slug?.trim()) throw new BotRegistryError('bot.slug is required');
    if (!bot.name?.trim()) throw new BotRegistryError('bot.name is required');
    if (!Number.isFinite(bot.version) || bot.version < 1) {
      throw new BotRegistryError('bot.version must be an integer >= 1');
    }
    if (!Number.isInteger(bot.version)) {
      throw new BotRegistryError('bot.version must be an integer >= 1');
    }
    this.assertStatus(bot.status);
    if (!bot.modelPolicy?.tier) {
      throw new BotRegistryError('bot.modelPolicy.tier is required');
    }
    if (bot.modelTier !== bot.modelPolicy.tier) {
      throw new BotRegistryError('bot.modelTier must match modelPolicy.tier');
    }
    if (bot.toolPack !== bot.capabilities.toolPack) {
      throw new BotRegistryError('bot.toolPack must match capabilities.toolPack');
    }
    this.assertVisual(bot.visual, bot.status);
  }

  private assertStatus(status: BotStatus): void {
    const allowed: BotStatus[] = [
      'draft',
      'testing',
      'active',
      'paused',
      'archived',
      'planned',
      'disabled',
    ];
    if (!allowed.includes(status)) {
      throw new BotRegistryError(`Invalid bot status: ${status}`);
    }
  }

  private assertVisual(
    visual: BotDefinition['visual'],
    status?: BotStatus,
  ): void {
    if (!visual) throw new BotRegistryError('bot.visual is required');
    if (!visual.symbol?.trim()) throw new BotRegistryError('bot.visual.symbol is required');
    const lifecycle = status ? normalizeBotStatus(status) : 'active';
    const needsParticle = lifecycle === 'active' || lifecycle === 'testing';
    if (needsParticle && !visual.particleAgent?.trim()) {
      throw new BotRegistryError('bot.visual.particleAgent is required for runnable bots');
    }
  }
}

function freezeBot(bot: BotDefinition): BotDefinition {
  return {
    ...bot,
    tags: [...bot.tags],
    modelPolicy: {
      ...bot.modelPolicy,
      routingPolicy: bot.modelPolicy.routingPolicy
        ? {
            ...bot.modelPolicy.routingPolicy,
            fallback: bot.modelPolicy.routingPolicy.fallback
              ? [...bot.modelPolicy.routingPolicy.fallback]
              : undefined,
            allowedProviders: bot.modelPolicy.routingPolicy.allowedProviders
              ? [...bot.modelPolicy.routingPolicy.allowedProviders]
              : undefined,
          }
        : undefined,
    },
    capabilities: {
      ...bot.capabilities,
      tools: bot.capabilities.tools ? [...bot.capabilities.tools] : undefined,
      connectors: bot.capabilities.connectors ? [...bot.capabilities.connectors] : undefined,
      knowledge: bot.capabilities.knowledge ? [...bot.capabilities.knowledge] : undefined,
      memory: bot.capabilities.memory ? [...bot.capabilities.memory] : undefined,
      workflows: bot.capabilities.workflows ? [...bot.capabilities.workflows] : undefined,
    },
    behavior: { ...bot.behavior },
    permissions: {
      ...bot.permissions,
      allowedTools: bot.permissions.allowedTools ? [...bot.permissions.allowedTools] : undefined,
      allowedConnectors: bot.permissions.allowedConnectors
        ? [...bot.permissions.allowedConnectors]
        : undefined,
      allowedActions: bot.permissions.allowedActions
        ? [...bot.permissions.allowedActions]
        : undefined,
      dataScopes: bot.permissions.dataScopes ? [...bot.permissions.dataScopes] : undefined,
      requiresApproval: bot.permissions.requiresApproval
        ? [...bot.permissions.requiresApproval]
        : undefined,
    },
    visual: { ...bot.visual },
  };
}

/** Process-wide singleton — initialized with canonical + planned definitions. */
let singleton: BotRegistry | null = null;

export function getBotRegistry(): BotRegistry {
  if (!singleton) {
    singleton = createBotRegistryFromDefinitions();
  }
  return singleton;
}

/** Build a fresh registry from code definitions (tests / isolate reset). */
export function createBotRegistryFromDefinitions(
  bots: BotDefinition[] = [...CANONICAL_BOTS, ...PLANNED_BOTS],
): BotRegistry {
  const registry = new BotRegistry();
  for (const bot of bots) {
    registry.register(bot);
  }
  return registry;
}

/** Test helper — replace the process singleton. */
export function resetBotRegistryForTests(registry?: BotRegistry): BotRegistry {
  singleton = registry ?? createBotRegistryFromDefinitions();
  return singleton;
}
