-- Marketplace / Integration Gateway / Capability Engine
-- Catalog-backed providers + capabilities; D1 holds connections, jobs, audit, webhooks.
-- NEVER store raw credentials here — OAuth tokens remain in connector_accounts (0003).

CREATE TABLE IF NOT EXISTS marketplace_providers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  icon            TEXT NOT NULL DEFAULT '',
  mode            TEXT NOT NULL DEFAULT 'CATALOG',
  -- NATIVE_API | MCP | WEB | LOCAL | INTERNAL | WEBHOOK | CATALOG
  catalog_status  TEXT NOT NULL DEFAULT 'available',
  -- available | coming_soon | disabled
  auth_type       TEXT NOT NULL DEFAULT 'none',
  -- none | oauth | api_key | mcp | internal
  meta_json       TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mp_providers_category ON marketplace_providers (category, catalog_status);

CREATE TABLE IF NOT EXISTS marketplace_capabilities (
  id                  TEXT PRIMARY KEY,
  provider_id         TEXT NOT NULL REFERENCES marketplace_providers(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  category            TEXT NOT NULL,
  version             TEXT NOT NULL DEFAULT '1.0.0',
  input_schema_json   TEXT NOT NULL DEFAULT '{}',
  output_schema_json  TEXT NOT NULL DEFAULT '{}',
  permissions_json    TEXT NOT NULL DEFAULT '[]',
  execution_mode      TEXT NOT NULL DEFAULT 'sync',
  -- sync | async | either
  requires_connection INTEGER NOT NULL DEFAULT 1,
  supports_async      INTEGER NOT NULL DEFAULT 0,
  supports_webhook    INTEGER NOT NULL DEFAULT 0,
  requires_approval   INTEGER NOT NULL DEFAULT 0,
  enabled             INTEGER NOT NULL DEFAULT 1,
  meta_json           TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mp_caps_provider ON marketplace_capabilities (provider_id, enabled);
CREATE INDEX IF NOT EXISTS idx_mp_caps_category ON marketplace_capabilities (category, enabled);

-- Connection metadata only — NO access/refresh tokens, NO API keys.
CREATE TABLE IF NOT EXISTS marketplace_connections (
  id                    TEXT PRIMARY KEY,
  provider_id           TEXT NOT NULL REFERENCES marketplace_providers(id) ON DELETE CASCADE,
  account_id            TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'active',
  -- active | expired | error | revoked | pending
  scopes_json           TEXT NOT NULL DEFAULT '[]',
  metadata_json         TEXT NOT NULL DEFAULT '{}',
  connector_account_id  TEXT,
  -- optional FK-like ref to connector_accounts.id (tokens stay there)
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  last_health_check     TEXT,
  UNIQUE (provider_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_mp_conn_provider ON marketplace_connections (provider_id, status);

CREATE TABLE IF NOT EXISTS marketplace_jobs (
  id              TEXT PRIMARY KEY,
  capability_id   TEXT NOT NULL,
  provider_id     TEXT NOT NULL,
  mission_id      TEXT,
  task_id         TEXT,
  status          TEXT NOT NULL DEFAULT 'QUEUED',
  -- QUEUED|RUNNING|WAITING|REQUIRES_APPROVAL|COMPLETED|FAILED|CANCELLED
  progress        INTEGER NOT NULL DEFAULT 0,
  input_json      TEXT NOT NULL DEFAULT '{}',
  output_json     TEXT NOT NULL DEFAULT '{}',
  error_message   TEXT NOT NULL DEFAULT '',
  attempt         INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 2,
  idempotency_key TEXT,
  created_by      TEXT NOT NULL DEFAULT 'operator',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  started_at      TEXT,
  completed_at    TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mp_jobs_status ON marketplace_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_mp_jobs_mission ON marketplace_jobs (mission_id, task_id);
CREATE INDEX IF NOT EXISTS idx_mp_jobs_capability ON marketplace_jobs (capability_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_jobs_idem ON marketplace_jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key != '';

CREATE TABLE IF NOT EXISTS marketplace_audit_events (
  id              TEXT PRIMARY KEY,
  session_id      TEXT,
  user_id         TEXT,
  provider_id     TEXT NOT NULL,
  capability_id   TEXT NOT NULL,
  mission_id      TEXT,
  task_id         TEXT,
  job_id          TEXT,
  status          TEXT NOT NULL,
  duration_ms     INTEGER NOT NULL DEFAULT 0,
  approval        TEXT NOT NULL DEFAULT 'none',
  result_meta_json TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mp_audit_cap ON marketplace_audit_events (capability_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_audit_provider ON marketplace_audit_events (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_audit_mission ON marketplace_audit_events (mission_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_webhooks (
  id              TEXT PRIMARY KEY,
  provider_id     TEXT NOT NULL,
  capability_id   TEXT,
  url_path        TEXT NOT NULL,
  secret_ref      TEXT NOT NULL DEFAULT '',
  -- reference name only — never the raw secret
  status          TEXT NOT NULL DEFAULT 'active',
  -- active | paused | revoked
  meta_json       TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mp_webhooks_provider ON marketplace_webhooks (provider_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_webhooks_path ON marketplace_webhooks (url_path);
