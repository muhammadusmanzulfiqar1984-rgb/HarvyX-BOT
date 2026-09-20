import {
  CANONICAL_BOTS,
  PLANNED_BOTS,
  TEAM_IDS,
  getCanonicalBot,
} from './definitions';
import type { BotCatalogItem, BotKind, BotModelTier, BotRecord, BotStatus, BotToolPack } from './types';
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

function parseTags(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function rowToBot(row: BotRow): BotRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    role: row.role,
    kind: row.kind as BotKind,
    description: row.description,
    instructions: row.instructions,
    modelTier: row.model_tier as BotModelTier,
    toolPack: row.tool_pack as BotToolPack,
    status: row.status as BotStatus,
    tags: parseTags(row.tags_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCatalog(bot: BotRecord): BotCatalogItem {
  return {
    id: bot.id,
    slug: bot.slug,
    name: bot.name,
    role: bot.role,
    kind: bot.kind,
    description: bot.description,
    status: bot.status,
    tags: bot.tags,
    modelTier: bot.modelTier,
    toolPack: bot.toolPack,
  };
}

/**
 * Upsert canonical bots + default team into D1.
 * Safe to call on every chat request — idempotent.
 * Falls back silently if D1 / migration not applied yet.
 */
export async function ensureBotRegistrySeeded(db: D1Database): Promise<boolean> {
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
              status = excluded.status,
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

    const members: { botId: string; memberRole: string; sort: number }[] = [
      { botId: CANONICAL_BOTS[0].id, memberRole: 'orchestrator', sort: 0 },
      { botId: CANONICAL_BOTS[1].id, memberRole: 'member', sort: 1 },
      { botId: CANONICAL_BOTS[2].id, memberRole: 'member', sort: 2 },
    ];

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
    return true;
  } catch (err) {
    logSafeError('bot_registry_seed_failed', err, {
      operation: 'ensureBotRegistrySeeded',
      category: 'persistence',
    });
    return false;
  }
}

/** Load a bot by slug from D1, or fall back to canonical definitions. */
export async function getBotBySlug(
  db: D1Database | undefined,
  slug: string,
): Promise<BotRecord | undefined> {
  const canonical = getCanonicalBot(slug);
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

/** Sync helper for agent factories — canonical definitions only (no network/DB). */
export function getBotDefinition(slug: string): BotRecord {
  const bot = getCanonicalBot(slug);
  if (!bot) throw new Error(`Unknown bot slug: ${slug}`);
  return bot;
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
  return CANONICAL_BOTS.map(toCatalog);
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
