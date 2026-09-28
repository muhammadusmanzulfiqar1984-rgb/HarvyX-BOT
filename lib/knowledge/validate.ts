/**
 * Allowed Knowledge upload types (extends chat attachment allowlist with PDF/XLSX).
 */

export const MAX_KNOWLEDGE_BYTES = 2 * 1024 * 1024;

export const KNOWLEDGE_UPLOAD_EXT = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.docx',
  '.pdf',
  '.xlsx',
]);

export const KNOWLEDGE_UPLOAD_MIME = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function validateKnowledgeUpload(input: {
  name: string;
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (!input.name?.trim()) return { ok: false, error: 'Filename is required.' };
  if (input.size <= 0) return { ok: false, error: 'Empty file.' };
  if (input.size > MAX_KNOWLEDGE_BYTES) {
    return {
      ok: false,
      error: `File too large (max ${Math.round(MAX_KNOWLEDGE_BYTES / 1024)} KB).`,
    };
  }
  const ext = '.' + (input.name.split('.').pop() || '').toLowerCase();
  if (!KNOWLEDGE_UPLOAD_EXT.has(ext) && !KNOWLEDGE_UPLOAD_MIME.has(input.type)) {
    return {
      ok: false,
      error: 'Unsupported type. Use TXT, MD, CSV, JSON, DOCX, PDF, or XLSX.',
    };
  }
  return { ok: true };
}
