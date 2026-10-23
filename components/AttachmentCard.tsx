'use client';

import type { EmbeddedAttachmentRef } from '@/lib/attachments/message-pack';
import { formatBytes } from '@/lib/attachments/validate';

const FORMAT_LABEL: Record<string, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  xlsx: 'XLSX',
  csv: 'CSV',
  markdown: 'MD',
  txt: 'TXT',
  upload: 'FILE',
};

export function AttachmentCard({
  attachment,
  sourceAgent,
}: {
  attachment: EmbeddedAttachmentRef;
  sourceAgent?: string;
}) {
  return (
    <div className="hx-attach-card">
      <span className="hx-attach-card-icon" aria-hidden>
        {FORMAT_LABEL[attachment.format] ?? 'FILE'}
      </span>
      <div className="hx-attach-card-body">
        <div className="hx-attach-card-title">
          <span className="hx-attach-card-filename" title={attachment.filename}>
            {attachment.filename}
          </span>
        </div>
        <div className="hx-attach-card-meta">
          {formatBytes(attachment.size)}
          {sourceAgent ? <span className="hx-attach-card-agent"> · {sourceAgent}</span> : null}
        </div>
      </div>
      <div className="hx-attach-card-actions">
        <a className="hx-attach-btn is-primary" href={attachment.url} download={attachment.filename}>
          Download
        </a>
      </div>
    </div>
  );
}
