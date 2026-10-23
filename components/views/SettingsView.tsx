'use client';

import { parseJson } from '@/lib/client-api';
import { useCallback, useEffect, useState } from 'react';

interface ConnectorStatus {
  provider: string;
  connected: boolean;
  accountEmail?: string;
  scopes?: string[];
  connectedAt?: string;
}

type SettingsMap = Record<string, unknown>;

const DEFAULTS: SettingsMap = {
  account: { displayName: '', language: 'en' },
  appearance: { theme: 'harvyx-royal', density: 'comfortable' },
  ai: {
    defaultModel: 'Groq · openai/gpt-oss-120b',
    reasoningModel: 'NVIDIA NIM · nvidia/nemotron-3-ultra-550b-a55b',
    agentRouting: 'prompt-driven',
  },
  chat: { enterToSend: true, showTimestamps: false },
  notifications: { enabled: false, emailDigest: false },
  security: { sessionNote: 'Cookie sessions when authenticated' },
  data: { conversations: 'Cloudflare D1', knowledge: 'D1 + in-process vector index (RAG)' },
  about: { product: 'HARVYX BOT', version: '0.1.0' },
};

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function ConnectionRow({ name, connected }: { name: string; connected: boolean }) {
  return (
    <div className="settings-row">
      <span>{name}</span>
      <span className={`status-pill ${connected ? 'status-connected' : 'status-disconnected'}`}>
        <span className="status-dot" aria-hidden />
        {connected ? 'Connected' : 'Not connected'}
      </span>
    </div>
  );
}

function PlannedConnectionRow({ name }: { name: string }) {
  return (
    <div className="settings-row">
      <span>{name}</span>
      <span className="badge badge-planned">Coming soon</span>
    </div>
  );
}

function GoogleConnectionRow({ provider, label }: { provider: 'gmail' | 'calendar'; label: string }) {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch(`/api/connectors/${provider}/status`)
      .then((r) => r.json())
      .then((data) => setStatus(data as ConnectorStatus))
      .catch(() => setStatus({ provider, connected: false }));
  }, [provider]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch(`/api/connectors/${provider}/disconnect`, { method: 'POST' });
      setStatus({ provider, connected: false });
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = status?.connected ?? false;

  return (
    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
      <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span className={`status-pill ${connected ? 'status-connected' : 'status-disconnected'}`}>
          <span className="status-dot" aria-hidden />
          {status === null ? 'Checking…' : connected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      {connected && status?.accountEmail ? (
        <span className="settings-value" style={{ fontSize: '0.75rem' }}>
          {status.accountEmail}
        </span>
      ) : null}
      <div style={{ marginTop: '4px' }}>
        {connected ? (
          <button type="button" className="btn-secondary" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <a href={`/api/connectors/${provider}/connect`}>
            <button type="button" className="btn-secondary">
              Connect {label}
            </button>
          </a>
        )}
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      <div className="settings-card">{children}</div>
    </section>
  );
}

