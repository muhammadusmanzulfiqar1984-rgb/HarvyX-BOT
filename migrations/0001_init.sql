CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT 'New conversation',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  parts           TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  seq             INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, seq);
