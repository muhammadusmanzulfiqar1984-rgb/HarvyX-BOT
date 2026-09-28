-- Workspace shell entities (Projects, Knowledge, Automations, Settings, Auth, Analytics).
-- Reuses conversations/messages/attachments/bots — does not touch CRM lead data.
--
-- Conversation columns (pinned/archived/kind/project_id) are applied idempotently by
-- scripts/d1-migrate.mjs (SQLite cannot ADD COLUMN IF NOT EXISTS). Fresh and existing
-- DBs both converge via: wrangler migrations apply + ensure-conversation-columns.

CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON conversations (updated_at DESC);

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active', -- active | archived
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_docs (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  filename        TEXT NOT NULL,
  mime            TEXT NOT NULL,
  size            INTEGER NOT NULL DEFAULT 0,
  attachment_id   TEXT,
  project_id      TEXT,
  excerpt         TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_docs (project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_updated ON knowledge_docs (updated_at DESC);

CREATE TABLE IF NOT EXISTS automations (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  agent_slug      TEXT NOT NULL DEFAULT 'mian',
  prompt          TEXT NOT NULL DEFAULT '',
  tools_json      TEXT NOT NULL DEFAULT '[]',
  schedule_cron   TEXT,
  schedule_label  TEXT NOT NULL DEFAULT '',
  enabled         INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'paused', -- enabled | paused
  project_id      TEXT,
  schedule_active INTEGER NOT NULL DEFAULT 0, -- 0 until real cron runner exists
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_automations_status ON automations (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS automation_runs (
  id              TEXT PRIMARY KEY,
  automation_id   TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  status          TEXT NOT NULL, -- started | succeeded | failed
  trigger         TEXT NOT NULL DEFAULT 'manual', -- manual | schedule
  detail          TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_automation_runs ON automation_runs (automation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value_json  TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tool_settings (
  tool_id     TEXT PRIMARY KEY,
  enabled     INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS operator_accounts (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL DEFAULT 'Operator',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS operator_sessions (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES operator_accounts(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_operator_sessions_token ON operator_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_operator_sessions_expires ON operator_sessions (expires_at);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  read        INTEGER NOT NULL DEFAULT 0,
  href        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL, -- chat | team | agent_run | tool_call | error | automation | approval | file
  label       TEXT NOT NULL DEFAULT '',
  meta_json   TEXT NOT NULL DEFAULT '{}',
  duration_ms INTEGER,
  ok          INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_kind ON analytics_events (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events (created_at DESC);
