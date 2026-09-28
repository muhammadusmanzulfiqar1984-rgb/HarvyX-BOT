-- Attachment blobs (opaque UUID ids only — no filesystem paths).
CREATE TABLE IF NOT EXISTS attachments (
  id              TEXT PRIMARY KEY,
  filename        TEXT NOT NULL,
  mime            TEXT NOT NULL,
  format          TEXT NOT NULL,
  size            INTEGER NOT NULL,
  source_agent    TEXT,
  conversation_id TEXT,
  bytes           BLOB NOT NULL,
  created_at      TEXT NOT NULL,
  expires_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_expires
  ON attachments (expires_at);

CREATE INDEX IF NOT EXISTS idx_attachments_conversation
  ON attachments (conversation_id);
