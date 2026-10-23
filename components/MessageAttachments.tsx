'use client';

import { useState } from 'react';
import type { AttachmentFormat } from '@/lib/attachments/types';
import type { EmbeddedAttachmentRef } from '@/lib/attachments/message-pack';
import { parseJson } from '@/lib/client-api';
import { AttachmentCard } from './AttachmentCard';

const FORMATS: { id: AttachmentFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'Word' },
  { id: 'xlsx', label: 'Excel' },
  { id: 'csv', label: 'CSV' },
  { id: 'markdown', label: 'Markdown' },
];

/** "Export as…" toolbar under an assistant reply; generated files appear as cards. */
export function MessageAttachments({
  markdown,
  title,
  sourceAgent,
}: {
  markdown: string;
  title: string;
  sourceAgent?: string;
}) {
  const [files, setFiles] = useState<EmbeddedAttachmentRef[]>([]);
  const [busy, setBusy] = useState<AttachmentFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate(format: AttachmentFormat) {
    setBusy(format);
    setError(null);
    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, markdown, format, sourceAgent }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Export failed.');
      setFiles((prev) => [...prev, data as EmbeddedAttachmentRef]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="hx-attachments">
      <div className="hx-attachments-toolbar">
        <span className="hx-attachments-label">Export as</span>
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="hx-attachments-format"
            disabled={busy !== null}
            onClick={() => generate(f.id)}
          >
            {busy === f.id ? '…' : f.label}
          </button>
        ))}
      </div>
      {error ? (
        <p className="hx-attachments-error" role="alert">
          {error}
        </p>
      ) : null}
      {files.length > 0 ? (
        <div className="hx-attachments-list">
          {files.map((f) => (
            <AttachmentCard key={f.id} attachment={f} sourceAgent={sourceAgent} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