export function SettingsView() {
  const [settings, setSettings] = useState<SettingsMap>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [authLabel, setAuthLabel] = useState('Not signed in');

  const mergeFromApi = useCallback((rows: { key: string; value: unknown }[]) => {
    const next: SettingsMap = { ...DEFAULTS };
    for (const row of rows) {
      if (row.key in DEFAULTS) {
        next[row.key] = { ...asObj(DEFAULTS[row.key]), ...asObj(row.value) };
      }
    }
    setSettings(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settingsRes, authRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/auth/status'),
        ]);
        const settingsData = await parseJson(settingsRes);
        const authData: {
          authenticated?: boolean;
          account?: { display_name?: string; email?: string } | null;
        } = await parseJson(authRes).catch(() => ({ authenticated: false, account: null }));
        if (!cancelled) {
          if (settingsRes.ok && Array.isArray(settingsData.settings)) {
            mergeFromApi(settingsData.settings);
          }
          if (authData.authenticated && authData.account) {
            setAuthLabel(
              authData.account.display_name || authData.account.email || 'Signed in',
            );
          } else {
            setAuthLabel('Not signed in');
          }
        }
      } catch {
        if (!cancelled) setError('Could not load settings (database may be unavailable).');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mergeFromApi]);

  function updateSection(section: string, key: string, value: unknown) {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...asObj(prev[section]), [key]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const key of Object.keys(DEFAULTS)) {
        payload[key] = settings[key];
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Save failed.');
      if (Array.isArray(data.settings)) mergeFromApi(data.settings);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const account = asObj(settings.account);
  const appearance = asObj(settings.appearance);
  const ai = asObj(settings.ai);
  const chat = asObj(settings.chat);
  const notifications = asObj(settings.notifications);
  const about = asObj(settings.about);
  const theme = String(appearance.theme || 'harvyx-royal');

  return (
    <div className="view-shell shell-view">
      <div className="view-header">
        <h1>Settings</h1>
        <p>
          Persisted preferences for this deployment. Connections and providers below reflect live
          status where available; unavailable features stay labeled honestly.
        </p>
      </div>

      {loading ? <p className="shell-muted">Loading settings…</p> : null}
      {error ? <p className="shell-error" role="alert">{error}</p> : null}

      <div className="shell-toolbar">
        <button type="button" className="btn-primary" disabled={saving || loading} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {savedAt ? <span className="shell-muted">Saved {savedAt}</span> : null}
      </div>

      <SettingsSection title="Account">
        <div className="settings-row">
          <span>Session</span>
          <span className="settings-value">{authLabel}</span>
        </div>
        <div className="settings-row">
          <span>Display name preference</span>
          <input
            className="shell-input shell-input-inline"
            value={String(account.displayName ?? '')}
            onChange={(e) => updateSection('account', 'displayName', e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="settings-row">
          <span>Language</span>
          <select
            className="shell-input shell-input-inline"
            value={String(account.language ?? 'en')}
            onChange={(e) => updateSection('account', 'language', e.target.value)}
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="ur">اردو</option>
          </select>
        </div>
      </SettingsSection>

      <SettingsSection title="Appearance">
        <div className="theme-grid">
          <button
            type="button"
            className={`theme-swatch ${theme === 'harvyx-royal' ? 'selected' : ''}`}
            onClick={() => updateSection('appearance', 'theme', 'harvyx-royal')}
          >
            <div className="theme-swatch-preview theme-preview-royal" />
            <span>Obsidian Silver</span>
            {theme === 'harvyx-royal' ? <span className="badge badge-active">Active</span> : null}
          </button>
          <div className="theme-swatch disabled">
            <div className="theme-swatch-preview theme-preview-future" />
            <span>More themes</span>
            <span className="badge badge-planned">Coming soon</span>
          </div>
        </div>
        <div className="settings-row">
          <span>Density</span>
          <select
            className="shell-input shell-input-inline"
            value={String(appearance.density ?? 'comfortable')}
            onChange={(e) => updateSection('appearance', 'density', e.target.value)}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </div>
      </SettingsSection>

      <SettingsSection title="AI & Models">
        <div className="settings-row">
          <span>Default / Fast model</span>
          <span className="settings-value">{String(ai.defaultModel)}</span>
        </div>
        <div className="settings-row">
          <span>Reasoning model</span>
          <span className="settings-value">{String(ai.reasoningModel)}</span>
        </div>
        <div className="settings-row">
          <span>Agent routing</span>
          <span className="settings-value">{String(ai.agentRouting)}</span>
        </div>
        <p className="shell-muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
          Model endpoints are configured server-side. These labels are informational preferences.
        </p>
      </SettingsSection>

      <SettingsSection title="Chat">
        <label className="settings-row">
          <span>Enter to send</span>
          <input
            type="checkbox"
            checked={Boolean(chat.enterToSend)}
            onChange={(e) => updateSection('chat', 'enterToSend', e.target.checked)}
          />
        </label>
        <label className="settings-row">
          <span>Show timestamps</span>
          <input
            type="checkbox"
            checked={Boolean(chat.showTimestamps)}
            onChange={(e) => updateSection('chat', 'showTimestamps', e.target.checked)}
          />
        </label>
        <div className="settings-row">
          <span>Keyboard</span>
          <span className="settings-value">Enter to send · Shift+Enter newline · ⌘K palette</span>
        </div>
      </SettingsSection>

      <SettingsSection title="Notifications">
        <label className="settings-row">
          <span>In-app notifications</span>
          <input
            type="checkbox"
            checked={Boolean(notifications.enabled)}
            onChange={(e) => updateSection('notifications', 'enabled', e.target.checked)}
          />
        </label>
        <label className="settings-row">
          <span>Email digest</span>
          <input
            type="checkbox"
            checked={Boolean(notifications.emailDigest)}
            onChange={(e) => updateSection('notifications', 'emailDigest', e.target.checked)}
          />
        </label>
        <p className="shell-muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
          Email digest delivery is not configured. Preference is stored only.
        </p>
      </SettingsSection>

      <SettingsSection title="Connections">
        <GoogleConnectionRow provider="gmail" label="Google Gmail" />
        <GoogleConnectionRow provider="calendar" label="Google Calendar" />
        <PlannedConnectionRow name="LinkedIn" />
        <PlannedConnectionRow name="Slack" />
        <PlannedConnectionRow name="Google Drive" />
        <PlannedConnectionRow name="Notion" />
        <ConnectionRow name="HarvYX" connected />
        <ConnectionRow name="Cloudflare" connected />
        <ConnectionRow name="NVIDIA" connected />
        <ConnectionRow name="Groq" connected />
      </SettingsSection>

      <SettingsSection title="Data & Memory">
        <div className="settings-row">
          <span>Conversations</span>
          <span className="settings-value">Stored in Cloudflare D1</span>
        </div>
        <div className="settings-row">
          <span>Knowledge</span>
          <span className="settings-value">RAG active — Shared / Bot / Project scopes</span>
        </div>
        <div className="settings-row">
          <span>Memory</span>
          <span className="settings-value">Not yet available</span>
        </div>
        <div className="settings-row">
          <span>Export / Delete</span>
          <button type="button" className="btn-secondary" disabled>
            Not yet available
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title="Security">
        <div className="settings-row">
          <span>Authentication</span>
          <span className="settings-value">{authLabel === 'Not signed in' ? 'Optional operator login' : 'Session active'}</span>
        </div>
        <div className="settings-row">
          <span>Sessions</span>
          <span className="settings-value">HttpOnly cookie when signed in</span>
        </div>
        <div className="settings-row">
          <span>API access</span>
          <span className="settings-value">Server-side keys only, not exposed to the client</span>
        </div>
        <div className="settings-row">
          <span>Audit</span>
          <span className="settings-value">Not yet available</span>
        </div>
      </SettingsSection>

      <SettingsSection title="About">
        <div className="settings-row">
          <span>Product</span>
          <span className="settings-value">{String(about.product || 'HARVYX BOT')}</span>
        </div>
        <div className="settings-row">
          <span>Version</span>
          <span className="settings-value">{String(about.version || '0.1.0')}</span>
        </div>
      </SettingsSection>
    </div>
  );
}
