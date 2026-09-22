import { getCloudflareContext } from '@opennextjs/cloudflare';
import { buildAuthUrl } from '@/lib/connectors/gmail-oauth';
import { CALENDAR_SCOPES, getCalendarRedirectUri } from '@/lib/connectors/calendar-oauth';
import { logSafe } from '@/lib/observability';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return Response.json({ error: 'Calendar connector is not configured.' }, { status: 503 });
  }

  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, '0')).join('');

  const redirectUri = getCalendarRedirectUri(request.url);
  const authUrl = buildAuthUrl(env, state, redirectUri, CALENDAR_SCOPES);

  logSafe('calendar_oauth_initiated', { operation: 'GET /api/connectors/calendar/connect' });

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      'Set-Cookie': [
        `calendar_oauth_state=${state}`,
        'HttpOnly',
        'SameSite=Lax',
        'Path=/',
        'Max-Age=600',
        ...(new URL(request.url).protocol === 'https:' ? ['Secure'] : []),
      ].join('; '),
    },
  });
}
