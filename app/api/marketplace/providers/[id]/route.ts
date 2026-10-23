import {
  ensureMarketplaceRegistry,
  getProvider,
  listCapabilities,
  resolveConnectionLabel,
} from '@/lib/marketplace/registry';
import { publicCapability, publicProvider } from '@/lib/marketplace/http';
import { getDb } from '@/lib/db/cloudflare-db';
import { jsonError } from '@/lib/api/shell';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  ensureMarketplaceRegistry();
  const { id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return jsonError('Provider not found.', 404);
  const db = (await getDb()) ?? undefined;
  const health = provider.health ? await provider.health(db) : { ok: true, status: 'unknown' };
  return Response.json({
    provider: {
      ...publicProvider(provider.definition),
      connectionLabel: await resolveConnectionLabel(db, provider.definition),
      health,
    },
    capabilities: listCapabilities({ providerId: id }).map(publicCapability),
  });
}
