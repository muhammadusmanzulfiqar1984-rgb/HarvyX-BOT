import { logSafeError } from '../observability';
import type { ConnectorAccountRow, ConnectorProvider, ConnectorStatus } from './types';

function parseScopes(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Upsert a connected account. Tokens stay in D1 only — never returned. */
export async function upsertConnectorAccount(
  db: D1Database,
  opts: {
    provider: ConnectorProvider;
    accountEmail: string;
    scopes: string[];
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresAt?: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO connector_accounts
         (id, provider, account_email, scopes_json, access_token, refresh_token,
          token_type, expires_at, connected_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, account_email) DO UPDATE SET
         scopes_json   = excluded.scopes_json,
         access_token  = excluded.access_token,
         refresh_token = CASE WHEN excluded.refresh_token != '' THEN excluded.refresh_token ELSE refresh_token END,
         token_type    = excluded.token_type,
         expires_at    = excluded.expires_at,
         updated_at    = excluded.updated_at`,
    )
    .bind(
      id,
      opts.provider,
      opts.accountEmail,
      JSON.stringify(opts.scopes),
      opts.accessToken,
      opts.refreshToken,
      opts.tokenType,
      opts.expiresAt ?? null,
      now,
      now,
    )
    .run();
  return id;
}

/** Get full row including tokens — server-side only. */
export async function getConnectorAccountRow(
  db: D1Database,
  provider: ConnectorProvider,
): Promise<ConnectorAccountRow | null> {
  try {
    return await db
      .prepare('SELECT * FROM connector_accounts WHERE provider = ? LIMIT 1')
      .bind(provider)
      .first<ConnectorAccountRow>();
  } catch (err) {
    logSafeError('connector_get_failed', err, { operation: 'getConnectorAccountRow', category: 'persistence' });
    return null;
  }
}

/** Public status — no tokens. */
export async function getConnectorStatus(
  db: D1Database,
  provider: ConnectorProvider,
): Promise<ConnectorStatus> {
  try {
    const row = await db
      .prepare('SELECT provider, account_email, scopes_json, connected_at FROM connector_accounts WHERE provider = ? LIMIT 1')
      .bind(provider)
      .first<Pick<ConnectorAccountRow, 'provider' | 'account_email' | 'scopes_json' | 'connected_at'>>();
    if (!row) return { provider, connected: false };
    return {
      provider,
      connected: true,
      accountEmail: row.account_email,
      scopes: parseScopes(row.scopes_json),
      connectedAt: row.connected_at,
    };
  } catch {
    return { provider, connected: false };
  }
}

/** Delete a connector account (disconnect). */
export async function deleteConnectorAccount(
  db: D1Database,
  provider: ConnectorProvider,
): Promise<void> {
  await db
    .prepare('DELETE FROM connector_accounts WHERE provider = ?')
    .bind(provider)
    .run();
}

/** Update access token after refresh — server-side only. */
export async function updateAccessToken(
  db: D1Database,
  provider: ConnectorProvider,
  accountEmail: string,
  accessToken: string,
  expiresAt?: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE connector_accounts
       SET access_token = ?, expires_at = ?, updated_at = ?
       WHERE provider = ? AND account_email = ?`,
    )
    .bind(accessToken, expiresAt ?? null, now, provider, accountEmail)
    .run();
}
