'use client';

import { parseJson } from '@/lib/client-api';
import { useCallback, useEffect, useState } from 'react';

type ResearchJob = {
  id: string;
  query: string;
  status: string;
  error_message: string;
  synthesis: string;
  sources_found: number;
  sources_fetched: number;
  sources_failed: number;
  knowledge_doc_id: string | null;
  analyst_notes?: string;
  updated_at: string;
};

type ResearchSource = {
  id: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  status: string;
  page_title: string;
  content: string;
  error_message: string;
  retrieved_at: string | null;
};

type Project = { id: string; name: string };

export function ResearchView() {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<{
    job: ResearchJob;
    sources: ResearchSource[];
    citations: string[];
    evidencePack: string;
  } | null>(null);
  const [saveScope, setSaveScope] = useState('shared');
  const [saveProjectId, setSaveProjectId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rRes, pRes] = await Promise.all([fetch('/api/research'), fetch('/api/projects')]);
      const data = await parseJson(rRes);
      if (!rRes.ok) throw new Error(data?.error || 'Failed to load research.');
      setJobs(Array.isArray(data.research) ? data.research : []);
      if (pRes.ok) {
        const pData = await parseJson(pRes);
        setProjects(Array.isArray(pData.projects) ? pData.projects : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load research.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runResearch() {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    setActive(null);
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, maxSources: 5 }),
      });
      const data = await parseJson(res);
      if (!res.ok && !data?.research) throw new Error(data?.error || 'Research failed.');
      setActive({
        job: data.research,
        sources: data.sources || [],
        citations: data.citations || [],
        evidencePack: data.evidencePack || '',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed.');
    } finally {
      setBusy(false);
    }
  }

  async function openJob(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/research/${id}`);
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to load job.');
      setActive({
        job: data.research,
        sources: (data.sources || []).map((s: ResearchSource) => ({
          ...s,
          content: String(s.content || '').slice(0, 2000),
        })),
        citations: data.citations || [],
        evidencePack: String(data.evidencePack || '').slice(0, 8000),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job.');
    }
  }

  async function saveToKnowledge() {
    if (!active?.job?.id) return;
    setSaving(true);
    setError(null);
    try {
      let scopes: Array<{ scope_kind: string; bot_slug?: string; project_id?: string }>;
      if (saveScope === 'shared') {
        scopes = [{ scope_kind: 'shared' }];
      } else if (saveScope === 'project') {
        if (!saveProjectId) throw new Error('Select a project for PROJECT knowledge.');
        scopes = [{ scope_kind: 'project', project_id: saveProjectId }];
      } else if (saveScope.startsWith('bot:')) {
        scopes = [{ scope_kind: 'bot', bot_slug: saveScope.slice(4) }];
      } else {
        scopes = [{ scope_kind: 'shared' }];
      }
      const res = await fetch(`/api/research/${active.job.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-to-knowledge', scopes }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Save failed.');
      setActive((prev) =>
        prev
          ? {
              ...prev,
              job: { ...prev.job, knowledge_doc_id: data.knowledgeId || prev.job.knowledge_doc_id },
            }
          : prev,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="view-shell shell-view">
      <div className="view-header">
        <h1>Research</h1>
        <p>
          Live web search → scrape sources → evidence pack. Save to Knowledge only when you approve.
        </p>
      </div>

      <div className="shell-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input
          className="shell-input"
          style={{ flex: 1, minWidth: 220 }}
          placeholder="Research query — e.g. major energy drink distributors in UAE"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void runResearch();
          }}
        />
        <button type="button" className="btn-primary" disabled={busy || !query.trim()} onClick={() => void runResearch()}>
          {busy ? 'Running…' : 'Run research'}
        </button>
      </div>

      {error ? <p className="shell-error" role="alert">{error}</p> : null}

      {active ? (
        <div className="shell-panel card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="shell-meta">
            <span className={`shell-status status-${active.job.status}`}>
              {active.job.status.toUpperCase()}
            </span>
            <span className="shell-muted">
              found {active.job.sources_found} · fetched {active.job.sources_fetched} · failed{' '}
              {active.job.sources_failed}
            </span>
          </div>
          <h2 style={{ fontSize: 16, marginTop: 8 }}>{active.job.query}</h2>
          {active.job.error_message ? <p className="shell-error">{active.job.error_message}</p> : null}
          {active.job.synthesis ? (
            <>
              <h3 style={{ fontSize: 14, marginTop: 12 }}>Synthesis</h3>
              <pre className="shell-excerpt" style={{ whiteSpace: 'pre-wrap' }}>
                {active.job.synthesis}
              </pre>
            </>
          ) : null}
          {active.job.analyst_notes ? (
            <p className="shell-muted" style={{ marginTop: 8 }}>
              Analyst: {active.job.analyst_notes}
            </p>
          ) : null}

          <h3 style={{ fontSize: 14, marginTop: 12 }}>Sources</h3>
          <ul className="shell-list">
            {active.sources.map((s) => (
              <li key={s.id} className="shell-list-item">
                <div className="shell-list-main">
                  <strong>{s.page_title || s.title}</strong>
                  <div className="shell-meta">
                    <span className="shell-muted">{s.status.toUpperCase()}</span>
                    <span className="shell-muted">{s.domain}</span>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.url}
                    </a>
                  </div>
                  {s.status === 'failed' ? (
                    <p className="shell-error">{s.error_message}</p>
                  ) : (
                    <pre className="shell-excerpt">{(s.content || s.snippet).slice(0, 400)}</pre>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {active.citations.length ? (
            <>
              <h3 style={{ fontSize: 14 }}>Citations</h3>
              <ul>
                {active.citations.map((c) => (
                  <li key={c} className="shell-muted">
                    Source: {c}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {active.evidencePack ? (
            <>
              <h3 style={{ fontSize: 14 }}>Evidence pack</h3>
              <pre className="shell-excerpt" style={{ maxHeight: 240, overflow: 'auto' }}>
                {active.evidencePack.slice(0, 4000)}
              </pre>
            </>
          ) : null}

          {active.job.status === 'complete' ? (
            <div className="shell-toolbar" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
              <select
                className="shell-input"
                value={saveScope}
                onChange={(e) => setSaveScope(e.target.value)}
                aria-label="Save scope"
              >
                <option value="shared">Save → SHARED</option>
                <option value="bot:mian">Save → MANAGER</option>
                <option value="bot:ops">Save → OPS</option>
                <option value="bot:analyst">Save → ANALYST</option>
                <option value="bot:scrape">Save → SCRAPE</option>
                <option value="bot:social">Save → SOCIAL</option>
                <option value="project">Save → PROJECT</option>
              </select>
              {saveScope === 'project' ? (
                <select
                  className="shell-input"
                  value={saveProjectId}
                  onChange={(e) => setSaveProjectId(e.target.value)}
                  aria-label="Project"
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
                disabled={
                  saving ||
                  Boolean(active.job.knowledge_doc_id) ||
                  (saveScope === 'project' && !saveProjectId)
                }
                onClick={() => void saveToKnowledge()}
              >
                {active.job.knowledge_doc_id
                  ? 'Saved to Knowledge'
                  : saving
                    ? 'Saving…'
                    : 'Save to Knowledge'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <h2 style={{ fontSize: 16 }}>Recent jobs</h2>
      {jobs.length === 0 ? (
        <p className="shell-muted">No research jobs yet.</p>
      ) : (
        <ul className="shell-list">
          {jobs.map((j) => (
            <li key={j.id} className="shell-list-item card">
              <button
                type="button"
                className="shell-list-main"
                style={{ cursor: 'pointer', width: '100%', textAlign: 'left', background: 'none', border: 0, color: 'inherit' }}
                onClick={() => void openJob(j.id)}
              >
                <h3>{j.query}</h3>
                <div className="shell-meta">
                  <span className={`shell-status status-${j.status}`}>{j.status.toUpperCase()}</span>
                  <span className="shell-muted">
                    {j.sources_fetched}/{j.sources_found} fetched
                  </span>
                  {j.knowledge_doc_id ? <span className="shell-muted">in Knowledge</span> : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
