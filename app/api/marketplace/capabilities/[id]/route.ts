import { ensureMarketplaceRegistry, getCapability, getProvider, resolveConnectionLabel } from '@/lib/marketplace/registry';
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
  const capability = getCapability(id);
  if (!capability) return jsonError('Capability not found.', 404);
  const provider = getProvider(capability.providerId);
  const db = (await getDb()) ?? undefined;
  return Response.json({
    capability: publicCapability(capability),
    provider: provider
      ? {
          ...publicProvider(provider.definition),
          connectionLabel: await resolveConnectionLabel(db, provider.definition),
        }
      : null,
  });
}
