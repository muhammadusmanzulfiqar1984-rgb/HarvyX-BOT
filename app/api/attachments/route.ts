import { generateAttachment } from '@/lib/attachments/generate';
import { putAttachment } from '@/lib/attachments/store';
import {
  getAttachmentsDb,
  persistAttachmentBestEffort,
} from '@/lib/attachments/persist';
import {
  ALLOWED_UPLOAD_EXT,
  ALLOWED_UPLOAD_MIME,
  MAX_ATTACHMENT_BYTES,
  type AttachmentFormat,
} from '@/lib/attachments/types';
import { validateUpload } from '@/lib/attachments/validate';

export const runtime = 'nodejs';

const FORMATS = new Set<AttachmentFormat>(['txt', 'markdown', 'docx', 'pdf', 'csv', 'xlsx']);

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** POST JSON → generate downloadable attachment from assistant markdown. */
export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    return handleUpload(request);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const { title, markdown, format, sourceAgent, conversationId } = (body ?? {}) as {
    title?: string;
    markdown?: string;
    format?: string;
    sourceAgent?: string;
    conversationId?: string;
  };

  if (!format || !FORMATS.has(format as AttachmentFormat)) {
    return jsonError('Unsupported format. Use txt, markdown, docx, pdf, csv, or xlsx.', 400);
  }
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return jsonError('markdown is required.', 400);
  }
  if (markdown.length > 200_000) {
    return jsonError('Content too large.', 400);
  }

  try {
    const meta = await generateAttachment({
      title: typeof title === 'string' && title.trim() ? title.trim() : 'HARVYX export',
      markdown,
      format: format as AttachmentFormat,
      sourceAgent: typeof sourceAgent === 'string' ? sourceAgent.slice(0, 120) : undefined,
      conversationId: typeof conversationId === 'string' ? conversationId.slice(0, 80) : undefined,
    });
    const db = await getAttachmentsDb();
    await persistAttachmentBestEffort(db, meta);
    return Response.json({
      ...meta,
      url: `/api/attachments/${meta.id}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed.';
    return jsonError(msg, 400);
  }
}

async function handleUpload(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Invalid multipart body.', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return jsonError('file is required.', 400);
  }

  const check = validateUpload({ name: file.name, type: file.type, size: file.size });
  if (!check.ok) return jsonError(check.error, 400);

  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_UPLOAD_EXT.has(ext) && !ALLOWED_UPLOAD_MIME.has(file.type) && !file.type.startsWith('text/')) {
    return jsonError('Unsupported type. Use TXT, Markdown, CSV, JSON, or DOCX.', 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    return jsonError(`File too large (max ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB).`, 400);
  }

  const conversationId = String(form.get('conversationId') || '').slice(0, 80) || undefined;
  const meta = putAttachment({
    filename: file.name.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 120),
    mime: file.type || 'application/octet-stream',
    format: 'upload',
    conversationId,
    bytes,
  });

  const db = await getAttachmentsDb();
  await persistAttachmentBestEffort(db, meta);

  return Response.json({
    ...meta,
    url: `/api/attachments/${meta.id}`,
  });
}
