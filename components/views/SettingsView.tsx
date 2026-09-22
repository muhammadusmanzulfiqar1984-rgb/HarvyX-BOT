'use client';

import { useState, useEffect } from 'react';

interface ConnectorStatus {
  provider: string;
  connected: boolean;
  accountEmail?: string;
  scopes?: string[];
  connectedAt?: string;
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
      {connected && status?.accountEmail && (
        <span className="settings-value" style={{ fontSize: '0.75rem' }}>{status.accountEmail}</span>
      )}
      {connected && status?.scopes && status.scopes.length > 0 && (
        <span className="settings-value" style={{ fontSize: '0.7rem', opacity: 0.6 }}>
          {status.scopes.map((s) => s.split('/').pop()).join(' · ')}
        </span>
      )}
      <div style={{ marginTop: '4px' }}>
        {connected ? (
          <button className="btn-secondary" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <a href={`/api/connectors/${provider}/connect`}>
            <button className="btn-secondary">Connect {label}</button>
          </a>
        )}
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      <div className="settings-card">{children}</div>
    </section>
  );
}

export function SettingsView() {
  const [theme] = useState<'harvyx-royal'>('harvyx-royal');

  return (
    <div className="view-shell">
      <div className="view-header">
        <h1>Settings</h1>
        <p>Configuration surfaces for HARVYX BOT. Values shown reflect the current deployment.</p>
      </div>

      <SettingsSection title="General">
        <div className="settings-row">
          <span>Product name</span>
          <span className="settings-value">HARVYX BOT</span>
        </div>
        <div className="settings-row">
          <span>Language</span>
          <span className="settings-value">English (default)</span>
        </div>
        <div className="settings-row">
          <span>Notifications</span>
          <span className="settings-value">Not configured</span>
        </div>
        <div className="settings-row">
          <span>Keyboard shortcuts</span>
          <span className="settings-value">Enter to send · Shift+Enter for newline</span>
        </div>
      </SettingsSection>

      <SettingsSection title="Appearance">
        <div className="theme-grid">
          <div className={`theme-swatch ${theme === 'harvyx-royal' ? 'selected' : ''}`}>
            <div className="theme-swatch-preview theme-preview-royal" />
            <span>HarvYX Royal</span>
            {theme === 'harvyx-royal' && <span className="badge badge-active">Default</span>}
          </div>
          <div className="theme-swatch disabled">
            <div className="theme-swatch-preview theme-preview-future" />
            <span>More themes</span>
            <span className="badge badge-planned">Coming soon</span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="AI & Models">
        <div className="settings-row">
          <span>Default / Fast model</span>
          <span className="settings-value">Groq · openai/gpt-oss-120b</span>
        </div>
        <div className="settings-row">
          <span>Reasoning model (default)</span>
          <span className="settings-value">NVIDIA NIM · nvidia/nemotron-3-ultra-550b-a55b</span>
        </div>
        <div className="settings-row">
          <span>Reasoning model (optional)</span>
          <span className="settings-value">Cloudflare · unbiased/pareto (SMART_PROVIDER=pareto)</span>
        </div>
        <div className="settings-row">
          <span>Agent routing</span>
          <span className="settings-value">Prompt-driven — HarvYX Bot decides per request</span>
        </div>
      </SettingsSection>

      <SettingsSection title="Agents">
        <div className="settings-row">
          <span>HarvYX Bot (Manager)</span>
          <span className="badge badge-active">Enabled</span>
        </div>
        <div className="settings-row">
          <span>OPS</span>
          <span className="badge badge-active">Enabled</span>
        </div>
        <div className="settings-row">
          <span>Analyst</span>
          <span className="badge badge-active">Enabled</span>
        </div>
      </SettingsSection>

      <SettingsSection title="Connections">
        <GoogleConnectionRow provider="gmail" label="Google Gmail" />
        <GoogleConnectionRow provider="calendar" label="Google Calendar" />
        <ConnectionRow name="HarvYX" connected />
        <ConnectionRow name="Cloudflare" connected />
        <ConnectionRow name="Cloudflare Pareto" connected={false} />
        <ConnectionRow name="NVIDIA" connected />
        <ConnectionRow name="Groq" connected />
        <ConnectionRow name="Nebius" connected={false} />
        <ConnectionRow name="AWS" connected={false} />
      </SettingsSection>

      <SettingsSection title="Data & Memory">
        <div className="settings-row">
          <span>Conversations</span>
          <span className="settings-value">Stored in Cloudflare D1</span>
        </div>
        <div className="settings-row">
          <span>Knowledge</span>
          <span className="settings-value">Not yet available</span>
        </div>
        <div className="settings-row">
          <span>Memory</span>
          <span className="settings-value">Not yet available</span>
        </div>
        <div className="settings-row">
          <span>Export / Delete</span>
          <button className="btn-secondary" disabled>
            Not yet available
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title="Security">
        <div className="settings-row">
          <span>Authentication</span>
          <span className="settings-value">Not configured</span>
        </div>
        <div className="settings-row">
          <span>Sessions</span>
          <span className="settings-value">Not configured</span>
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
          <span className="settings-value">HARVYX BOT</span>
        </div>
        <div className="settings-row">
          <span>Version</span>
          <span className="settings-value">0.1.0</span>
        </div>
      </SettingsSection>
    </div>
  );
}
