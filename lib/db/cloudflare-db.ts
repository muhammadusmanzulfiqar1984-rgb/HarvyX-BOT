import { getCloudflareContext } from '@opennextjs/cloudflare';

/** D1 binding for the current request, or null outside a Cloudflare context (scripts, plain `next dev`). */
export async function getDb(): Promise<D1Database | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.DB ?? null;
  } catch {
    return null;
  }
}
