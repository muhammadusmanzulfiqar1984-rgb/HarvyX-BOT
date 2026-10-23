import { jsonError } from '@/lib/api/shell';
import { marketplaceAuth, publicConnection } from '@/lib/marketplace/http';
import { ensureMarketplaceRegistry, getProvider } from '@/lib/marketplace/registry';
import { listConnections } from '@/lib/marketplace/persist';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await marketplaceAuth(request);
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const providerId = url.searchParams.get('providerId') || undefined;
  const rows = await listConnections(auth.db, providerId);
  return Response.json({ connections: rows.map(publicConnection) });
}

export async function POST(request: Request) {
  const auth = await marketplaceAuth(request);
  if (auth.error) return auth.error;
  ensureMarketplaceRegistry();

  let body: { providerId?: string; accountId?: string; metadata?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const providerId = body.providerId?.trim();
  if (!providerId) return jsonError('providerId is required.', 400);
  const provider = getProvider(providerId);
  if (!provider) return jsonError('Unknown provider.', 404);
  if (!provider.definition.connectSupported || !provider.connect) {
    return jsonError('Provider does not support connection.', 400);
  }

  try {
    const conn = await provider.connect(auth.db, {
      accountId: body.accountId,
      metadata: body.metadata,
    });
    return Response.json({ connection: publicConnection(conn) }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Connect failed.';
    return jsonError(msg, 400);
  }
}
