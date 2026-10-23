-- Knowledge RAG — extends knowledge_docs + chunk/scope tables.
-- Applied once via wrangler d1 migrations apply (do not edit after remote apply).
-- Existing knowledge_docs rows receive status='unindexed' (not READY for RAG until processed).

ALTER TABLE knowledge_docs ADD COLUMN status TEXT NOT NULL DEFAULT 'unindexed';
ALTER TABLE knowledge_docs ADD COLUMN owner TEXT NOT NULL DEFAULT 'operator';
ALTER TABLE knowledge_docs ADD COLUMN checksum TEXT;
ALTER TABLE knowledge_docs ADD COLUMN error_message TEXT NOT NULL DEFAULT '';
ALTER TABLE knowledge_docs ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_docs ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE knowledge_docs ADD COLUMN source_meta_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE knowledge_docs ADD COLUMN indexed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_docs (status, archived, updated_at DESC);

-- Explicit authorization scopes. A document may have multiple rows.
-- scope_kind: shared | bot | project
CREATE TABLE IF NOT EXISTS knowledge_doc_scopes (
  id          TEXT PRIMARY KEY,
  doc_id      TEXT NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  scope_kind  TEXT NOT NULL,
  bot_slug    TEXT,
  project_id  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (doc_id, scope_kind, bot_slug, project_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_scopes_doc ON knowledge_doc_scopes (doc_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_scopes_bot ON knowledge_doc_scopes (scope_kind, bot_slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_scopes_project ON knowledge_doc_scopes (scope_kind, project_id);

-- Document version snapshots (metadata; bytes remain in attachments).
CREATE TABLE IF NOT EXISTS knowledge_doc_versions (
  id              TEXT PRIMARY KEY,
  doc_id          TEXT NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  attachment_id   TEXT,
  checksum        TEXT,
  size            INTEGER NOT NULL DEFAULT 0,
  mime            TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (doc_id, version)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_versions_doc ON knowledge_doc_versions (doc_id, version DESC);

-- Chunks + embedding vectors (JSON float arrays). D1 is not a vector DB —
-- retrieval filters by permission in SQL, then scores cosine similarity in-process.
-- Swap embedding_json storage for Vectorize later without changing agent tools.
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id                TEXT PRIMARY KEY,
  doc_id            TEXT NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL DEFAULT 1,
  chunk_index       INTEGER NOT NULL,
  text              TEXT NOT NULL,
  page              INTEGER,
  section           TEXT,
  char_start        INTEGER NOT NULL DEFAULT 0,
  char_end          INTEGER NOT NULL DEFAULT 0,
  token_estimate    INTEGER NOT NULL DEFAULT 0,
  embedding_json    TEXT NOT NULL DEFAULT '[]',
  embedding_model   TEXT NOT NULL DEFAULT '',
  embedding_dims    INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (doc_id, version, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks (doc_id, version, chunk_index);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_ready ON knowledge_chunks (doc_id);
