import { MARKETPLACE_CATEGORIES } from '@/lib/marketplace/categories';
import {
  ensureMarketplaceRegistry,
  listCapabilities,
  listProviders,
  resolveConnectionLabel,
} from '@/lib/marketplace/registry';
import { publicProvider } from '@/lib/marketplace/http';
import { seedMarketplaceCatalogToD1 } from '@/lib/marketplace/persist';
import { getDb } from '@/lib/db/cloudflare-db';

export const runtime = 'nodejs';

/** GET /api/marketplace — overview catalog (no secrets). */
export async function GET(request: Request) {
  ensureMarketplaceRegistry();
  const url = new URL(request.url);
  const category = url.searchParams.get('category') || undefined;
  const q = url.searchParams.get('q') || undefined;
  const db = (await getDb()) ?? undefined;
  await seedMarketplaceCatalogToD1(db);

  const providers = listProviders({ category, q });
  const enriched = await Promise.all(
    providers.map(async (p) => {
      const caps = listCapabilities({ providerId: p.id });
      return {
        ...publicProvider(p),
        capabilityCount: caps.length,
        connectionLabel: await resolveConnectionLabel(db, p),
      };
    }),
  );

  return Response.json({
    categories: MARKETPLACE_CATEGORIES,
    providers: enriched,
    capabilityCount: listCapabilities().length,
  });
}
