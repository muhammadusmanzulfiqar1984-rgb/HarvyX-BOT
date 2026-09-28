/**
 * Canonical Knowledge object model (RAG).
 * Extends knowledge_docs — does not create a second knowledge system.
 */

export const KNOWLEDGE_STATUSES = [
  'uploading',
  'processing',
  'indexing',
  'ready',
  'failed',
  'unindexed',
  'archived',
] as const;

export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

/** Explicit authorization scopes — never implied. */
export type KnowledgeScopeKind = 'shared' | 'bot' | 'project';

export type KnowledgeScope = {
  id: string;
  doc_id: string;
  scope_kind: KnowledgeScopeKind;
  bot_slug: string | null;
  project_id: string | null;
  created_at: string;
};

export type KnowledgeSourceMeta = {
  pages?: number;
  sections?: string[];
  extractor?: string;
  notes?: string[];
};

export type KnowledgeDocRecord = {
  id: string;
  title: string;
  filename: string;
  mime: string;
  size: number;
  attachment_id: string | null;
  project_id: string | null;
  excerpt: string;
  status: KnowledgeStatus;
  owner: string;
  checksum: string | null;
  error_message: string;
  archived: number;
  version: number;
  source_meta_json: string;
  indexed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeChunkRecord = {
  id: string;
  doc_id: string;
  version: number;
  chunk_index: number;
  text: string;
  page: number | null;
  section: string | null;
  char_start: number;
  char_end: number;
  token_estimate: number;
  embedding_json: string;
  embedding_model: string;
  embedding_dims: number;
  created_at: string;
};

export type KnowledgeChunkDraft = {
  chunk_index: number;
  text: string;
  page?: number | null;
  section?: string | null;
  char_start: number;
  char_end: number;
  token_estimate: number;
};

export type RetrievedChunk = {
  chunkId: string;
  docId: string;
  title: string;
  filename: string;
  text: string;
  score: number;
  page: number | null;
  section: string | null;
  chunkIndex: number;
  scopes: KnowledgeScope[];
  citation: string;
};

export type KnowledgeSearchResult = {
  query: string;
  chunks: RetrievedChunk[];
  /** Human-readable citations for UI / agent. */
  sources: string[];
};

export const BOT_KNOWLEDGE_SLUGS = ['mian', 'ops', 'analyst', 'scrape', 'social'] as const;
export type BotKnowledgeSlug = (typeof BOT_KNOWLEDGE_SLUGS)[number];

export function isKnowledgeStatus(v: string): v is KnowledgeStatus {
  return (KNOWLEDGE_STATUSES as readonly string[]).includes(v);
}

export function isReadyForRetrieval(doc: Pick<KnowledgeDocRecord, 'status' | 'archived'>): boolean {
  return doc.status === 'ready' && !doc.archived;
}
