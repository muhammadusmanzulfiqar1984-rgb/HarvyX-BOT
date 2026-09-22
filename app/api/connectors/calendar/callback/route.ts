import { getCloudflareContext } from '@opennextjs/cloudflare';
import { exchangeCode, fetchGoogleEmail } from '@/lib/connectors/gmail-oauth';
import { CALENDAR_SCOPES, getCalendarRedirectUri } from '@/lib/connectors/calendar-oauth';
import { upsertConnectorAccount } from '@/lib/connectors/db';
import { logSafe, logSafeError } from '@/lib/observability';

export const runtime = 'nodejs';

function clearStateCookie() {
  return 'calendar_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
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
      Location: '/?connector_success=calendar',
      'Set-Cookie': clearStateCookie(),
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    logSafe('calendar_oauth_denied', { operation: 'GET /api/connectors/calendar/callback' });
    return errorRedirect('access_denied');
  }

  if (!code || !state) {
    return errorRedirect('missing_params');
  }

  const cookieHeader = request.headers.get('cookie') ?? '';
  const storedState = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('calendar_oauth_state='))
    ?.split('=')[1];

  if (!storedState || storedState !== state) {
    logSafe('calendar_oauth_state_mismatch', { operation: 'GET /api/connectors/calendar/callback' });
    return errorRedirect('state_mismatch');
  }

  const { env } = await getCloudflareContext({ async: true });

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return errorRedirect('not_configured');
  }

  try {
    const redirectUri = getCalendarRedirectUri(request.url);
    const tokens = await exchangeCode(env, code, redirectUri);

    if (!tokens.access_token) {
      return errorRedirect('no_access_token');
    }

    const email = await fetchGoogleEmail(tokens.access_token);

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined;

    const grantedScopes = tokens.scope
      ? tokens.scope.split(' ').filter(Boolean)
      : CALENDAR_SCOPES;

    await upsertConnectorAccount(env.DB, {
      provider: 'calendar',
      accountEmail: email,
      scopes: grantedScopes,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? '',
      tokenType: tokens.token_type ?? 'Bearer',
      expiresAt,
    });

    logSafe('calendar_connected', { operation: 'GET /api/connectors/calendar/callback' });
    return successRedirect();
  } catch (err) {
    logSafeError('calendar_callback_failed', err, {
      operation: 'GET /api/connectors/calendar/callback',
      category: 'auth',
    });
    return errorRedirect('exchange_failed');
  }
}
