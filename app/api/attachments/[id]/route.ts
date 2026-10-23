import { getAttachmentsDb, resolveAttachment } from '@/lib/attachments/persist';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

/** GET /api/attachments/[id] — download by opaque id only (memory → D1). */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: 'Invalid attachment id.' }, { status: 400 });
  }

  const db = await getAttachmentsDb();
  const row = await resolveAttachment(id, db);
  if (!row) {
    return Response.json({ error: 'Attachment not found or expired.' }, { status: 404 });
  }

  const copy = new Uint8Array(row.bytes.byteLength);
  copy.set(row.bytes);

  return new Response(copy, {
    status: 200,
    headers: {
      'Content-Type': row.mime,
      'Content-Length': String(row.size),
      'Content-Disposition': `attachment; filename="${sanitizeFilename(row.filename)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/["\\\r\n]/g, '_').slice(0, 120) || 'download';
}
