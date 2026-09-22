import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getConnectorStatus } from '@/lib/connectors/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const status = await getConnectorStatus(env.DB, 'gmail');
    return Response.json(status);
  } catch {
    return Response.json({ provider: 'gmail', connected: false });
  }
}
