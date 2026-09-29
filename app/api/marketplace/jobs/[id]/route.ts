import { marketplaceAuth } from '@/lib/marketplace/http';
import { getJob } from '@/lib/marketplace/persist';
import { jsonError } from '@/lib/api/shell';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await marketplaceAuth(request);
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const job = await getJob(auth.db, id);
  if (!job) return jsonError('Job not found.', 404);
  return Response.json({ job });
}
