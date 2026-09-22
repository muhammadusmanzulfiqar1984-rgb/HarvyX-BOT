import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getConnectorAccountRow, deleteConnectorAccount } from '@/lib/connectors/db';
import { GOOGLE_REVOKE_URL } from '@/lib/connectors/gmail-oauth';
import { logSafe, logSafeError } from '@/lib/observability';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const row = await getConnectorAccountRow(env.DB, 'calendar');

    if (!row) {
      return Response.json({ ok: true, message: 'Not connected.' });
    }

    const tokenToRevoke = row.refresh_token || row.access_token;
    if (tokenToRevoke) {
      try {
        await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(tokenToRevoke)}`, {
          method: 'POST',
        });
      } catch (err) {
        logSafeError('calendar_revoke_failed', err, {
          operation: 'POST /api/connectors/calendar/disconnect',
          category: 'auth',
        });
      }
    }

    await deleteConnectorAccount(env.DB, 'calendar');
    logSafe('calendar_disconnected', { operation: 'POST /api/connectors/calendar/disconnect' });
    return Response.json({ ok: true });
  } catch (err) {
    logSafeError('calendar_disconnect_failed', err, {
      operation: 'POST /api/connectors/calendar/disconnect',
      category: 'auth',
    });
    return Response.json({ ok: false, error: 'Disconnect failed.' }, { status: 500 });
  }
}
