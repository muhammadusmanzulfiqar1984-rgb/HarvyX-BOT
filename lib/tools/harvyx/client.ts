import {
  categorizeError,
  humanMessageForCategory,
  logSafe,
  logSafeError,
  sanitizeForLog,
  type ErrorCategory,
} from '../../observability';

export interface HarvyxEnv {
  HARVYX_API_KEY: string;
  HARVYX_API_BASE?: string;
  /** Optional override; default 20s */
  HARVYX_TIMEOUT_MS?: string;
}

export const DEFAULT_TIMEOUT_MS = 20_000;
export const DEFAULT_LEAD_LIMIT = 10;
export const MAX_LEAD_LIMIT = 25;
export const MAX_DISCOVER_LIMIT = 20;
export const MAX_CAMPAIGN_LEAD_IDS = 500;

export const LEAD_STATUSES = [
  'new',
  'enriched',
  'contacted',
  'replied',
  'qualified',
  'won',
  'lost',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export class HarvyxConnectorError extends Error {
  category: ErrorCategory;
  status?: number;

  constructor(category: ErrorCategory, message: string, status?: number) {
    super(message);
    this.name = 'HarvyxConnectorError';
    this.category = category;
    this.status = status;
  }
}

function timeoutMs(env: HarvyxEnv): number {
  const n = Number(env.HARVYX_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 1000 ? Math.min(n, 60_000) : DEFAULT_TIMEOUT_MS;
}

function mergeSignals(timeout: AbortSignal, external?: AbortSignal): AbortSignal {
  if (!external) return timeout;
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([timeout, external]);
  }
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (timeout.aborted || external.aborted) {
    ctrl.abort();
    return ctrl.signal;
  }
  timeout.addEventListener('abort', onAbort, { once: true });
  external.addEventListener('abort', onAbort, { once: true });
  return ctrl.signal;
}

function categoryForStatus(status: number): ErrorCategory {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'harvyx';
  return 'harvyx';
}

export type HarvyxRequestOptions = RequestInit & { abortSignal?: AbortSignal };

/**
 * Server-only HarvYX HTTP helper.
 * Never logs or returns HARVYX_API_KEY.
 */
export async function harvyxRequest(
  env: HarvyxEnv,
  path: string,
  options: HarvyxRequestOptions = {},
): Promise<unknown> {
  const started = Date.now();
  const base = (env.HARVYX_API_BASE || 'https://www.harvics.com').replace(/\/$/, '');
  // path must start with / and must not be an absolute URL
  if (!path.startsWith('/') || path.includes('://')) {
    throw new HarvyxConnectorError('validation', 'Invalid HarvYX path.');
  }
  const url = `${base}/api/harvyx${path}`;
  const { abortSignal, ...init } = options;

  if (!env.HARVYX_API_KEY?.trim()) {
    throw new HarvyxConnectorError('auth', humanMessageForCategory('auth'));
  }

  const timer = AbortSignal.timeout(timeoutMs(env));
  const signal = mergeSignals(timer, abortSignal);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.HARVYX_API_KEY,
        ...(init.headers || {}),
      },
    });
  } catch (err) {
    const category =
      err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
        ? 'timeout'
        : 'network';
    logSafeError('harvyx_fetch_failed', err, {
      agent: 'OPS',
      operation: path.split('?')[0],
      category,
      elapsedMs: Date.now() - started,
    });
    throw new HarvyxConnectorError(category, humanMessageForCategory(category));
  }

  const rawText = await res.text();
  let body: unknown = null;
  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      if (!res.ok) {
        const category = categoryForStatus(res.status);
        throw new HarvyxConnectorError(category, humanMessageForCategory(category), res.status);
      }
      throw new HarvyxConnectorError('harvyx', 'HarvYX returned a malformed JSON response.');
    }
  }

  if (!res.ok) {
    const category = categoryForStatus(res.status);
    logSafe('harvyx_http_error', {
      agent: 'OPS',
      operation: path.split('?')[0],
      category,
      status: res.status,
      elapsedMs: Date.now() - started,
      message: sanitizeForLog(
        typeof body === 'object' && body && 'error' in body
          ? (body as { error?: unknown }).error
          : rawText,
      ),
    });
    // Prefer API error string when safe/short, else generic category message.
    let message = humanMessageForCategory(category);
    if (
      typeof body === 'object' &&
      body &&
      'error' in body &&
      typeof (body as { error?: unknown }).error === 'string'
    ) {
      const apiErr = sanitizeForLog((body as { error: string }).error, 160);
      if (apiErr && !/api[_-]?key|authorization|bearer/i.test(apiErr)) {
        message = apiErr;
      }
    }
    throw new HarvyxConnectorError(category, message, res.status);
  }

  logSafe('harvyx_ok', {
    agent: 'OPS',
    operation: path.split('?')[0],
    status: res.status,
    elapsedMs: Date.now() - started,
  });

  return body;
}

export function toolErrorResult(err: unknown, operation: string): Record<string, unknown> {
  if (err instanceof HarvyxConnectorError) {
    logSafeError('harvyx_tool_error', err, {
      agent: 'OPS',
      operation,
      category: err.category,
      status: err.status,
    });
    return {
      ok: false,
      error: { category: err.category, message: err.message },
    };
  }
  const category = categorizeError(err);
  logSafeError('harvyx_tool_error', err, { agent: 'OPS', operation, category });
  return {
    ok: false,
    error: { category, message: humanMessageForCategory(category) },
  };
}

export function clampLeadLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LEAD_LIMIT;
  return Math.min(Math.max(Math.floor(limit), 1), MAX_LEAD_LIMIT);
}

export function clampDiscoverLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return 10;
  return Math.min(Math.max(Math.floor(limit), 1), MAX_DISCOVER_LIMIT);
}
