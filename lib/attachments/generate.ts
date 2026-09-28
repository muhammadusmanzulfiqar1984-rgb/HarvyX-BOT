import { runExport, type ExportFormatId } from '../export';
import type { AttachmentFormat, AttachmentMeta } from './types';
import { putAttachment } from './store';
import { MAX_ATTACHMENT_BYTES } from './types';

const FORMAT_TO_EXPORT: Record<AttachmentFormat, ExportFormatId> = {
  txt: 'txt',
  markdown: 'markdown',
  docx: 'docx',
  pdf: 'pdf',
  csv: 'csv',
  xlsx: 'xlsx',
};

function stripSecrets(text: string): string {
  return text
    .replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*['\"]?[^\s'\"]+/gi, '$1=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [redacted]');
}

export async function generateAttachment(opts: {
  title: string;
  markdown: string;
  format: AttachmentFormat;
  sourceAgent?: string;
  conversationId?: string;
}): Promise<AttachmentMeta> {
  const markdown = stripSecrets(opts.markdown || '');
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '').replace(/```/g, ''))
    .replace(/[#>*_`]/g, '')
    .trim();

  if (!plainText) throw new Error('Nothing to export.');

  const exportId = FORMAT_TO_EXPORT[opts.format];
  const result = await runExport(exportId, {
    title: opts.title.slice(0, 120) || 'HARVYX export',
    markdown,
    plainText,
  });

  if (result.kind !== 'file') throw new Error('Export did not produce a file.');

  const buf = new Uint8Array(await result.blob.arrayBuffer());
  if (buf.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error('Generated file exceeds size limit.');
  }

  return putAttachment({
    filename: result.filename,
    mime: result.mime,
    format: opts.format,
    sourceAgent: opts.sourceAgent,
    conversationId: opts.conversationId,
    bytes: buf,
  });
}
