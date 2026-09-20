/** Model tier bound to a Bot record — maps to lib/models/router. */
export type BotModelTier = 'fast' | 'reasoning' | 'code';

/** Runtime kind — orchestrator talks to the user; specialists are nested. */
export type BotKind = 'orchestrator' | 'specialist';

/** Built-in tool packs resolved in code (Phase 0). New Bots pick a pack; they do not hardcode tools. */
export type BotToolPack = 'none' | 'delegate' | 'harvyx';

export type BotStatus = 'active' | 'planned' | 'disabled';

export interface BotRecord {
  id: string;
  slug: string;
  name: string;
  role: string;
  kind: BotKind;
  description: string;
  instructions: string;
  modelTier: BotModelTier;
  toolPack: BotToolPack;
  status: BotStatus;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

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
  role: string;
  kind: BotKind;
  description: string;
  status: BotStatus;
  tags: string[];
  modelTier: BotModelTier;
  toolPack: BotToolPack;
}
