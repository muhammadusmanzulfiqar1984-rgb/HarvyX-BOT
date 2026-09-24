import {
  CANONICAL_BOTS,
  PLANNED_BOTS,
  TEAM_IDS,
  getCanonicalBot,
} from './definitions';
import { getBotRegistry } from './bot-registry';
import type {
  BotCatalogItem,
  BotDefinition,
  BotKind,
  BotModelTier,
  BotStatus,
  BotToolPack,
  BotVisualRef,
} from './types';
import { normalizeBotStatus } from './types';
import { logSafeError } from '../observability';

type BotRow = {
  id: string;
  slug: string;
  name: string;
  role: string;
  kind: string;
  description: string;
  instructions: string;
  model_tier: string;
  tool_pack: string;
  status: string;
  tags_json: string;
  created_at?: string;
  updated_at?: string;
};

/** Cheap, stable (non-crypto) string hash — only used to detect definition changes. */
function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Changes whenever canonical/planned definitions change (new deploy or dev reload). */
export const DEFINITIONS_SIGNATURE = djb2(JSON.stringify([CANONICAL_BOTS, PLANNED_BOTS, TEAM_IDS]));

/** Per-isolate memo of the last successfully seeded definition set. */
let seededSignature: string | null = null;

function parseTags(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** Merge D1 flat row with code-defined Factory fields (visual, version, policies). */
function rowToBot(row: BotRow): BotDefinition {
  const code = getCanonicalBot(row.slug) ?? getBotRegistry().get(row.slug);
  const status = normalizeBotStatus(row.status) as BotStatus;
  const modelTier = row.model_tier as BotModelTier;
  const toolPack = row.tool_pack as BotToolPack;

  if (code) {
    return {
      ...code,
      id: row.id,
      slug: row.slug,
      name: row.name,
      role: row.role,
      kind: row.kind as BotKind,
      description: row.description,
      instructions: row.instructions,
      modelTier,
      toolPack,
      modelPolicy: { ...code.modelPolicy, tier: modelTier },
      capabilities: { ...code.capabilities, toolPack },
      status: (row.status as BotStatus) || code.status,
      tags: parseTags(row.tags_json),
      createdAt: row.created_at ?? code.createdAt,
      updatedAt: row.updated_at ?? code.updatedAt,
    };
  }

  // Dynamic / unknown D1 bot — minimal Factory-ready shell (future Factory inserts).
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    displayName: row.name,
    role: row.role,
    kind: row.kind as BotKind,
    description: row.description,
    instructions: row.instructions,
    modelTier,
    modelPolicy: { tier: modelTier },
    toolPack,
    capabilities: { toolPack },
    behavior: { autonomy: 'low', approvalPolicy: 'strict' },
    permissions: {},
    visual: { symbol: 'none', particleAgent: '' },
    status,
    version: 1,
    tags: parseTags(row.tags_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCatalog(bot: BotDefinition): BotCatalogItem {
  return {
    id: bot.id,
    slug: bot.slug,
    name: bot.name,
    displayName: bot.displayName,
    role: bot.role,
    kind: bot.kind,
    description: bot.description,
    status: bot.status,
    version: bot.version,
    tags: bot.tags,
    modelTier: bot.modelTier,
    toolPack: bot.toolPack,
    visual: bot.visual.particleAgent
      ? bot.visual
      : bot.visual.symbol !== 'none'
        ? bot.visual
        : undefined,
  };
}

/**
 * Upsert canonical bots + default team into D1.
 * Safe to call on every chat request — idempotent.
 * Falls back silently if D1 / migration not applied yet.
 * Extended Factory fields (visual, policies) stay code-defined in Phase 1.
 */
export async function ensureBotRegistrySeeded(db: D1Database): Promise<boolean> {
  if (seededSignature === DEFINITIONS_SIGNATURE) return true;
  try {
    const now = new Date().toISOString();
    const statements = [];

    for (const bot of [...CANONICAL_BOTS, ...PLANNED_BOTS]) {
      statements.push(
        db
          .prepare(
            `INSERT INTO bots (
              id, slug, name, role, kind, description, instructions,
              model_tier, tool_pack, status, tags_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              slug = excluded.slug,
              name = excluded.name,
              role = excluded.role,
              kind = excluded.kind,
              description = excluded.description,
              instructions = excluded.instructions,
              model_tier = excluded.model_tier,
              tool_pack = excluded.tool_pack,
              -- D1 owns lifecycle status once a row exists (kill switch must survive reseeding).
              -- Only a 'planned' row may be promoted by code, so shipping a planned bot still works.
              status = CASE WHEN bots.status = 'planned' THEN excluded.status ELSE bots.status END,
              tags_json = excluded.tags_json,
              updated_at = excluded.updated_at`,
          )
          .bind(
            bot.id,
            bot.slug,
            bot.name,
            bot.role,
            bot.kind,
            bot.description,
            bot.instructions,
            bot.modelTier,
            bot.toolPack,
            bot.status,
            JSON.stringify(bot.tags),
            now,
            now,
          ),
      );

      if (bot.status === 'active') {
        statements.push(
          db
            .prepare(
              `INSERT INTO bot_installs (id, bot_id, installed_at)
               VALUES (?, ?, ?)
               ON CONFLICT(bot_id) DO NOTHING`,
            )
            .bind(crypto.randomUUID(), bot.id, now),
        );
      }
    }

    statements.push(
      db
        .prepare(
          `INSERT INTO teams (id, slug, name, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             description = excluded.description,
             updated_at = excluded.updated_at`,
        )
        .bind(
          TEAM_IDS.default,
          'default',
          'Default Team',
          'MIAN orchestrating OPS and Analyst — same behavior as before the registry.',
          now,
          now,
        ),
    );

    const members: { botId: string; memberRole: string; sort: number }[] = CANONICAL_BOTS.map(
      (bot, i) => ({ botId: bot.id, memberRole: i === 0 ? 'orchestrator' : 'member', sort: i }),
    );

    for (const m of members) {
      statements.push(
        db
          .prepare(
            `INSERT INTO team_members (id, team_id, bot_id, member_role, sort_order)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(team_id, bot_id) DO UPDATE SET
               member_role = excluded.member_role,
               sort_order = excluded.sort_order`,
          )
          .bind(crypto.randomUUID(), TEAM_IDS.default, m.botId, m.memberRole, m.sort),
      );
    }

    await db.batch(statements);
    seededSignature = DEFINITIONS_SIGNATURE;
    return true;
  } catch (err) {
    logSafeError('bot_registry_seed_failed', err, {
      operation: 'ensureBotRegistrySeeded',
      category: 'persistence',
    });
    return false;
  }
}

/** Load a bot by slug from D1, or fall back to canonical registry. */
export async function getBotBySlug(
  db: D1Database | undefined,
  slug: string,
): Promise<BotDefinition | undefined> {
  const canonical = getBotRegistry().get(slug) ?? getCanonicalBot(slug);
  if (!db) return canonical;

  try {
    const row = await db
      .prepare('SELECT * FROM bots WHERE slug = ? LIMIT 1')
      .bind(slug)
      .first<BotRow>();
    if (row) return rowToBot(row);
  } catch (err) {
    logSafeError('bot_registry_get_failed', err, {
      operation: 'getBotBySlug',
      category: 'persistence',
    });
  }
  return canonical;
}

/**
 * Sync helper for agent factories — canonical Bot Registry only (no network/DB).
 * Prefer getBotRegistry().require(slug) for Factory code.
 */
export function getBotDefinition(slug: string): BotDefinition {
  return getBotRegistry().require(slug);
}

/** Resolve living-particle agent id from a bot slug / id. */
export function resolveBotParticleAgent(slugOrId: string): string | null {
  const bot = getBotRegistry().get(slugOrId);
  const particle = bot?.visual?.particleAgent?.trim();
  return particle || null;
}

export function getBotVisual(slugOrId: string): BotVisualRef | undefined {
  return getBotRegistry().get(slugOrId)?.visual;
}

export async function listInstalledBots(db?: D1Database): Promise<BotCatalogItem[]> {
  if (db) {
    try {
      const { results } = await db
        .prepare(
          `SELECT b.* FROM bots b
           INNER JOIN bot_installs i ON i.bot_id = b.id
           WHERE b.status = 'active'
           ORDER BY b.kind DESC, b.name ASC`,
        )
        .all<BotRow>();
      if (results?.length) return results.map((r) => toCatalog(rowToBot(r)));
    } catch (err) {
      logSafeError('bot_registry_list_failed', err, {
        operation: 'listInstalledBots',
        category: 'persistence',
      });
    }
  }
  return getBotRegistry()
    .list({ status: 'active' })
    .filter((b) => CANONICAL_BOTS.some((c) => c.id === b.id))
    .map(toCatalog);
}

export async function listMarketplaceBots(db?: D1Database): Promise<{
  installed: BotCatalogItem[];
  planned: BotCatalogItem[];
}> {
  const installed = await listInstalledBots(db);
  let planned = PLANNED_BOTS.map(toCatalog);

  if (db) {
    try {
      const { results } = await db
        .prepare(`SELECT * FROM bots WHERE status = 'planned' ORDER BY name ASC`)
        .all<BotRow>();
      if (results?.length) planned = results.map((r) => toCatalog(rowToBot(r)));
    } catch {
      // keep canonical planned
    }
  }

  return { installed, planned };
}
