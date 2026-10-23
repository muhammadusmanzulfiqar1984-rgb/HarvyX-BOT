'use client';

import { parseJson } from '@/lib/client-api';
import { useCallback, useEffect, useState } from 'react';

type Notification = {
  id: string;
  title: string;
  body: string;
  read: number;
  href: string | null;
  created_at: string;
};

export function NotificationsView() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/notifications');
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to load notifications.');
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(opts: { id?: string; all?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to mark read.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark read.');
    } finally {
      setBusy(false);
    }
  }

  const unread = items.filter((n) => n.read === 0).length;

  return (
    <div className="view-shell shell-view">
      <div className="view-header">
        <h1>Notifications</h1>
        <p>Operator notices stored in this deployment.</p>
      </div>

      <div className="shell-toolbar">
        <span className="shell-muted">{unread} unread</span>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || unread === 0}
          onClick={() => markRead({ all: true })}
        >
          Mark all read
        </button>
      </div>

      {error ? <p className="shell-error" role="alert">{error}</p> : null}
      {loading ? <p className="shell-muted">Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="shell-muted">No notifications.</p>
      ) : (
        <ul className="shell-list">
          {items.map((n) => (
            <li key={n.id} className={`shell-list-item card${n.read ? '' : ' is-unread'}`}>
              <div className="shell-list-main">
                <h3>{n.title}</h3>
                {n.body ? <p>{n.body}</p> : null}
                <div className="shell-meta">
                  <span className="shell-muted">{new Date(n.created_at).toLocaleString()}</span>
                  {n.read ? (
                    <span className="badge badge-planned">Read</span>
                  ) : (
                    <span className="badge badge-active">Unread</span>
                  )}
                </div>
              </div>
              <div className="shell-actions">
                {!n.read ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => markRead({ id: n.id })}
                  >
                    Mark read
                  </button>
                ) : null}
                {n.href ? (
                  <a className="btn-ghost" href={n.href}>
                    Open
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
