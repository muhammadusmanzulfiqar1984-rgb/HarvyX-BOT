export type ResearchStatus =
  | 'searching'
  | 'fetching'
  | 'analyzing'
  | 'synthesizing'
  | 'complete'
  | 'failed';

export type ResearchSourceStatus = 'pending' | 'fetched' | 'failed' | 'skipped';

export type ResearchClaimKind = 'fact' | 'source_claim' | 'inference' | 'uncertainty';

export type ResearchJob = {
  id: string;
  query: string;
  status: ResearchStatus;
  error_message: string;
  synthesis: string;
  analyst_notes: string;
  sources_found: number;
  sources_fetched: number;
  sources_failed: number;
  knowledge_doc_id: string | null;
  created_by: string;
  project_id: string | null;
  meta_json: string;
  created_at: string;
  updated_at: string;
};

export type ResearchSource = {
  id: string;
  job_id: string;
  rank: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  status: ResearchSourceStatus;
  http_status: number | null;
  page_title: string;
  content: string;
  error_message: string;
  retrieved_at: string | null;
  meta_json: string;
  created_at: string;
};

export type ResearchClaim = {
  id: string;
  job_id: string;
  source_id: string | null;
  kind: ResearchClaimKind;
  text: string;
  created_at: string;
};
