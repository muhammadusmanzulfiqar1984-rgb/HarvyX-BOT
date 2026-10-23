import { MARKETPLACE_CATEGORIES } from '@/lib/marketplace/categories';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({ categories: MARKETPLACE_CATEGORIES });
}
