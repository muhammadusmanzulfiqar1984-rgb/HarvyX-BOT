'use client';

import { parseJson } from '@/lib/client-api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Scope = {
  id?: string;
  scope_kind: 'shared' | 'bot' | 'project';
  bot_slug?: string | null;
  project_id?: string | null;
};

type KnowledgeDoc = {
  id: string;
  title: string;
  filename: string;
  mime: string;
  size: number;
  excerpt: string;
  status: string;
  error_message?: string;
  archived?: number;
  project_id?: string | null;
  attachment_id?: string | null;
  indexed_at?: string | null;
  created_at: string;
  updated_at: string;
  scopes?: Scope[];
};

type SearchHit = {
  documentId: string;
  title: string;
  filename: string;
  excerpt: string;
  score: number;
  citation: string;
  page: number | null;
  section: string | null;
  scopes: Scope[];
};

type Project = { id: string; name: string };

const BOT_SCOPES = [
  { kind: 'shared' as const, label: 'SHARED' },
  { kind: 'bot' as const, bot: 'mian', label: 'MANAGER' },
  { kind: 'bot' as const, bot: 'ops', label: 'OPS' },
  { kind: 'bot' as const, bot: 'analyst', label: 'ANALYST' },
  { kind: 'bot' as const, bot: 'scrape', label: 'SCRAPE' },
  { kind: 'bot' as const, bot: 'social', label: 'SOCIAL' },
];

function statusLabel(s: string) {
  return (s || 'unindexed').toUpperCase();
}

function scopeChips(scopes: Scope[] | undefined): string[] {
  if (!scopes?.length) return ['UNASSIGNED'];
  return scopes.map((s) => {
    if (s.scope_kind === 'shared') return 'SHARED';
    if (s.scope_kind === 'bot') {
      const map: Record<string, string> = {
        mian: 'MANAGER',
        ops: 'OPS',
        analyst: 'ANALYST',
        scrape: 'SCRAPE',
        social: 'SOCIAL',
      };
      return map[s.bot_slug || ''] || `BOT:${s.bot_slug}`;
    }
    return 'PROJECT';
  });
}

