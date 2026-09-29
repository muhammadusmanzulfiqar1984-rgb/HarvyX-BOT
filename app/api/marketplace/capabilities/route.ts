import { ensureMarketplaceRegistry, listCapabilities } from '@/lib/marketplace/registry';
import { publicCapability } from '@/lib/marketplace/http';
import { searchCapabilities } from '@/lib/marketplace/discovery';
import { getDb } from '@/lib/db/cloudflare-db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  ensureMarketplaceRegistry();
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || url.searchParams.get('search') || '';
  const providerId = url.searchParams.get('providerId') || undefined;
  const category = url.searchParams.get('category') || undefined;
  const db = (await getDb()) ?? undefined;

  if (q.trim()) {
    const hits = await searchCapabilities(q, db);
    return Response.json({ query: q, capabilities: hits });
  }

  return Response.json({
    capabilities: listCapabilities({ providerId, category }).map(publicCapability),
  });
}
