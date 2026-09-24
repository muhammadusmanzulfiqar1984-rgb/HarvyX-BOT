import { getCloudflareContext } from '@opennextjs/cloudflare';
import { ensureBotRegistrySeeded, getBotBySlug, getBotRegistry, toCatalog } from '@/lib/bots';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ slug: string }> };

/**
 * GET /api/bots/:slug — single canonical bot (Factory Phase 1).
 * Returns catalog + Factory fields needed for visual / version inspection.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  try {
    const { env } = await getCloudflareContext({ async: true });
    await ensureBotRegistrySeeded(env.DB);
    const bot = await getBotBySlug(env.DB, slug);
    if (!bot) {
      return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    }
    return Response.json({
      ok: true,
      source: 'registry',
      bot: {
        ...toCatalog(bot),
        version: bot.version,
        visual: bot.visual,
        modelPolicy: bot.modelPolicy,
        capabilities: bot.capabilities,
        behavior: bot.behavior,
        permissions: bot.permissions,
      },
    });
  } catch {
    const bot = getBotRegistry().get(slug);
    if (!bot) {
      return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    }
    return Response.json({
      ok: true,
      source: 'canonical',
      bot: {
        ...toCatalog(bot),
        version: bot.version,
        visual: bot.visual,
        modelPolicy: bot.modelPolicy,
        capabilities: bot.capabilities,
        behavior: bot.behavior,
        permissions: bot.permissions,
      },
    });
  }
}
