import { getDb } from '@/lib/db/cloudflare-db';

export const runtime = 'nodejs';

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const DB_UNAVAILABLE = 'Database unavailable. D1 binding (env.DB) is required.';

export async function requireDb(): Promise<
  { db: D1Database; error?: undefined } | { db?: undefined; error: Response }
> {
  const db = await getDb();
  if (!db) {
    return { error: jsonError(DB_UNAVAILABLE, 503) };
  }
  return { db };
}

export const OPERATOR_SESSION_COOKIE = 'hx_operator_session';

export type OperatorSession = {
  id: string;
  account_id: string;
  expires_at: string;
  account?: { email: string; display_name: string };
};

function sessionToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim() || null;
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${OPERATOR_SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Authenticate an operator via an unexpired row in operator_sessions.
 * Only the SHA-256 of the token is stored, so a DB leak does not leak live sessions.
 * Fails closed: no token, unknown token or expired session → 401.
 */
export async function requireOperator(request: Request): Promise<
  | { db: D1Database; session: OperatorSession; error?: undefined }
  | { db?: undefined; session?: undefined; error: Response }
> {
  const dbResult = await requireDb();
  if (dbResult.error) return { error: dbResult.error };
  const { db } = dbResult;

  const token = sessionToken(request);
  if (!token) return { error: jsonError('Operator sign-in required.', 401) };

  const row = await db
    .prepare(
      `SELECT s.id, s.account_id, s.expires_at, a.email, a.display_name
         FROM operator_sessions s
         JOIN operator_accounts a ON a.id = s.account_id
        WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now')
        LIMIT 1`,
    )
    .bind(await sha256Hex(token))
    .first<{ id: string; account_id: string; expires_at: string; email: string; display_name: string }>();

  if (!row) return { error: jsonError('Operator session invalid or expired.', 401) };

  return {
    db,
    session: {
      id: row.id,
      account_id: row.account_id,
      expires_at: row.expires_at,
      account: { email: row.email, display_name: row.display_name },
    },
  };
}
