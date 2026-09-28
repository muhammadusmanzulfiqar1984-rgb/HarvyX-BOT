import {
  ALLOWED_UPLOAD_EXT,
  ALLOWED_UPLOAD_MIME,
  MAX_ATTACHMENT_BYTES,
} from './types';

export function validateUpload(file: { name: string; type: string; size: number }): {
  ok: true;
} | { ok: false; error: string } {
  if (!file.name?.trim()) return { ok: false, error: 'Missing filename.' };
  if (file.size <= 0) return { ok: false, error: 'Empty file.' };
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: `File too large (max ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB).` };
  }
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  const mimeOk = !file.type || ALLOWED_UPLOAD_MIME.has(file.type) || file.type.startsWith('text/');
  const extOk = ALLOWED_UPLOAD_EXT.has(ext);
  if (!mimeOk && !extOk) {
    return {
      ok: false,
      error: 'Unsupported type. Use TXT, Markdown, CSV, JSON, or DOCX.',
    };
  }
  return { ok: true };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
