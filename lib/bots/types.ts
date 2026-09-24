/**
 * Canonical Bot Factory types — Phase 1.
 * ONE BotDefinition. Runtime agents keep reading familiar flat fields.
 * Living-particle visual identity stays in lib/living-particle (separate registry).
 */

/** Model tier bound to a Bot — maps to lib/models/router. */
export type BotModelTier = 'fast' | 'reasoning' | 'code';

/** Runtime kind — orchestrator talks to the user; specialists are nested. */
export type BotKind = 'orchestrator' | 'specialist';

/** Built-in tool packs resolved in code. New Bots pick a pack; they do not hardcode tools. */
export type BotToolPack = 'none' | 'delegate' | 'harvyx' | 'scrape';

/**
 * Canonical bot lifecycle (Bot Factory).
 * Legacy D1 / marketplace values `planned` | `disabled` are accepted on read
 * and normalized via normalizeBotStatus().
 */
export type BotLifecycleStatus = 'draft' | 'testing' | 'active' | 'paused' | 'archived';

/** @deprecated Prefer BotLifecycleStatus. Kept for D1 rows + marketplace placeholders. */
export type BotStatus = BotLifecycleStatus | 'planned' | 'disabled';

/** Visual reference into the Living Particle Agent registry (separate system). */
export interface BotVisualRef {
  /** Symbolic creature label (lion, horse, owl, falcon, hummingbird). */
  symbol: string;
  /** Living-particle AgentDefinition id (manager, ops, analyst, scrape, social). */
  particleAgent: string;
  /** Optional motion profile id — particle engine owns the actual profile. */
  motionProfile?: string;
}

/**
 * Model selection policy — not permanently tied to one provider.
 * Runtime execution still goes through lib/models/router via `tier` (+ optional provider).
 */
export interface BotModelPolicy {
  /** Primary tier consumed by resolveModel(). */
  tier: BotModelTier;
  /** Optional explicit provider override (e.g. local_h100, groq, nebius). */
  provider?: string;
  /** Optional provider-specific model identifier. */
  model?: string;
  routingPolicy?: {
    primary?: string;
    fallback?: string[];
    allowedProviders?: string[];
  };
}

/** Capability references — not copied tool implementations. */
export interface BotCapabilities {
  /** Existing Phase 0 pack — how tools are resolved at runtime today. */
  toolPack: BotToolPack;
  /** Future: explicit tool ids (e.g. gmail.search). */
  tools?: string[];
  /** Future: connector ids (e.g. gmail). */
  connectors?: string[];
  knowledge?: string[];
  memory?: string[];
  workflows?: string[];
}

export type BotAutonomy = 'low' | 'medium' | 'high';
export type BotApprovalPolicy = 'strict' | 'standard' | 'permissive';

export interface BotBehaviorProfile {
  personality?: string;
  autonomy?: BotAutonomy;
  /** Integrates with lib/policy/approval — does not replace it. */
  approvalPolicy?: BotApprovalPolicy;
}

export interface BotPermissions {
  allowedTools?: string[];
  allowedConnectors?: string[];
  allowedActions?: string[];
  dataScopes?: string[];
  /** TOOL_CLASSES keys that always require approval for this bot. */
  requiresApproval?: string[];
}

/**
 * Canonical first-class bot definition (Bot Factory Phase 1).
 * Flat fields (slug, instructions, modelTier, toolPack) remain for existing agents.
 */
export interface BotDefinition {
  id: string;
  slug: string;
  name: string;
  displayName?: string;
  description: string;
  role: string;
  kind: BotKind;
  status: BotStatus;
  /** Monotonic definition version — Factory can ship v1/v2/v3 without destroying history. */
  version: number;
  /** System instructions (runtime). */
  instructions: string;
  /** @deprecated Prefer modelPolicy.tier — kept for agent factories. */
  modelTier: BotModelTier;
  modelPolicy: BotModelPolicy;
  /** @deprecated Prefer capabilities.toolPack — kept for agent factories. */
  toolPack: BotToolPack;
  capabilities: BotCapabilities;
  behavior: BotBehaviorProfile;
  permissions: BotPermissions;
  visual: BotVisualRef;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

/**
 * @deprecated Alias of BotDefinition — existing imports keep working.
 * Prefer BotDefinition going forward.
 */
export type BotRecord = BotDefinition;

export interface TeamRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  memberBotIds: string[];
}

/** Public catalog shape for Agents / Marketplace UI. */
export interface BotCatalogItem {
  id: string;
  slug: string;
  name: string;
  displayName?: string;
  role: string;
  kind: BotKind;
  description: string;
  status: BotStatus;
  version?: number;
  tags: string[];
  modelTier: BotModelTier;
  toolPack: BotToolPack;
  visual?: BotVisualRef;
}

/** Normalize legacy D1 / marketplace statuses into lifecycle where useful. */
export function normalizeBotStatus(status: string): BotLifecycleStatus | 'planned' {
  switch (status) {
    case 'draft':
    case 'testing':
    case 'active':
    case 'paused':
    case 'archived':
      return status;
    case 'planned':
      return 'planned';
    case 'disabled':
      return 'paused';
    default:
      return 'draft';
  }
}

export function isRunnableStatus(status: BotStatus): boolean {
  const n = normalizeBotStatus(status);
  return n === 'active' || n === 'testing';
}

export const BOT_LIFECYCLE_STATUSES: readonly BotLifecycleStatus[] = [
  'draft',
  'testing',
  'active',
  'paused',
  'archived',
] as const;
