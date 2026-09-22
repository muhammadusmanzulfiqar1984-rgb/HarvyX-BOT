-- Connector accounts — stores OAuth tokens for external service integrations.
-- One row per connected account per provider.
-- Refresh tokens are stored server-side only and never returned to the browser.

CREATE TABLE IF NOT EXISTS connector_accounts (
  id              TEXT PRIMARY KEY,
  provider        TEXT NOT NULL,                -- 'gmail', 'outlook', 'calendar', etc.
  account_email   TEXT NOT NULL,
  scopes_json     TEXT NOT NULL DEFAULT '[]',   -- JSON array of granted scopes
  access_token    TEXT NOT NULL DEFAULT '',     -- short-lived, refreshed server-side
  refresh_token   TEXT NOT NULL DEFAULT '',     -- long-lived, never sent to client
  token_type      TEXT NOT NULL DEFAULT 'Bearer',
  expires_at      TEXT,                         -- ISO datetime of access token expiry
  connected_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, account_email)
);

CREATE INDEX IF NOT EXISTS idx_connector_accounts_provider ON connector_accounts (provider);
