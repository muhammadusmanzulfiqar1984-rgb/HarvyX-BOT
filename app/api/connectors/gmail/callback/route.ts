import { getCloudflareContext } from '@opennextjs/cloudflare';
import { exchangeCode, fetchGoogleEmail, getRedirectUri, GMAIL_SCOPES } from '@/lib/connectors/gmail-oauth';
import { upsertConnectorAccount } from '@/lib/connectors/db';
import { logSafe, logSafeError } from '@/lib/observability';

export const runtime = 'nodejs';

function clearStateCookie() {
  return 'gmail_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}

function errorRedirect(reason: string) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/?connector_error=${encodeURIComponent(reason)}`,
      'Set-Cookie': clearStateCookie(),
    },
  });
}

function successRedirect() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/?connector_success=gmail',
      'Set-Cookie': clearStateCookie(),
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  // Google returned an error (e.g. user denied)
  if (errorParam) {
    logSafe('gmail_oauth_denied', { operation: 'GET /api/connectors/gmail/callback' });
    return errorRedirect('access_denied');
  }

  if (!code || !state) {
    return errorRedirect('missing_params');
  }

  // Validate CSRF state from cookie
  const cookieHeader = request.headers.get('cookie') ?? '';
  const storedState = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('gmail_oauth_state='))
    ?.split('=')[1];

  if (!storedState || storedState !== state) {
    logSafe('gmail_oauth_state_mismatch', { operation: 'GET /api/connectors/gmail/callback' });
    return errorRedirect('state_mismatch');
  }

  const { env } = await getCloudflareContext({ async: true });

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return errorRedirect('not_configured');
  }

  try {
    const redirectUri = getRedirectUri(env, request.url);
    const tokens = await exchangeCode(env, code, redirectUri);

    if (!tokens.access_token) {
      return errorRedirect('no_access_token');
    }

    const email = await fetchGoogleEmail(tokens.access_token);

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined;

    // Determine granted scopes — fall back to requested scopes if not returned
    const grantedScopes = tokens.scope
      ? tokens.scope.split(' ').filter(Boolean)
      : GMAIL_SCOPES;

    await upsertConnectorAccount(env.DB, {
      provider: 'gmail',
      accountEmail: email,
      scopes: grantedScopes,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? '',
      tokenType: tokens.token_type ?? 'Bearer',
      expiresAt,
    });

    logSafe('gmail_connected', { operation: 'GET /api/connectors/gmail/callback' });
    return successRedirect();
  } catch (err) {
    logSafeError('gmail_callback_failed', err, {
      operation: 'GET /api/connectors/gmail/callback',
      category: 'auth',
    });
    return errorRedirect('exchange_failed');
  }
}
