import { getDb } from '@/lib/db/cloudflare-db';
import { receiveWebhookEvent } from '@/lib/marketplace/webhooks';
import { jsonError } from '@/lib/api/shell';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const urlPath = `/api/marketplace/webhooks/${(path || []).join('/')}`;
  const rawBody = await request.text();
  const db = (await getDb()) ?? undefined;
  const result = await receiveWebhookEvent(db, urlPath, rawBody, request.headers);
  if (!result.ok) return jsonError(result.error, 400);
  return Response.json(result);
}
