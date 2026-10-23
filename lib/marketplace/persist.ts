/**
 * D1 persistence for connections / jobs / audit / webhooks.
 * In-memory fallback when DB is unavailable (local tests).
 * NEVER stores tokens or API keys.
 */

import type {
  ConnectionStatus,
  JobStatus,
  MarketplaceAuditEvent,
  MarketplaceConnection,
  MarketplaceJob,
  MarketplaceWebhook,
} from './types';
import { CATALOG_CAPABILITIES, CATALOG_PROVIDERS } from './catalog';
import { containsCredentialLike } from './schemas';

/** Guard so we only batch-seed providers/capabilities once per isolate. */
const gSeed = globalThis as unknown as { __hxMarketplaceCatalogSeeded?: boolean };

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

type Mem = {
  connections: MarketplaceConnection[];
  jobs: MarketplaceJob[];
  audit: MarketplaceAuditEvent[];
  webhooks: MarketplaceWebhook[];
};

const g = globalThis as unknown as { __hxMarketplaceMem?: Mem };
function mem(): Mem {
  if (!g.__hxMarketplaceMem) {
    g.__hxMarketplaceMem = { connections: [], jobs: [], audit: [], webhooks: [] };
  }
  return g.__hxMarketplaceMem;
}

export function resetMarketplaceMemoryForTests() {
  g.__hxMarketplaceMem = { connections: [], jobs: [], audit: [], webhooks: [] };
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToConnection(r: Record<string, unknown>): MarketplaceConnection {
  return {
    id: String(r.id),
    providerId: String(r.provider_id),
    accountId: String(r.account_id ?? ''),
    status: String(r.status) as ConnectionStatus,
    scopes: parseJson(String(r.scopes_json ?? '[]'), []),
    metadata: parseJson(String(r.metadata_json ?? '{}'), {}),
    connectorAccountId: (r.connector_account_id as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    lastHealthCheck: (r.last_health_check as string | null) ?? null,
  };
}

function rowToJob(r: Record<string, unknown>): MarketplaceJob {
  return {
    id: String(r.id),
    capabilityId: String(r.capability_id),
    providerId: String(r.provider_id),
    missionId: (r.mission_id as string | null) ?? null,
    taskId: (r.task_id as string | null) ?? null,
    status: String(r.status) as JobStatus,
    progress: Number(r.progress ?? 0),
    input: parseJson(String(r.input_json ?? '{}'), {}),
    output: parseJson(String(r.output_json ?? '{}'), {}),
    errorMessage: String(r.error_message ?? ''),
    attempt: Number(r.attempt ?? 0),
    maxAttempts: Number(r.max_attempts ?? 2),
    idempotencyKey: (r.idempotency_key as string | null) ?? null,
    createdBy: String(r.created_by ?? 'operator'),
    createdAt: String(r.created_at),
    startedAt: (r.started_at as string | null) ?? null,
    completedAt: (r.completed_at as string | null) ?? null,
    updatedAt: String(r.updated_at),
  };
}

function rowToAudit(r: Record<string, unknown>): MarketplaceAuditEvent {
  return {
    id: String(r.id),
    sessionId: (r.session_id as string | null) ?? null,
    userId: (r.user_id as string | null) ?? null,
    providerId: String(r.provider_id),
    capabilityId: String(r.capability_id),
    missionId: (r.mission_id as string | null) ?? null,
    taskId: (r.task_id as string | null) ?? null,
    jobId: (r.job_id as string | null) ?? null,
    status: String(r.status),
    durationMs: Number(r.duration_ms ?? 0),
    approval: String(r.approval ?? 'none'),
    resultMeta: parseJson(String(r.result_meta_json ?? '{}'), {}),
    createdAt: String(r.created_at),
  };
}

/**
 * Seed registry catalog rows into D1 so FK on marketplace_connections can succeed.
 * Catalog remains the source of truth in-memory; D1 rows are metadata mirrors only.
 * Idempotent. Does not store secrets.
 */
export async function seedMarketplaceCatalogToD1(db: D1Database | undefined): Promise<void> {
  if (!db || gSeed.__hxMarketplaceCatalogSeeded) return;
  try {
    const stmts: D1PreparedStatement[] = [];
    for (const p of CATALOG_PROVIDERS) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO marketplace_providers
              (id, name, category, description, icon, mode, catalog_status, auth_type, meta_json, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
               name=excluded.name,
               category=excluded.category,
               description=excluded.description,
               icon=excluded.icon,
               mode=excluded.mode,
               catalog_status=excluded.catalog_status,
               auth_type=excluded.auth_type,
               meta_json=excluded.meta_json,
               updated_at=excluded.updated_at`,
          )
          .bind(
            p.id,
            p.name,
            p.category,
            p.description,
            p.icon || '',
            p.mode,
            p.catalogStatus,
            p.auth,
            JSON.stringify({ connectSupported: p.connectSupported, tags: p.tags ?? [] }),
          ),
      );
    }
    for (const c of CATALOG_CAPABILITIES) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO marketplace_capabilities
              (id, provider_id, name, description, category, version, input_schema_json, output_schema_json,
               permissions_json, execution_mode, requires_connection, supports_async, supports_webhook,
               requires_approval, enabled, meta_json, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
               name=excluded.name,
               description=excluded.description,
               category=excluded.category,
               version=excluded.version,
               input_schema_json=excluded.input_schema_json,
               output_schema_json=excluded.output_schema_json,
               permissions_json=excluded.permissions_json,
               execution_mode=excluded.execution_mode,
               requires_connection=excluded.requires_connection,
               supports_async=excluded.supports_async,
               supports_webhook=excluded.supports_webhook,
               requires_approval=excluded.requires_approval,
               enabled=excluded.enabled,
               meta_json=excluded.meta_json,
               updated_at=excluded.updated_at`,
          )
          .bind(
            c.id,
            c.providerId,
            c.name,
            c.description,
            c.category,
            c.version,
            JSON.stringify(c.inputSchema ?? {}),
            JSON.stringify(c.outputSchema ?? {}),
            JSON.stringify(c.permissions ?? []),
            c.executionMode,
            c.requiresConnection ? 1 : 0,
            c.supportsAsync ? 1 : 0,
            c.supportsWebhook ? 1 : 0,
            c.requiresApproval ? 1 : 0,
            c.enabled === false ? 0 : 1,
            JSON.stringify({}),
          ),
      );
    }
    // D1 batch limit — chunk
    const CHUNK = 40;
    for (let i = 0; i < stmts.length; i += CHUNK) {
      await db.batch(stmts.slice(i, i + CHUNK));
    }
    gSeed.__hxMarketplaceCatalogSeeded = true;
  } catch {
    // Leave unseeded so a later call can retry (e.g. after migration apply).
    gSeed.__hxMarketplaceCatalogSeeded = false;
  }
}

