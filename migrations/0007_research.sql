-- Research jobs + multi-source evidence (Knowledge RAG remains in 0006).
-- Applied via wrangler d1 migrations apply — do not edit after remote apply.

CREATE TABLE IF NOT EXISTS research_jobs (
  id              TEXT PRIMARY KEY,
  query           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'searching',
  -- searching | fetching | analyzing | synthesizing | complete | failed
  error_message   TEXT NOT NULL DEFAULT '',
  synthesis       TEXT NOT NULL DEFAULT '',
  analyst_notes   TEXT NOT NULL DEFAULT '',
  sources_found   INTEGER NOT NULL DEFAULT 0,
  sources_fetched INTEGER NOT NULL DEFAULT 0,
  sources_failed  INTEGER NOT NULL DEFAULT 0,
  knowledge_doc_id TEXT,
  created_by      TEXT NOT NULL DEFAULT 'operator',
  project_id      TEXT,
  meta_json       TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_jobs_status ON research_jobs (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_jobs_project ON research_jobs (project_id);

CREATE TABLE IF NOT EXISTS research_sources (
  id              TEXT PRIMARY KEY,
  job_id          TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
  rank            INTEGER NOT NULL DEFAULT 0,
  title           TEXT NOT NULL DEFAULT '',
  url             TEXT NOT NULL,
  domain          TEXT NOT NULL DEFAULT '',
  snippet         TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending',
  -- pending | fetched | failed | skipped
  http_status     INTEGER,
  page_title      TEXT NOT NULL DEFAULT '',
  content         TEXT NOT NULL DEFAULT '',
  error_message   TEXT NOT NULL DEFAULT '',
  retrieved_at    TEXT,
  meta_json       TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_sources_job ON research_sources (job_id, rank);

CREATE TABLE IF NOT EXISTS research_claims (
  id              TEXT PRIMARY KEY,
  job_id          TEXT NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
  source_id       TEXT REFERENCES research_sources(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL DEFAULT 'source_claim',
  -- fact | source_claim | inference | uncertainty
  text            TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_claims_job ON research_claims (job_id);
