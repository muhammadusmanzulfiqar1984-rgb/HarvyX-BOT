-- Bot Registry (Phase 0) — first-class Bot records.
-- Seed rows are upserted at runtime from lib/bots/definitions.ts (verbatim prompts).

CREATE TABLE IF NOT EXISTS bots (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'specialist',
  description   TEXT NOT NULL DEFAULT '',
  instructions  TEXT NOT NULL,
  model_tier    TEXT NOT NULL DEFAULT 'fast',
  tool_pack     TEXT NOT NULL DEFAULT 'none',
  status        TEXT NOT NULL DEFAULT 'active',
  tags_json     TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bots_status ON bots (status);
CREATE INDEX IF NOT EXISTS idx_bots_kind ON bots (kind);

CREATE TABLE IF NOT EXISTS bot_installs (
  id          TEXT PRIMARY KEY,
  bot_id      TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (bot_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_members (
  id       TEXT PRIMARY KEY,
  team_id  TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  bot_id   TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (team_id, bot_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members (team_id, sort_order);
