import { getCloudflareContext } from '@opennextjs/cloudflare';
import { buildAuthUrl, getRedirectUri } from '@/lib/connectors/gmail-oauth';
import { logSafe } from '@/lib/observability';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return Response.json({ error: 'Gmail connector is not configured.' }, { status: 503 });
  }

  // Cryptographically random CSRF state — 32 bytes → 64 hex chars
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, '0')).join('');

  const redirectUri = getRedirectUri(env, request.url);
  const authUrl = buildAuthUrl(env, state, redirectUri);

  logSafe('gmail_oauth_initiated', { operation: 'GET /api/connectors/gmail/connect' });

  // Store state in a HttpOnly, SameSite=Lax cookie (10 min TTL)
  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      'Set-Cookie': [
        `gmail_oauth_state=${state}`,
        'HttpOnly',
        'SameSite=Lax',
        'Path=/',
        'Max-Age=600',
        // Secure only in production (localhost is http)
        ...(new URL(request.url).protocol === 'https:' ? ['Secure'] : []),
      ].join('; '),
    },
  });
}
