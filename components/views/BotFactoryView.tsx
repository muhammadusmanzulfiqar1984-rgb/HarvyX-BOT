'use client';

import { parseJson } from '@/lib/client-api';
import { useCallback, useEffect, useState } from 'react';

type Template = {
  id: string;
  name: string;
  description: string;
  role: string;
  modelTier: string;
  toolPack: string;
  tools: string[];
  allowedProviders: string[];
};

type FactoryBot = {
  id: string;
  slug: string;
  name: string;
  description: string;
  role: string;
  status: string;
  version: number;
  instructions: string;
  modelTier: string;
  modelPolicy?: { provider?: string; tier?: string };
  toolPack: string;
  capabilities?: { tools?: string[] };
};

type Catalog = {
  tools: string[];
  modelTiers: string[];
  providers: string[];
  toolPacks: string[];
};

type Check = { id: string; ok: boolean; message: string };

export function BotFactoryView() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [bots, setBots] = useState<FactoryBot[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);

  // Create form
  const [templateId, setTemplateId] = useState('generic-specialist');
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [tools, setTools] = useState<string[]>(['searchKnowledge']);
  const [provider, setProvider] = useState('groq');
  const [modelTier, setModelTier] = useState('fast');

  const selected = bots.find((b) => b.slug === selectedSlug) ?? null;

  const refresh = useCallback(async () => {
    const res = await fetch('/api/bots/factory', { credentials: 'same-origin' });
    const data = await parseJson(res);
    if (!res.ok) throw new Error(data?.error || 'Failed to load Bot Factory.');
    setTemplates(data.templates || []);
    setCatalog(data.catalog || null);
    setBots(data.bots || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Load failed.');
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setTools([...t.tools]);
    setModelTier(t.modelTier);
    setProvider(t.allowedProviders[0] || 'groq');
    if (!instructions) setInstructions(t.description);
  }, [templateId, templates]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createBot() {
    setBusy(true);
    setError(null);
    setInfo(null);
    setChecks([]);
    try {
      const res = await fetch('/api/bots/factory', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          templateId,
          slug,
          name,
          description,
          instructions: instructions || undefined,
          tools,
          provider,
          modelTier,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        setChecks(data?.validation?.checks || []);
        if (res.status === 401) {
          throw new Error(data?.error || 'Sign in as an operator to create bots.');
        }
        throw new Error(data?.error || 'Create failed.');
      }
      setInfo(`Created ${data.bot.slug} (v${data.bot.version}, status=${data.bot.status}).`);
      setSelectedSlug(data.bot.slug);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed.');
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: string) {
    if (!selectedSlug) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    setChecks([]);
    try {
      const res = await fetch(`/api/bots/factory/${selectedSlug}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await parseJson(res);
      if (data?.validation?.checks) setChecks(data.validation.checks);
      if (data?.checks) setChecks(data.checks);
      if (!res.ok || data?.ok === false) {
        if (res.status === 401) {
          throw new Error(data?.error || 'Sign in as an operator to manage bots.');
        }
        throw new Error(data?.error || `${action} failed.`);
      }
      setInfo(`${action} OK${data.bot ? ` — status=${data.bot.status}` : ''}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed.`);
    } finally {
      setBusy(false);
    }
  }

  function toggleTool(tool: string) {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool],
    );
  }

  return (
    <div className="view-shell shell-view">
      <div className="view-header">
        <h1>Bot Factory</h1>
        <p>
          Create, validate, test, activate, and disable specialist bots. Least privilege by default —
          no connectors or CRM tools.
        </p>
      </div>

      {error ? (
        <p className="shell-error" role="alert">
          {error}
        </p>
      ) : null}
      {info ? <p className="shell-muted">{info}</p> : null}

      <div className="shell-grid-2" style={{ display: 'grid', gap: 24, gridTemplateColumns: '1fr 1fr' }}>
        <section className="shell-panel">
          <h2>Create bot</h2>
          <label className="shell-field">
            <span>Template</span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={busy}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="shell-field">
            <span>Slug</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="test-market-researcher"
              disabled={busy}
            />
          </label>
          <label className="shell-field">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Market Researcher"
              disabled={busy}
            />
          </label>
          <label className="shell-field">
            <span>Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="shell-field">
            <span>Instructions</span>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              disabled={busy}
            />
          </label>
          <label className="shell-field">
            <span>Model tier</span>
            <select
              value={modelTier}
              onChange={(e) => setModelTier(e.target.value)}
              disabled={busy}
            >
              {(catalog?.modelTiers || ['fast', 'reasoning']).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="shell-field">
            <span>Provider</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={busy}
            >
              {(catalog?.providers || ['groq']).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="shell-field">
            <legend>Allowed tools</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(catalog?.tools || []).map((tool) => (
                <label key={tool} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={tools.includes(tool)}
                    onChange={() => toggleTool(tool)}
                    disabled={busy}
                  />
                  {tool}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="shell-actions">
            <button type="button" className="btn-primary" disabled={busy || !slug || !name} onClick={() => void createBot()}>
              Create
            </button>
          </div>
        </section>

        <section className="shell-panel">
          <h2>Factory bots</h2>
          {bots.length === 0 ? (
            <p className="shell-muted">No factory bots yet.</p>
          ) : (
            <ul className="shell-list">
              {bots.map((b) => (
                <li key={b.slug}>
                  <button
                    type="button"
                    className={selectedSlug === b.slug ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setSelectedSlug(b.slug)}
                    disabled={busy}
                    style={{ width: '100%', textAlign: 'left', marginBottom: 8 }}
                  >
                    <strong>{b.name}</strong> <code>{b.slug}</code> — {b.status} (v{b.version})
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selected ? (
            <div style={{ marginTop: 16 }}>
              <h3>{selected.name}</h3>
              <p className="shell-muted">{selected.description}</p>
              <p>
                Status: <strong>{selected.status}</strong> · Tools:{' '}
                {(selected.capabilities?.tools || []).join(', ') || 'none'}
              </p>
              <div className="shell-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => void runAction('validate')}>
                  Validate
                </button>
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => void runAction('test')}>
                  Test
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || selected.status === 'active'}
                  onClick={() => void runAction('activate')}
                >
                  Activate
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy || selected.status !== 'active'}
                  onClick={() => void runAction('disable')}
                >
                  Disable
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void runAction('delete')}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : null}

          {checks.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <h3>Checks</h3>
              <ul>
                {checks.map((c) => (
                  <li key={c.id} style={{ color: c.ok ? 'inherit' : 'var(--danger, #b33)' }}>
                    {c.ok ? 'PASS' : 'FAIL'}: {c.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