export async function listConnections(
  db: D1Database | undefined,
  providerId?: string,
): Promise<MarketplaceConnection[]> {
  if (!db) {
    return mem().connections.filter((c) => !providerId || c.providerId === providerId);
  }
  try {
    if (providerId) {
      const { results } = await db
        .prepare(`SELECT * FROM marketplace_connections WHERE provider_id = ? ORDER BY updated_at DESC`)
        .bind(providerId)
        .all();
      return (results || []).map((r) => rowToConnection(r as Record<string, unknown>));
    }
    const { results } = await db
      .prepare(`SELECT * FROM marketplace_connections ORDER BY updated_at DESC`)
      .all();
    return (results || []).map((r) => rowToConnection(r as Record<string, unknown>));
  } catch {
    return mem().connections.filter((c) => !providerId || c.providerId === providerId);
  }
}

export async function getActiveConnection(
  db: D1Database | undefined,
  providerId: string,
): Promise<MarketplaceConnection | null> {
  const all = await listConnections(db, providerId);
  return all.find((c) => c.status === 'active') ?? null;
}

export async function upsertConnection(
  db: D1Database | undefined,
  input: {
    providerId: string;
    accountId?: string;
    status?: ConnectionStatus;
    scopes?: string[];
    metadata?: Record<string, unknown>;
    connectorAccountId?: string | null;
  },
): Promise<MarketplaceConnection> {
  if (containsCredentialLike(input.metadata)) {
    throw new Error('Connection metadata must not contain credentials.');
  }
  const accountId = input.accountId?.trim() || 'default';
  const existing = (await listConnections(db, input.providerId)).find(
    (c) => c.accountId === accountId,
  );
  const ts = nowIso();
  const conn: MarketplaceConnection = {
    id: existing?.id ?? id('mpc'),
    providerId: input.providerId,
    accountId,
    status: input.status ?? 'active',
    scopes: input.scopes ?? existing?.scopes ?? [],
    metadata: input.metadata ?? existing?.metadata ?? {},
    connectorAccountId: input.connectorAccountId ?? existing?.connectorAccountId ?? null,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
    lastHealthCheck: ts,
  };

  if (!db) {
    const m = mem();
    m.connections = m.connections.filter((c) => c.id !== conn.id);
    m.connections.push(conn);
    return conn;
  }

  await seedMarketplaceCatalogToD1(db);

  const write = () =>
    db
      .prepare(
        `INSERT INTO marketplace_connections
          (id, provider_id, account_id, status, scopes_json, metadata_json, connector_account_id, created_at, updated_at, last_health_check)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider_id, account_id) DO UPDATE SET
           status=excluded.status,
           scopes_json=excluded.scopes_json,
           metadata_json=excluded.metadata_json,
           connector_account_id=excluded.connector_account_id,
           updated_at=excluded.updated_at,
           last_health_check=excluded.last_health_check`,
      )
      .bind(
        conn.id,
        conn.providerId,
        conn.accountId,
        conn.status,
        JSON.stringify(conn.scopes),
        JSON.stringify(conn.metadata),
        conn.connectorAccountId,
        conn.createdAt,
        conn.updatedAt,
        conn.lastHealthCheck,
      )
      .run();

  try {
    await write();
    return conn;
  } catch {
    // Retry once after forcing a re-seed (FK may have failed if catalog was empty).
    gSeed.__hxMarketplaceCatalogSeeded = false;
    await seedMarketplaceCatalogToD1(db);
    try {
      await write();
      return conn;
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `Failed to persist marketplace connection: ${err.message}`
          : 'Failed to persist marketplace connection.',
      );
    }
  }
}

