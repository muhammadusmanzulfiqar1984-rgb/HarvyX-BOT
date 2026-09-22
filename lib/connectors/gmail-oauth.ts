import { logSafeError } from '../observability';
import { updateAccessToken } from './db';
import type { ConnectorAccountRow } from './types';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export interface GmailEnv {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI?: string;
}

export function getRedirectUri(env: GmailEnv, requestUrl?: string): string {
  if (env.GOOGLE_REDIRECT_URI) return env.GOOGLE_REDIRECT_URI;
  if (requestUrl) {
    const u = new URL(requestUrl);
    return `${u.protocol}//${u.host}/api/connectors/gmail/callback`;
  }
  return 'http://localhost:3000/api/connectors/gmail/callback';
}

/** Build the Google OAuth authorization URL. */
export function buildAuthUrl(env: GmailEnv, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

/** Exchange authorization code for tokens. */
export async function exchangeCode(
  env: GmailEnv,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    throw new Error('Token exchange failed');
  }
  return res.json() as Promise<TokenResponse>;
}

/** Refresh an expired access token using the stored refresh token. */
export async function refreshAccessToken(
  env: GmailEnv,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Token refresh failed');
  const data = (await res.json()) as TokenResponse;
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : new Date(Date.now() + 3600 * 1000).toISOString();
  return { accessToken: data.access_token, expiresAt };
}

/** Get a valid access token, refreshing if expired. Updates D1 if refreshed. */
export async function getValidAccessToken(
  db: D1Database,
  env: GmailEnv,
  row: ConnectorAccountRow,
): Promise<string> {
  const now = Date.now();
  const expiry = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  // Refresh if expired or expiring within 60s
  if (expiry - now < 60_000) {
    if (!row.refresh_token) throw new Error('No refresh token available');
    try {
      const { accessToken, expiresAt } = await refreshAccessToken(env, row.refresh_token);
      await updateAccessToken(db, 'gmail', row.account_email, accessToken, expiresAt);
      return accessToken;
    } catch (err) {
      logSafeError('gmail_token_refresh_failed', err, { operation: 'getValidAccessToken', category: 'auth' });
      throw new Error('Gmail authorization expired. Please reconnect.');
    }
  }
  return row.access_token;
}

/** Fetch the Google account email from userinfo endpoint. */
export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Google user info');
  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error('No email in Google userinfo response');
  return data.email;
}
