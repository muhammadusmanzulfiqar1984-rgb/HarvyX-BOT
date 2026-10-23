'use client';

import { useEffect, useRef, useState } from 'react';
import { MANAGER_OPTION, SPECIALIST_OPTIONS } from '@/lib/models/ui-catalog';

/**
 * Shows which brain answers. Only the Manager is selectable — specialists are
 * listed for transparency because MIAN routes to them automatically.
 */
export function ModelSelector({
  selectedId,
  onSelect,
  agentHint,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  agentHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="hx-model-selector" ref={ref}>
      <button
        type="button"
        className="hx-model-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {MANAGER_OPTION.label}
        {agentHint ? <span className="hx-model-trigger-hint">{agentHint}</span> : null}
        <span className="hx-model-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="hx-model-menu" role="listbox">
          <div className="hx-model-group-label">Routing</div>
          <button
            type="button"
            role="option"
            aria-selected={selectedId === MANAGER_OPTION.id}
            className={`hx-model-option ${selectedId === MANAGER_OPTION.id ? 'is-selected' : ''}`}
            onClick={() => {
              onSelect(MANAGER_OPTION.id);
              setOpen(false);
            }}
          >
            {MANAGER_OPTION.label}
            <span className="hx-model-option-meta">{MANAGER_OPTION.meta}</span>
          </button>
          <div className="hx-model-group-label">Specialists</div>
          {SPECIALIST_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={false}
              aria-disabled
              disabled
              className="hx-model-option is-disabled"
            >
              {o.label}
              <span className="hx-model-option-meta">{o.meta}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
