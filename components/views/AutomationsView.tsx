'use client';

import { parseJson } from '@/lib/client-api';
import { useCallback, useEffect, useState } from 'react';

type Automation = {
  id: string;
  name: string;
  description: string;
  agent_slug: string;
  prompt: string;
  schedule_cron: string | null;
  schedule_label: string;
  enabled: number;
  status: 'enabled' | 'paused';
  schedule_active: number;
  updated_at: string;
};

type AutomationRun = {
  id: string;
  automation_id: string;
  status: string;
  trigger: string;
  detail: string;
  created_at: string;
};

export function AutomationsView() {
  const [items, setItems] = useState<Automation[]>([]);
  const [runsById, setRunsById] = useState<Record<string, AutomationRun[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/automations');
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to load automations.');
      setItems(Array.isArray(data.automations) ? data.automations : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load automations.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadRuns(id: string) {
    try {
      const res = await fetch(`/api/automations/${id}?runs=1`);
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to load runs.');
      setRunsById((prev) => ({ ...prev, [id]: Array.isArray(data.runs) ? data.runs : [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs.');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          prompt: prompt.trim(),
          enabled: true,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Create failed.');
      setName('');
      setPrompt('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed.');
    } finally {
      setCreating(false);
    }
  }

  async function setEnabled(id: string, enabled: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, status: enabled ? 'enabled' : 'paused' }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Update failed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this automation?')) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' });
      const data = await parseJson(res).catch(() => ({ error: 'Delete failed.' }));
      if (!res.ok) throw new Error(data?.error || 'Delete failed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRun(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/automations/${id}/run`, { method: 'POST' });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Run failed.');
      await loadRuns(id);
      setExpandedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="view-shell shell-view">
      <div className="view-header">
        <h1>Automations</h1>
        <p>
          Create and manage automation records. Manual run records a started entry only — scheduled
          execution is not active.
        </p>
      </div>

      <form className="shell-form-card" onSubmit={handleCreate}>
        <div className="shell-form-row">
          <input
            className="shell-input"
            placeholder="Automation name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary" disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
        <textarea
          className="shell-textarea"
          placeholder="Prompt / instructions"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
      </form>

      {error ? <p className="shell-error" role="alert">{error}</p> : null}
      {loading ? <p className="shell-muted">Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="shell-muted">No automations yet.</p>
      ) : (
        <ul className="shell-list">
          {items.map((a) => {
            const busy = busyId === a.id;
            const runs = runsById[a.id] ?? [];
            const scheduleOff = a.schedule_active === 0;
            return (
              <li key={a.id} className="shell-list-item card">
                <div className="shell-list-main">
                  <h3>{a.name}</h3>
                  {a.description ? <p>{a.description}</p> : null}
                  {a.prompt ? <p className="shell-muted">{a.prompt.slice(0, 180)}</p> : null}
                  <div className="shell-meta">
                    <span className={`badge ${a.status === 'enabled' ? 'badge-active' : 'badge-planned'}`}>
                      {a.status}
                    </span>
                    <span className="shell-muted">Agent · {a.agent_slug}</span>
                    {a.schedule_label ? <span className="shell-muted">{a.schedule_label}</span> : null}
                  </div>
                  {scheduleOff ? (
                    <div className="shell-notice shell-notice-inline">
                      Scheduled execution: not active
                    </div>
                  ) : null}
                </div>
                <div className="shell-actions">
                  {a.status === 'enabled' ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => setEnabled(a.id, false)}
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => setEnabled(a.id, true)}
                    >
                      Enable
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => handleRun(a.id)}
                  >
                    Run now
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={async () => {
                      if (expandedId === a.id) {
                        setExpandedId(null);
                        return;
                      }
                      setExpandedId(a.id);
                      await loadRuns(a.id);
                    }}
                  >
                    Runs
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => handleDelete(a.id)}
                  >
                    Delete
                  </button>
                </div>
                {expandedId === a.id ? (
                  <div className="shell-runs">
                    {runs.length === 0 ? (
                      <p className="shell-muted">No runs recorded.</p>
                    ) : (
                      <ul>
                        {runs.map((r) => (
                          <li key={r.id}>
                            <strong>{r.status}</strong> · {r.trigger} ·{' '}
                            {new Date(r.created_at).toLocaleString()}
                            {r.detail ? <div className="shell-muted">{r.detail}</div> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
