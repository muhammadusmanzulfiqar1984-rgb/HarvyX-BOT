'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobalSearch, type SearchHit } from './GlobalSearch';

export type CommandActionId =
  | 'new-chat'
  | 'search'
  | 'open-team'
  | 'new-project'
  | 'new-automation'
  | 'upload-knowledge'
  | 'settings'
  | 'connections'
  | 'plugins'
  | 'sign-out';

type CommandItem = {
  id: CommandActionId;
  label: string;
  hint?: string;
};

const COMMANDS: CommandItem[] = [
  { id: 'new-chat', label: 'New Chat', hint: 'N' },
  { id: 'search', label: 'Search', hint: '/' },
  { id: 'open-team', label: 'Open Team' },
  { id: 'new-project', label: 'New Project' },
  { id: 'new-automation', label: 'New Automation' },
  { id: 'upload-knowledge', label: 'Upload Knowledge' },
  { id: 'settings', label: 'Settings' },
  { id: 'connections', label: 'Connections' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'sign-out', label: 'Sign Out' },
];

export function CommandPalette({
  open,
  onClose,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (id: CommandActionId, hit?: SearchHit) => void;
}) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'commands' | 'search'>('commands');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setMode('commands');
      setIndex(0);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || mode === 'search') return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
  }, [query, mode]);

  useEffect(() => {
    setIndex(0);
  }, [filtered.length, mode]);

  const run = useCallback(
    (id: CommandActionId) => {
      if (id === 'search') {
        setMode('search');
        setQuery('');
        return;
      }
      onAction(id);
      onClose();
    },
    [onAction, onClose],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (mode === 'search') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[index]) {
        e.preventDefault();
        run(filtered[index].id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode, filtered, index, run, onClose]);

  if (!open) return null;

  return (
    <div className="cmd-palette-root" role="dialog" aria-modal="true" aria-label="Command palette">
      <button type="button" className="cmd-palette-backdrop" aria-label="Close" onClick={onClose} />
      <div className="cmd-palette">
        <input
          ref={inputRef}
          className="cmd-palette-input"
          placeholder={mode === 'search' ? 'Search conversations, projects, knowledge…' : 'Type a command…'}
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            if (mode === 'commands' && v.startsWith('/')) {
              setMode('search');
              setQuery(v.slice(1));
            }
          }}
        />
        {mode === 'search' ? (
          <GlobalSearch
            query={query}
            onSelect={(hit) => {
              onAction('search', hit);
              onClose();
            }}
          />
        ) : (
          <ul className="cmd-palette-list">
            {filtered.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`cmd-palette-item${i === index ? ' is-active' : ''}`}
                  onClick={() => run(c.id)}
                  onMouseEnter={() => setIndex(i)}
                >
                  <span>{c.label}</span>
                  {c.hint ? <kbd>{c.hint}</kbd> : null}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? <li className="shell-muted" style={{ padding: 12 }}>No commands</li> : null}
          </ul>
        )}
        <div className="cmd-palette-footer">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
          <button type="button" className="btn-ghost" onClick={() => setMode(mode === 'search' ? 'commands' : 'search')}>
            {mode === 'search' ? 'Commands' : 'Search'}
          </button>
        </div>
      </div>
    </div>
  );
}
