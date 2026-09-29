import { marketplaceAuth } from '@/lib/marketplace/http';
import { deleteConnection } from '@/lib/marketplace/persist';
import { jsonError } from '@/lib/api/shell';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await marketplaceAuth(request);
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const ok = await deleteConnection(auth.db, id);
  if (!ok) return jsonError('Connection not found.', 404);
  return Response.json({ ok: true });
}