export async function deleteConnection(
  db: D1Database | undefined,
  connectionId: string,
): Promise<boolean> {
  if (!db) {
    const before = mem().connections.length;
    mem().connections = mem().connections.filter((c) => c.id !== connectionId);
    return mem().connections.length < before;
  }
  try {
    const res = await db
      .prepare(`DELETE FROM marketplace_connections WHERE id = ?`)
      .bind(connectionId)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  } catch {
    const before = mem().connections.length;
    mem().connections = mem().connections.filter((c) => c.id !== connectionId);
    return mem().connections.length < before;
  }
}

export async function createJob(
  db: D1Database | undefined,
  input: Omit<MarketplaceJob, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'attempt' | 'errorMessage' | 'output' | 'startedAt' | 'completedAt'> & {
    progress?: number;
    attempt?: number;
    output?: Record<string, unknown>;
  },
): Promise<MarketplaceJob> {
  if (containsCredentialLike(input.input)) {
    throw new Error('Job input must not contain credentials.');
  }
  const ts = nowIso();
  const job: MarketplaceJob = {
    id: id('mpj'),
    capabilityId: input.capabilityId,
    providerId: input.providerId,
    missionId: input.missionId ?? null,
    taskId: input.taskId ?? null,
    status: input.status,
    progress: input.progress ?? 0,
    input: input.input,
    output: input.output ?? {},
    errorMessage: '',
    attempt: input.attempt ?? 0,
    maxAttempts: input.maxAttempts,
    idempotencyKey: input.idempotencyKey ?? null,
    createdBy: input.createdBy,
    createdAt: ts,
    startedAt: null,
    completedAt: null,
    updatedAt: ts,
  };

  if (!db) {
    mem().jobs.push(job);
    return job;
  }
  try {
    await db
      .prepare(
        `INSERT INTO marketplace_jobs
          (id, capability_id, provider_id, mission_id, task_id, status, progress, input_json, output_json,
           error_message, attempt, max_attempts, idempotency_key, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        job.id,
        job.capabilityId,
        job.providerId,
        job.missionId,
        job.taskId,
        job.status,
        job.progress,
        JSON.stringify(job.input),
        JSON.stringify(job.output),
        job.attempt,
        job.maxAttempts,
        job.idempotencyKey,
        job.createdBy,
        job.createdAt,
        job.updatedAt,
      )
      .run();
    return job;
  } catch {
    mem().jobs.push(job);
    return job;
  }
}

export async function updateJob(
  db: D1Database | undefined,
  jobId: string,
  patch: Partial<
    Pick<
      MarketplaceJob,
      'status' | 'progress' | 'output' | 'errorMessage' | 'attempt' | 'startedAt' | 'completedAt'
    >
  >,
): Promise<MarketplaceJob | null> {
  const ts = nowIso();
  if (!db) {
    const job = mem().jobs.find((j) => j.id === jobId);
    if (!job) return null;
    Object.assign(job, patch, { updatedAt: ts });
    return job;
  }
  try {
    const existing = await getJob(db, jobId);
    if (!existing) return null;
    const next = { ...existing, ...patch, updatedAt: ts };
    await db
      .prepare(
        `UPDATE marketplace_jobs SET status=?, progress=?, output_json=?, error_message=?, attempt=?,
          started_at=?, completed_at=?, updated_at=? WHERE id=?`,
      )
      .bind(
        next.status,
        next.progress,
        JSON.stringify(next.output),
        next.errorMessage,
        next.attempt,
        next.startedAt,
        next.completedAt,
        next.updatedAt,
        jobId,
      )
      .run();
    return next;
  } catch {
    const job = mem().jobs.find((j) => j.id === jobId);
    if (!job) return null;
    Object.assign(job, patch, { updatedAt: ts });
    return job;
  }
}

export async function getJob(
  db: D1Database | undefined,
  jobId: string,
): Promise<MarketplaceJob | null> {
  if (!db) return mem().jobs.find((j) => j.id === jobId) ?? null;
  try {
    const row = await db
      .prepare(`SELECT * FROM marketplace_jobs WHERE id = ?`)
      .bind(jobId)
      .first();
    if (!row) return null;
    return rowToJob(row as Record<string, unknown>);
  } catch {
    return mem().jobs.find((j) => j.id === jobId) ?? null;
  }
}

export async function listJobs(
  db: D1Database | undefined,
  opts?: { status?: JobStatus; missionId?: string },
): Promise<MarketplaceJob[]> {
  if (!db) {
    return mem().jobs.filter((j) => {
      if (opts?.status && j.status !== opts.status) return false;
      if (opts?.missionId && j.missionId !== opts.missionId) return false;
      return true;
    });
  }
  try {
    let sql = `SELECT * FROM marketplace_jobs WHERE 1=1`;
    const binds: string[] = [];
    if (opts?.status) {
      sql += ` AND status = ?`;
      binds.push(opts.status);
    }
    if (opts?.missionId) {
      sql += ` AND mission_id = ?`;
      binds.push(opts.missionId);
    }
    sql += ` ORDER BY created_at DESC LIMIT 100`;
    const stmt = db.prepare(sql);
    const { results } = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
    return (results || []).map((r) => rowToJob(r as Record<string, unknown>));
  } catch {
    return mem().jobs;
  }
}

export async function findJobByIdempotency(
  db: D1Database | undefined,
  key: string,
): Promise<MarketplaceJob | null> {
  if (!key) return null;
  if (!db) return mem().jobs.find((j) => j.idempotencyKey === key) ?? null;
  try {
    const row = await db
      .prepare(`SELECT * FROM marketplace_jobs WHERE idempotency_key = ?`)
      .bind(key)
      .first();
    return row ? rowToJob(row as Record<string, unknown>) : null;
  } catch {
    return mem().jobs.find((j) => j.idempotencyKey === key) ?? null;
  }
}

export async function writeAudit(
  db: D1Database | undefined,
  event: Omit<MarketplaceAuditEvent, 'id' | 'createdAt'>,
): Promise<MarketplaceAuditEvent> {
  if (containsCredentialLike(event.resultMeta)) {
    event = { ...event, resultMeta: { redacted: true } };
  }
  const row: MarketplaceAuditEvent = {
    ...event,
    id: id('mpa'),
    createdAt: nowIso(),
  };
  if (!db) {
    mem().audit.push(row);
    return row;
  }
  try {
    await db
      .prepare(
        `INSERT INTO marketplace_audit_events
          (id, session_id, user_id, provider_id, capability_id, mission_id, task_id, job_id,
           status, duration_ms, approval, result_meta_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id,
        row.sessionId ?? null,
        row.userId ?? null,
        row.providerId,
        row.capabilityId,
        row.missionId ?? null,
        row.taskId ?? null,
        row.jobId ?? null,
        row.status,
        row.durationMs,
        row.approval,
        JSON.stringify(row.resultMeta),
        row.createdAt,
      )
      .run();
    return row;
  } catch {
    mem().audit.push(row);
    return row;
  }
}

export async function listAudit(
  db: D1Database | undefined,
  limit = 50,
): Promise<MarketplaceAuditEvent[]> {
  if (!db) return mem().audit.slice(-limit).reverse();
  try {
    const { results } = await db
      .prepare(`SELECT * FROM marketplace_audit_events ORDER BY created_at DESC LIMIT ?`)
      .bind(limit)
      .all();
    return (results || []).map((r) => rowToAudit(r as Record<string, unknown>));
  } catch {
    return mem().audit.slice(-limit).reverse();
  }
}

export async function registerWebhook(
  db: D1Database | undefined,
  input: {
    providerId: string;
    capabilityId?: string;
    urlPath: string;
    secretRef?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<MarketplaceWebhook> {
  if (containsCredentialLike(input.metadata) || containsCredentialLike(input.secretRef)) {
    throw new Error('Webhook must use secret_ref name only — raw secrets rejected.');
  }
  if (!input.urlPath.startsWith('/api/marketplace/webhooks/')) {
    throw new Error('Webhook path must be under /api/marketplace/webhooks/.');
  }
  const ts = nowIso();
  const wh: MarketplaceWebhook = {
    id: id('mpw'),
    providerId: input.providerId,
    capabilityId: input.capabilityId ?? null,
    urlPath: input.urlPath,
    secretRef: input.secretRef ?? '',
    status: 'active',
    metadata: input.metadata ?? {},
    createdAt: ts,
    updatedAt: ts,
  };
  if (!db) {
    mem().webhooks.push(wh);
    return wh;
  }
  try {
    await db
      .prepare(
        `INSERT INTO marketplace_webhooks
          (id, provider_id, capability_id, url_path, secret_ref, status, meta_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      )
      .bind(
        wh.id,
        wh.providerId,
        wh.capabilityId,
        wh.urlPath,
        wh.secretRef,
        JSON.stringify(wh.metadata),
        wh.createdAt,
        wh.updatedAt,
      )
      .run();
    return wh;
  } catch {
    mem().webhooks.push(wh);
    return wh;
  }
}

export async function getWebhookByPath(
  db: D1Database | undefined,
  urlPath: string,
): Promise<MarketplaceWebhook | null> {
  if (!db) return mem().webhooks.find((w) => w.urlPath === urlPath && w.status === 'active') ?? null;
  try {
    const row = await db
      .prepare(`SELECT * FROM marketplace_webhooks WHERE url_path = ? AND status = 'active'`)
      .bind(urlPath)
      .first();
    if (!row) return null;
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      providerId: String(r.provider_id),
      capabilityId: (r.capability_id as string | null) ?? null,
      urlPath: String(r.url_path),
      secretRef: String(r.secret_ref ?? ''),
      status: String(r.status) as 'active',
      metadata: parseJson(String(r.meta_json ?? '{}'), {}),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  } catch {
    return mem().webhooks.find((w) => w.urlPath === urlPath) ?? null;
  }
}
