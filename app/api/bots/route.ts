import { getCloudflareContext } from '@opennextjs/cloudflare';
import { ensureBotRegistrySeeded, listMarketplaceBots } from '@/lib/bots';

export const runtime = 'nodejs';

/** Bot Registry catalog — Agents / Marketplace UI. */
export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    await ensureBotRegistrySeeded(env.DB);
    const catalog = await listMarketplaceBots(env.DB);
    return Response.json({
      ok: true,
      source: 'registry',
      ...catalog,
    });
  } catch {
    // Local / no D1 — still return canonical definitions so UI works.
    const catalog = await listMarketplaceBots(undefined);
    return Response.json({
      ok: true,
      source: 'canonical',
      ...catalog,
    });
  }
}
