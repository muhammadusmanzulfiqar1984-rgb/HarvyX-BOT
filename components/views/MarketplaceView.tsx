'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProviderIcon } from '@/components/marketplace/ProviderIcon';

type Category = { id: string; name: string; description: string };

type ProviderCard = {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  catalogStatus: string;
  auth: string;
  connectSupported: boolean;
  capabilityCount: number;
  connectionLabel: string;
};

type Capability = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  executionMode: string;
  requiresConnection: boolean;
  requiresApproval: boolean;
  supportsAsync: boolean;
};

type ProviderDetail = {
  provider: ProviderCard & { health?: { ok: boolean; status: string; detail?: string } };
  capabilities: Capability[];
};

function statusLabel(label: string): string {
  switch (label) {
    case 'connected':
      return 'Connected';
    case 'requires_connection':
      return 'Requires connection';
    case 'coming_soon':
      return 'Coming soon';
    case 'disabled':
      return 'Disabled';
    default:
      return 'Available';
  }
}

function statusClass(label: string): string {
  if (label === 'connected') return 'is-connected';
  if (label === 'requires_connection') return 'is-requires';
  if (label === 'coming_soon') return 'is-soon';
  return 'is-available';
}

export function MarketplaceView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/marketplace?${params.toString()}`);
      const data = (await res.json()) as {
        categories?: Category[];
        providers?: ProviderCard[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Failed to load marketplace.');
      setCategories(data.categories || []);
      setProviders(data.providers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marketplace.');
    } finally {
      setLoading(false);
    }
  }, [category, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/marketplace/providers/${selected}`)
      .then((r) => r.json() as Promise<ProviderDetail & { error?: string }>)
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load provider detail.');
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const filtered = useMemo(() => providers, [providers]);

  async function connect(providerId: string) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/marketplace/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          metadata: providerId === 'mcp_generic' ? { serverId: 'local-mcp' } : {},
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Connect failed.');
      setNotice(`${providerId} connection recorded (metadata only — no secrets stored).`);
      await load();
      setSelected(providerId);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Connect failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="view-shell shell-view hx-marketplace">
      <div className="view-header">
        <h1>Marketplace</h1>
        <p>Capability catalog for HARVYX-BOT. Catalog ≠ connected.</p>
      </div>

      <div className="hx-mp-toolbar">
        <input
          className="hx-mp-search"
          type="search"
          placeholder="Search providers…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search marketplace"
        />
        <div className="hx-mp-cats" role="tablist" aria-label="Categories">
          <button
            type="button"
            className={`hx-mp-cat${category === 'all' ? ' is-on' : ''}`}
            onClick={() => setCategory('all')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`hx-mp-cat${category === c.id ? ' is-on' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="shell-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="shell-notice-inline">{notice}</p> : null}

      {loading ? (
        <p className="shell-muted">Loading catalog…</p>
      ) : (
        <div className={`hx-mp-layout${selected ? ' has-detail' : ''}`}>
          <div className="hx-mp-grid">
            {filtered.map((p) => (
              <article key={p.id} className="hx-mp-card">
                <header className="hx-mp-card-head">
                  <div className="hx-mp-card-title">
                    <ProviderIcon icon={p.icon || p.id} name={p.name} size={36} />
                    <h2>{p.name}</h2>
                  </div>
                  <span className="hx-mp-cat-tag">{p.category}</span>
                </header>
                <p className="hx-mp-desc">{p.description}</p>
                <div className="hx-mp-meta">
                  <span className={`hx-mp-status ${statusClass(p.connectionLabel)}`}>
                    {statusLabel(p.connectionLabel)}
                  </span>
                  <span className="hx-mp-caps">{p.capabilityCount} capabilities</span>
                </div>
                <div className="hx-mp-actions">
                  <button type="button" className="btn-secondary" onClick={() => setSelected(p.id)}>
                    Open
                  </button>
                  {p.connectSupported && p.connectionLabel !== 'connected' ? (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy || p.catalogStatus === 'coming_soon'}
                      onClick={() => void connect(p.id)}
                    >
                      Connect
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {filtered.length === 0 ? (
              <p className="shell-muted">No providers match this filter.</p>
            ) : null}
          </div>

          {detail ? (
            <aside className="hx-mp-detail" aria-live="polite">
              <button type="button" className="hx-mp-close" onClick={() => setSelected(null)}>
                Close
              </button>
              <div className="hx-mp-detail-title">
                <ProviderIcon
                  icon={detail.provider.icon || detail.provider.id}
                  name={detail.provider.name}
                  size={44}
                />
                <h2>{detail.provider.name}</h2>
              </div>
              <p className="hx-mp-desc">{detail.provider.description}</p>
              <dl className="hx-mp-dl">
                <div>
                  <dt>Status</dt>
                  <dd className={statusClass(detail.provider.connectionLabel)}>
                    {statusLabel(detail.provider.connectionLabel)}
                  </dd>
                </div>
                <div>
                  <dt>Auth</dt>
                  <dd>{detail.provider.auth}</dd>
                </div>
                <div>
                  <dt>Health</dt>
                  <dd>{detail.provider.health?.detail || detail.provider.health?.status || '—'}</dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd>{detail.provider.catalogStatus}</dd>
                </div>
              </dl>
              <h3>Capabilities</h3>
              <ul className="hx-mp-cap-list">
                {detail.capabilities.map((c) => (
                  <li key={c.id}>
                    <strong>{c.name}</strong>
                    <code>{c.id}</code>
                    <span>{c.description}</span>
                    <span className="hx-mp-cap-meta">
                      {c.executionMode}
                      {c.requiresApproval ? ' · approval' : ''}
                      {c.requiresConnection ? ' · connection' : ''}
                      {' · '}
                      {c.permissions.join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
              {detail.provider.connectSupported &&
              detail.provider.connectionLabel !== 'connected' ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => void connect(detail.provider.id)}
                >
                  Connect
                </button>
              ) : null}
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}
