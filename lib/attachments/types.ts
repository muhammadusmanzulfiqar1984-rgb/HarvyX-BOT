export type AttachmentFormat = 'txt' | 'markdown' | 'docx' | 'pdf' | 'csv' | 'xlsx';

export type AttachmentMeta = {
  id: string;
  filename: string;
  mime: string;
  size: number;
  format: AttachmentFormat | 'upload';
  sourceAgent?: string;
  conversationId?: string;
  createdAt: number;
};

export type CreateAttachmentRequest = {
  title: string;
  markdown: string;
  format: AttachmentFormat;
  sourceAgent?: string;
  conversationId?: string;
};

/** Max upload / generated size (2 MB). */
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const ALLOWED_UPLOAD_EXT = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.docx',
]);