export function KnowledgeView() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterScope, setFilterScope] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<KnowledgeDoc | null>(null);
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [uploadScope, setUploadScope] = useState('shared');
  const [uploadProjectId, setUploadProjectId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [kRes, pRes] = await Promise.all([
        fetch('/api/knowledge'),
        fetch('/api/projects'),
      ]);
      const kData = await parseJson(kRes);
      const pData = await parseJson(pRes).catch(() => ({ projects: [] }));
      if (!kRes.ok) throw new Error(kData?.error || 'Failed to load knowledge.');
      setDocs(Array.isArray(kData.knowledge) ? kData.knowledge : []);
      setProjects(Array.isArray(pData.projects) ? pData.projects : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge.');
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while any doc is processing
  useEffect(() => {
    const pending = docs.some((d) =>
      ['uploading', 'processing', 'indexing'].includes(d.status),
    );
    if (!pending) return;
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [docs, load]);

  const filtered = useMemo(() => {
    let list = docs;
    if (filterStatus !== 'all') {
      list = list.filter((d) => d.status === filterStatus);
    }
    if (filterScope !== 'all') {
      list = list.filter((d) => scopeChips(d.scopes).includes(filterScope.toUpperCase()));
    }
    const q = query.trim().toLowerCase();
    if (q && !searchHits) {
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.filename.toLowerCase().includes(q) ||
          (d.excerpt || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [docs, filterScope, filterStatus, query, searchHits]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', file.name.replace(/\.[^.]+$/, '') || file.name);
      if (uploadScope === 'shared') {
        form.append('scopes', JSON.stringify([{ scope_kind: 'shared' }]));
      } else if (uploadScope.startsWith('bot:')) {
        form.append(
          'scopes',
          JSON.stringify([{ scope_kind: 'bot', bot_slug: uploadScope.slice(4) }]),
        );
      } else if (uploadScope === 'project' && uploadProjectId) {
        form.append('projectId', uploadProjectId);
        form.append(
          'scopes',
          JSON.stringify([{ scope_kind: 'project', project_id: uploadProjectId }]),
        );
      } else {
        form.append('scopes', JSON.stringify([{ scope_kind: 'shared' }]));
      }
      const res = await fetch('/api/knowledge', { method: 'POST', body: form });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Upload failed.');
      await load();
      if (data.knowledge) setSelected(data.knowledge);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function runSemanticSearch() {
    const q = query.trim();
    if (!q) {
      setSearchHits(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/knowledge?mode=search&q=${encodeURIComponent(q)}&botSlug=mian`,
      );
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Search failed.');
      setSearchHits(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
      setSearchHits([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document and its index?')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
      const data = await parseJson(res).catch(() => ({ error: 'Delete failed.' }));
      if (!res.ok) throw new Error(data?.error || 'Delete failed.');
      if (selected?.id === id) setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchive(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Archive failed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReindex(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reindex: true }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Reindex failed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reindex failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function saveScopes(doc: KnowledgeDoc, next: Scope[]) {
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/knowledge/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopes: next.map((s) =>
            s.scope_kind === 'shared'
              ? { scope_kind: 'shared' }
              : s.scope_kind === 'bot'
                ? { scope_kind: 'bot', bot_slug: s.bot_slug }
                : { scope_kind: 'project', project_id: s.project_id },
          ),
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Permission update failed.');
      setSelected(data.knowledge);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permission update failed.');
    } finally {
      setBusyId(null);
    }
  }

  function toggleBotScope(doc: KnowledgeDoc, bot: string) {
    const current = [...(doc.scopes || [])];
    const idx = current.findIndex((s) => s.scope_kind === 'bot' && s.bot_slug === bot);
    if (idx >= 0) current.splice(idx, 1);
    else current.push({ scope_kind: 'bot', bot_slug: bot });
    void saveScopes(doc, current);
  }

  function toggleShared(doc: KnowledgeDoc) {
    const current = [...(doc.scopes || [])];
    const idx = current.findIndex((s) => s.scope_kind === 'shared');
    if (idx >= 0) current.splice(idx, 1);
    else current.push({ scope_kind: 'shared' });
    void saveScopes(doc, current);
  }

  return (
    <div className="view-shell shell-view">
      <div className="view-header">
        <h1>Knowledge</h1>
        <p>
          Persistent knowledge for HARVYX-BOT — Shared, per-bot, and project scopes with RAG
          retrieval.
        </p>
      </div>

      <div className="shell-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input
          className="shell-input"
          placeholder="Search Knowledge…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchHits(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void runSemanticSearch();
          }}
        />
        <button type="button" className="btn-ghost" disabled={searching} onClick={() => void runSemanticSearch()}>
          {searching ? 'Searching…' : 'Semantic search'}
        </button>
        <select
          className="shell-input"
          value={filterScope}
          onChange={(e) => setFilterScope(e.target.value)}
          aria-label="Filter scope"
        >
          <option value="all">All scopes</option>
          {BOT_SCOPES.map((s) => (
            <option key={s.label} value={s.label}>
              {s.label}
            </option>
          ))}
          <option value="PROJECT">PROJECT</option>
        </select>
        <select
          className="shell-input"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter status"
        >
          <option value="all">All statuses</option>
          {['ready', 'processing', 'indexing', 'uploading', 'failed', 'unindexed', 'archived'].map(
            (s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ),
          )}
        </select>
        <select
          className="shell-input"
          value={uploadScope}
          onChange={(e) => setUploadScope(e.target.value)}
          aria-label="Upload scope"
        >
          <option value="shared">Upload → SHARED</option>
          <option value="bot:mian">Upload → MANAGER</option>
          <option value="bot:ops">Upload → OPS</option>
          <option value="bot:analyst">Upload → ANALYST</option>
          <option value="bot:scrape">Upload → SCRAPE</option>
          <option value="bot:social">Upload → SOCIAL</option>
          <option value="project">Upload → PROJECT</option>
        </select>
        {uploadScope === 'project' ? (
          <select
            className="shell-input"
            value={uploadProjectId}
            onChange={(e) => setUploadProjectId(e.target.value)}
          >
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          className="btn-primary"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input
          ref={fileRef}
          type="file"
          className="shell-file-input"
          accept=".txt,.md,.csv,.json,.docx,.pdf,.xlsx,text/plain,text/markdown,text/csv,application/json,application/pdf"
          onChange={handleUpload}
        />
      </div>

      {error ? <p className="shell-error" role="alert">{error}</p> : null}
      {loading ? <p className="shell-muted">Loading…</p> : null}

      {searchHits ? (
        <div className="shell-panel" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Semantic results</h2>
          {searchHits.length === 0 ? (
            <p className="shell-muted">No READY matches for this query/scope.</p>
          ) : (
            <ul className="shell-list">
              {searchHits.map((h) => (
                <li key={`${h.documentId}-${h.citation}-${h.score}`} className="shell-list-item card">
                  <div className="shell-list-main">
                    <h3>{h.title}</h3>
                    <div className="shell-meta">
                      <span className="shell-muted">{h.citation}</span>
                      <span className="shell-muted">score {h.score}</span>
                      {scopeChips(h.scopes).map((c) => (
                        <span key={c} className="shell-muted">
                          {c}
                        </span>
                      ))}
                    </div>
                    <pre className="shell-excerpt">{h.excerpt}</pre>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div>
          {!loading && filtered.length === 0 ? (
            <p className="shell-muted">{docs.length === 0 ? 'No documents yet.' : 'No matches.'}</p>
          ) : (
            <ul className="shell-list">
              {filtered.map((d) => (
                <li key={d.id} className="shell-list-item card">
                  <div className="shell-list-main" style={{ cursor: 'pointer' }} onClick={() => setSelected(d)}>
                    <h3>{d.title}</h3>
                    <div className="shell-meta">
                      <span className={`shell-status status-${d.status}`}>{statusLabel(d.status)}</span>
                      {scopeChips(d.scopes).map((c) => (
                        <span key={c} className="shell-muted">
                          {c}
                        </span>
                      ))}
                      <span className="shell-muted">{d.filename}</span>
                      <span className="shell-muted">{Math.round(d.size / 1024)} KB</span>
                    </div>
                    {d.status === 'failed' && d.error_message ? (
                      <p className="shell-error">{d.error_message}</p>
                    ) : d.excerpt ? (
                      <pre className="shell-excerpt">{d.excerpt.slice(0, 280)}</pre>
                    ) : (
                      <p className="shell-muted">No excerpt yet.</p>
                    )}
                  </div>
                  <div className="shell-actions">
                    <button type="button" className="btn-ghost" disabled={busyId === d.id} onClick={() => void handleReindex(d.id)}>
                      Reindex
                    </button>
                    <button type="button" className="btn-ghost" disabled={busyId === d.id} onClick={() => void handleArchive(d.id)}>
                      Archive
                    </button>
                    <button type="button" className="btn-ghost" disabled={busyId === d.id} onClick={() => void handleDelete(d.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected ? (
          <aside className="shell-panel card" style={{ padding: 16 }}>
            <h2 style={{ fontSize: 18 }}>{selected.title}</h2>
            <p className="shell-muted">{selected.filename}</p>
            <p>
              Status: <strong>{statusLabel(selected.status)}</strong>
            </p>
            {selected.indexed_at ? <p className="shell-muted">Indexed: {selected.indexed_at}</p> : null}
            {selected.error_message ? <p className="shell-error">{selected.error_message}</p> : null}
            <p className="shell-muted">MIME: {selected.mime}</p>
            <p className="shell-muted">Attachment: {selected.attachment_id || '—'}</p>
            <h3 style={{ fontSize: 14, marginTop: 12 }}>Scopes</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button type="button" className="btn-ghost" onClick={() => toggleShared(selected)}>
                {scopeChips(selected.scopes).includes('SHARED') ? '✓ SHARED' : 'SHARED'}
              </button>
              {['mian', 'ops', 'analyst', 'scrape', 'social'].map((bot) => {
                const label = bot === 'mian' ? 'MANAGER' : bot.toUpperCase();
                const on = (selected.scopes || []).some((s) => s.scope_kind === 'bot' && s.bot_slug === bot);
                return (
                  <button key={bot} type="button" className="btn-ghost" onClick={() => toggleBotScope(selected, bot)}>
                    {on ? `✓ ${label}` : label}
                  </button>
                );
              })}
            </div>
            {selected.excerpt ? (
              <>
                <h3 style={{ fontSize: 14, marginTop: 12 }}>Preview</h3>
                <pre className="shell-excerpt" style={{ maxHeight: 320, overflow: 'auto' }}>
                  {selected.excerpt}
                </pre>
              </>
            ) : null}
            <button type="button" className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setSelected(null)}>
              Close
            </button>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
