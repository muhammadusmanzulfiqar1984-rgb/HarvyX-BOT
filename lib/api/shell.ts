import { getDb } from '@/lib/db/cloudflare-db';

export const runtime = 'nodejs';

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const DB_UNAVAILABLE = 'Database unavailable. D1 binding (env.DB) is required.';

export async function requireDb(): Promise<
  { db: D1Database; error?: undefined } | { db?: undefined; error: Response }
> {
  const db = await getDb();
  if (!db) {
    return { error: jsonError(DB_UNAVAILABLE, 503) };
  }
  return { db };
}
