import type { ResearchClaim, ResearchJob, ResearchSource, ResearchStatus } from '../research/types';

export async function createResearchJob(
  db: D1Database,
  input: { query: string; projectId?: string | null; createdBy?: string },
): Promise<ResearchJob> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const query = input.query.trim().slice(0, 2000);
  if (!query) throw new Error('Research query is required.');

  await db
    .prepare(
      `INSERT INTO research_jobs
        (id, query, status, error_message, synthesis, analyst_notes,
         sources_found, sources_fetched, sources_failed, knowledge_doc_id,
         created_by, project_id, meta_json, created_at, updated_at)
       VALUES (?, ?, 'searching', '', '', '', 0, 0, 0, NULL, ?, ?, '{}', ?, ?)`,
    )
    .bind(id, query, input.createdBy || 'operator', input.projectId ?? null, now, now)
    .run();

  return (await getResearchJob(db, id))!;
}

export async function getResearchJob(db: D1Database, id: string): Promise<ResearchJob | null> {
  return (
    (await db.prepare(`SELECT * FROM research_jobs WHERE id = ?`).bind(id).first<ResearchJob>()) ??
    null
  );
}

export async function listResearchJobs(
  db: D1Database,
  limit = 30,
): Promise<ResearchJob[]> {
  const { results } = await db
    .prepare(`SELECT * FROM research_jobs ORDER BY updated_at DESC LIMIT ?`)
    .bind(Math.min(Math.max(limit, 1), 100))
    .all<ResearchJob>();
  return results ?? [];
}

export async function updateResearchJob(
  db: D1Database,
  id: string,
  patch: Partial<{
    status: ResearchStatus;
    error_message: string;
    synthesis: string;
    analyst_notes: string;
    sources_found: number;
    sources_fetched: number;
    sources_failed: number;
    knowledge_doc_id: string | null;
    meta_json: string;
  }>,
): Promise<ResearchJob | null> {
  const existing = await getResearchJob(db, id);
  if (!existing) return null;
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE research_jobs SET
        status = ?, error_message = ?, synthesis = ?, analyst_notes = ?,
        sources_found = ?, sources_fetched = ?, sources_failed = ?,
        knowledge_doc_id = ?, meta_json = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      patch.status ?? existing.status,
      patch.error_message ?? existing.error_message,
      patch.synthesis ?? existing.synthesis,
      patch.analyst_notes ?? existing.analyst_notes,
      patch.sources_found ?? existing.sources_found,
      patch.sources_fetched ?? existing.sources_fetched,
      patch.sources_failed ?? existing.sources_failed,
      patch.knowledge_doc_id !== undefined ? patch.knowledge_doc_id : existing.knowledge_doc_id,
      patch.meta_json ?? existing.meta_json,
      now,
      id,
    )
    .run();
  return getResearchJob(db, id);
}

export async function insertResearchSource(
  db: D1Database,
  row: Omit<ResearchSource, 'created_at'> & { created_at?: string },
): Promise<void> {
  const now = row.created_at || new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO research_sources
        (id, job_id, rank, title, url, domain, snippet, status, http_status,
         page_title, content, error_message, retrieved_at, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.job_id,
      row.rank,
      row.title,
      row.url,
      row.domain,
      row.snippet,
      row.status,
      row.http_status,
      row.page_title,
      row.content,
      row.error_message,
      row.retrieved_at,
      row.meta_json,
      now,
    )
    .run();
}

export async function updateResearchSource(
  db: D1Database,
  id: string,
  patch: Partial<ResearchSource>,
): Promise<void> {
  const existing = await db
    .prepare(`SELECT * FROM research_sources WHERE id = ?`)
    .bind(id)
    .first<ResearchSource>();
  if (!existing) return;
  await db
    .prepare(
      `UPDATE research_sources SET
        status = ?, http_status = ?, page_title = ?, content = ?,
        error_message = ?, retrieved_at = ?, meta_json = ?
       WHERE id = ?`,
    )
    .bind(
      patch.status ?? existing.status,
      patch.http_status !== undefined ? patch.http_status : existing.http_status,
      patch.page_title ?? existing.page_title,
      patch.content ?? existing.content,
      patch.error_message ?? existing.error_message,
      patch.retrieved_at !== undefined ? patch.retrieved_at : existing.retrieved_at,
      patch.meta_json ?? existing.meta_json,
      id,
    )
    .run();
}

export async function listResearchSources(
  db: D1Database,
  jobId: string,
): Promise<ResearchSource[]> {
  const { results } = await db
    .prepare(`SELECT * FROM research_sources WHERE job_id = ? ORDER BY rank ASC`)
    .bind(jobId)
    .all<ResearchSource>();
  return results ?? [];
}

export async function insertResearchClaim(
  db: D1Database,
  claim: Omit<ResearchClaim, 'created_at'> & { created_at?: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO research_claims (id, job_id, source_id, kind, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      claim.id,
      claim.job_id,
      claim.source_id,
      claim.kind,
      claim.text,
      claim.created_at || new Date().toISOString(),
    )
    .run();
}

export async function listResearchClaims(
  db: D1Database,
  jobId: string,
): Promise<ResearchClaim[]> {
  const { results } = await db
    .prepare(`SELECT * FROM research_claims WHERE job_id = ? ORDER BY created_at ASC`)
    .bind(jobId)
    .all<ResearchClaim>();
  return results ?? [];
}
