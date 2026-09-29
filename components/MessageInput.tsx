'use client';

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { ModelSelector } from './ModelSelector';
import { GreatLionMark, type LionMarkState } from './GreatLionMark';
import { MANAGER_OPTION } from '@/lib/models/ui-catalog';
import { validateUpload, formatBytes } from '@/lib/attachments/validate';
import {
  buildAgentAttachmentContext,
  extractUploadText,
} from '@/lib/attachments/read-upload';
import {
  packMessageWithAttachments,
  type EmbeddedAttachmentRef,
} from '@/lib/attachments/message-pack';

export type PendingLocalFile = {
  key: string;
  file: File;
  name: string;
  size: number;
  mime: string;
};

type Props = {
  onSend: (text: string) => void;
  disabled: boolean;
  voiceListening: boolean;
  onToggleVoice: () => void;
  /** Optional — Chat/TeamChat may clear listening when voice stops. */
  onVoiceStop?: () => void;
  agentHint?: string;
  orbState: LionMarkState;
  /** Fired when the user is drafting (sign of operator while writing). */
  onDraftChange?: (drafting: boolean) => void;
  conversationId?: string;
};

export function MessageInput({
  onSend,
  disabled,
  voiceListening,
  onToggleVoice,
  onVoiceStop,
  agentHint,
  orbState,
  onDraftChange,
  conversationId,
}: Props) {
  const [value, setValue] = useState('');
  const [modelId, setModelId] = useState(MANAGER_OPTION.id);
  const [pending, setPending] = useState<PendingLocalFile[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wasDrafting = useRef(false);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  useEffect(() => {
    const drafting = (value.trim().length > 0 || pending.length > 0) && !disabled;
    if (drafting !== wasDrafting.current) {
      wasDrafting.current = drafting;
      onDraftChange?.(drafting);
    }
  }, [value, pending.length, disabled, onDraftChange]);

  function onPickFiles(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    e.target.value = '';
    if (!list?.length) return;
    setAttachError(null);
    const next: PendingLocalFile[] = [];
    for (const file of Array.from(list)) {
      const check = validateUpload({ name: file.name, type: file.type, size: file.size });
      if (!check.ok) {
        setAttachError(check.error);
        continue;
      }
      next.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
      });
    }
    if (next.length) setPending((p) => [...p, ...next].slice(0, 5));
  }

  async function submit() {
    const text = value.trim();
    if ((!text && pending.length === 0) || disabled || sending) return;
    setSending(true);
    setAttachError(null);
    try {
      const embedded: EmbeddedAttachmentRef[] = [];
      const extracted: { name: string; size: number; text: string; note?: string }[] = [];

      for (const item of pending) {
        const { text: fileText, note } = await extractUploadText(item.file);
        const form = new FormData();
        form.append('file', item.file);
        if (conversationId) form.append('conversationId', conversationId);

        const res = await fetch('/api/attachments', { method: 'POST', body: form });
        const data = (await res.json()) as EmbeddedAttachmentRef & { error?: string };
        if (!res.ok || !data.id) {
          throw new Error(data.error || `Failed to upload ${item.name}`);
        }
        embedded.push({
          id: data.id,
          filename: data.filename,
          mime: data.mime,
          size: data.size,
          format: data.format || 'upload',
          url: data.url || `/api/attachments/${data.id}`,
        });
        extracted.push({
          name: item.name,
          size: item.size,
          text: fileText,
          note: note || (fileText ? undefined : 'File uploaded but no text could be extracted.'),
        });
      }

      const agentContext = buildAgentAttachmentContext(extracted);
      const payload = packMessageWithAttachments(
        text || (embedded.length ? 'Please review the attached file(s).' : ''),
        embedded,
        agentContext,
      );
      onSend(payload);
      setValue('');
      setPending([]);
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  const canSend = (Boolean(value.trim()) || pending.length > 0) && !disabled && !sending;
  const drafting = canSend;
  const lionState: LionMarkState = drafting
    ? 'speaking'
    : voiceListening
      ? 'listening'
      : orbState;

  return (
    <div className="hx-composer">
      {pending.length > 0 ? (
        <ul className="hx-composer-pending" aria-label="Files to attach">
          {pending.map((p) => (
            <li key={p.key} className="hx-composer-pending-item">
              <span className="hx-composer-pending-name">{p.name}</span>
              <span className="hx-composer-pending-size">{formatBytes(p.size)}</span>
              <button
                type="button"
                className="hx-composer-pending-remove"
                aria-label={`Remove ${p.name}`}
                onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {attachError ? <p className="hx-composer-attach-error">{attachError}</p> : null}

      <div className="hx-composer-shell">
        <input
          ref={fileRef}
          type="file"
          className="hx-composer-file-input"
          accept=".txt,.md,.markdown,.csv,.json,.docx,text/plain,text/markdown,text/csv,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          hidden
          onChange={onPickFiles}
        />
        <button
          type="button"
          className="hx-composer-icon-btn hx-attach"
          aria-label="Attach file"
          title="Attach TXT, Markdown, CSV, JSON, or DOCX"
          disabled={disabled || sending}
          onClick={() => fileRef.current?.click()}
        >
          <PlusIcon />
        </button>

        <div className="hx-composer-main">
          <textarea
            ref={taRef}
            rows={1}
            value={value}
            placeholder="Ask anything"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || sending}
            aria-label="Message HARVYX"
          />
        </div>

        <div className="hx-composer-end">
          <button
            type="button"
            className={`hx-composer-icon-btn hx-mic${voiceListening ? ' is-active' : ''}`}
            onClick={() => {
              if (voiceListening) {
                onVoiceStop?.();
                if (!onVoiceStop) onToggleVoice();
              } else {
                onToggleVoice();
              }
            }}
            aria-label={voiceListening ? 'Stop listening' : 'Start voice (listening UI only)'}
            aria-pressed={voiceListening}
            title="Voice — listening mode (STT coming soon)"
          >
            <MicIcon />
          </button>

          <GreatLionMark
            state={lionState}
            size={36}
            metal={drafting ? 'gold' : 'silver'}
            interactive
            className="hx-composer-orb hx-composer-lion"
            onClick={() => {
              if (!disabled) onToggleVoice();
            }}
            label={
              drafting
                ? 'You — writing'
                : voiceListening
                  ? 'HARVYX listening — click to stop'
                  : disabled
                    ? 'HARVYX thinking'
                    : 'HARVYX — tap for voice listening'
            }
          />

          {canSend ? (
            <button
              type="button"
              className="hx-send-btn"
              onClick={() => void submit()}
              aria-label="Send message"
              disabled={sending}
            >
              <SendIcon />
            </button>
          ) : null}
        </div>
      </div>
      <p className="hx-composer-footnote">HARVYX can make mistakes. Verify important decisions.</p>
      <div className="hx-composer-model-sr" aria-hidden={!agentHint}>
        <ModelSelector selectedId={modelId} onSelect={setModelId} agentHint={agentHint} />
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 18v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 19V5M12 5l-5 5M12 5l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
