import {
  ensureMarketplaceRegistry,
  listCapabilities,
  listProviders,
  resolveConnectionLabel,
} from '@/lib/marketplace/registry';
import { publicProvider } from '@/lib/marketplace/http';
import { getDb } from '@/lib/db/cloudflare-db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  ensureMarketplaceRegistry();
  const url = new URL(request.url);
  const category = url.searchParams.get('category') || undefined;
  const q = url.searchParams.get('q') || undefined;
  const db = (await getDb()) ?? undefined;
  const providers = await Promise.all(
    listProviders({ category, q }).map(async (p) => ({
      ...publicProvider(p),
      capabilityCount: listCapabilities({ providerId: p.id }).length,
      connectionLabel: await resolveConnectionLabel(db, p),
    })),
  );
  return Response.json({ providers });
}
