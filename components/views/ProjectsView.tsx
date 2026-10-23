'use client';

import { parseJson } from '@/lib/client-api';
import { useCallback, useEffect, useState } from 'react';

type Project = {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
};

export function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/projects');
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to load projects.');
      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects.');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Create failed.');
      setName('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed.');
    } finally {
      setCreating(false);
    }
  }

  async function patchProject(id: string, patch: Partial<Pick<Project, 'name' | 'description' | 'status'>>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Update failed.');
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project permanently?')) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      const data = await parseJson(res).catch(() => ({ error: 'Delete failed.' }));
      if (!res.ok) throw new Error(data?.error || 'Delete failed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="view-shell shell-view">
      <div className="view-header">
        <h1>Projects</h1>
        <p>Group work into named projects. Archive keeps them out of the active list.</p>
      </div>

      <form className="shell-form-card" onSubmit={handleCreate}>
        <div className="shell-form-row">
          <input
            className="shell-input"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            required
          />
          <button type="submit" className="btn-primary" disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
        <textarea
          className="shell-textarea"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={2000}
        />
      </form>

      {error ? <p className="shell-error" role="alert">{error}</p> : null}
      {loading ? <p className="shell-muted">Loading projects…</p> : null}

      {!loading && projects.length === 0 ? (
        <p className="shell-muted">No projects yet.</p>
      ) : (
        <ul className="shell-list">
          {projects.map((p) => {
            const busy = busyId === p.id;
            const editing = editingId === p.id;
            return (
              <li key={p.id} className="shell-list-item card">
                <div className="shell-list-main">
                  {editing ? (
                    <input
                      className="shell-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <>
                      <h3>{p.name}</h3>
                      {p.description ? <p>{p.description}</p> : null}
                    </>
                  )}
                  <div className="shell-meta">
                    <span className={`badge ${p.status === 'active' ? 'badge-active' : 'badge-planned'}`}>
                      {p.status}
                    </span>
                    <span className="shell-muted">Updated {new Date(p.updated_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="shell-actions">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy || !editName.trim()}
                        onClick={() => patchProject(p.id, { name: editName.trim() })}
                      >
                        Save
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(p.id);
                          setEditName(p.name);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() =>
                          patchProject(p.id, {
                            status: p.status === 'active' ? 'archived' : 'active',
                          })
                        }
                      >
                        {p.status === 'active' ? 'Archive' : 'Restore'}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => handleDelete(p.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
