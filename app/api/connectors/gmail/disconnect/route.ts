import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getConnectorAccountRow, deleteConnectorAccount } from '@/lib/connectors/db';
import { GOOGLE_REVOKE_URL } from '@/lib/connectors/gmail-oauth';
import { logSafe, logSafeError } from '@/lib/observability';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const row = await getConnectorAccountRow(env.DB, 'gmail');

    if (!row) {
      return Response.json({ ok: true, message: 'Not connected.' });
    }

    // Best-effort token revocation — don't fail disconnect if revoke fails
    const tokenToRevoke = row.refresh_token || row.access_token;
    if (tokenToRevoke) {
      try {
        await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(tokenToRevoke)}`, {
          method: 'POST',
        });
      } catch (err) {
        logSafeError('gmail_revoke_failed', err, {
          operation: 'POST /api/connectors/gmail/disconnect',
          category: 'auth',
        });
      }
    }

    await deleteConnectorAccount(env.DB, 'gmail');
    logSafe('gmail_disconnected', { operation: 'POST /api/connectors/gmail/disconnect' });
    return Response.json({ ok: true });
  } catch (err) {
    logSafeError('gmail_disconnect_failed', err, {
      operation: 'POST /api/connectors/gmail/disconnect',
      category: 'auth',
    });
    return Response.json({ ok: false, error: 'Disconnect failed.' }, { status: 500 });
  }
}
