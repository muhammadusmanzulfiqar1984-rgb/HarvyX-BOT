'use client';

import { parseJson } from '@/lib/client-api';
import { useEffect, useState } from 'react';
import type { WorkspaceSection } from '../nav';
import type { BotCatalogItem, BotLifecycleStatus } from '@/lib/bots/types';
import { AgentAvatar, type AgentUxState } from '../AgentAvatar';
import {
  AGENT_IDENTITIES,
  animalLabel,
  resolveAgentIdentity,
} from '@/lib/agent-avatar/identity';
import { resolveAgentId } from '@/lib/living-particle';

const FALLBACK: BotCatalogItem[] = [
  {
    id: 'mian',
    slug: 'mian',
    name: 'HarvYX Bot',
    displayName: 'HARVYX Manager',
    role: 'Manager',
    kind: 'orchestrator',
    description: 'Master command. Answers directly or delegates.',
    status: 'active',
    version: 1,
    tags: [],
    modelTier: 'fast',
    toolPack: 'delegate',
    visual: { symbol: 'lion', particleAgent: 'manager', motionProfile: 'lion-breath' },
  },
  {
    id: 'ops',
    slug: 'ops',
    name: 'OPS',
    role: 'Operations',
    kind: 'specialist',
    description: 'HarvYX CRM — leads, campaigns, pipeline, drafts.',
    status: 'active',
    version: 1,
    tags: [],
    modelTier: 'fast',
    toolPack: 'harvyx',
    visual: { symbol: 'horse', particleAgent: 'ops', motionProfile: 'horse-gallop' },
  },
  {
    id: 'analyst',
    slug: 'analyst',
    name: 'Analyst',
    role: 'Reasoning',
    kind: 'specialist',
    description: 'Deep reasoning, synthesis, strategy briefs.',
    status: 'active',
    version: 1,
    tags: [],
    modelTier: 'reasoning',
    toolPack: 'none',
    visual: { symbol: 'owl', particleAgent: 'analyst', motionProfile: 'owl-observe' },
  },
  {
    id: 'scrape',
    slug: 'scrape',
    name: 'Scrape',
    role: 'Web Research',
    kind: 'specialist',
    description: 'Public URL extraction and enrichment.',
    status: 'active',
    version: 1,
    tags: [],
    modelTier: 'fast',
    toolPack: 'scrape',
    visual: { symbol: 'falcon', particleAgent: 'scrape', motionProfile: 'falcon-flight' },
  },
  {
    id: 'social',
    slug: 'social',
    name: 'Social',
    role: 'Social Media',
    kind: 'specialist',
    description: 'Platform strategy and content critique.',
    status: 'active',
    version: 1,
    tags: [],
    modelTier: 'reasoning',
    toolPack: 'none',
    visual: { symbol: 'hummingbird', particleAgent: 'social', motionProfile: 'hummingbird-hover' },
  },
];

const ORDER = ['mian', 'ops', 'analyst', 'scrape', 'social'];

const DEMO_STATES: AgentUxState[] = [
  'idle',
  'thinking',
  'working',
  'researching',
  'scraping',
  'analyzing',
  'delegating',
  'completed',
  'error',
];

function particleAgentFor(bot: BotCatalogItem): string {
  const fromBot = bot.visual?.particleAgent?.trim();
  if (fromBot) return fromBot;
  return resolveAgentId(bot.slug) ?? bot.slug;
}

function statusLabel(status: string): string {
  if (status === 'active') return 'Active';
  if (status === 'paused') return 'Paused';
  if (status === 'archived') return 'Archived';
  if (status === 'testing') return 'Testing';
  return status;
}

export function AgentsView({ onNavigate }: { onNavigate: (section: WorkspaceSection) => void }) {
  const [agents, setAgents] = useState<BotCatalogItem[]>(FALLBACK);
  const [selected, setSelected] = useState<string>('mian');
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoState, setDemoState] = useState<AgentUxState>('idle');
  const [multiActive, setMultiActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/bots')
      .then((r) => r.json() as Promise<{ installed?: BotCatalogItem[] }>)
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.installed) && data.installed.length > 0) {
          const bySlug = new Map(data.installed.map((a) => [a.slug, a]));
          const ordered = ORDER.map((s) => bySlug.get(s)).filter(Boolean) as BotCatalogItem[];
          const rest = data.installed.filter((a) => !ORDER.includes(a.slug));
          setAgents([...ordered, ...rest]);
        }
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function patchStatus(slug: string, status: BotLifecycleStatus) {
    setBusySlug(slug);
    setError(null);
    try {
      const res = await fetch(`/api/bots/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Status update failed.');
      const nextStatus = (data?.bot?.status as BotLifecycleStatus) || status;
      setAgents((prev) =>
        prev.map((a) => (a.slug === slug ? { ...a, status: nextStatus } : a)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setBusySlug(null);
    }
  }

  const active = agents.find((a) => a.slug === selected) ?? agents[0];
  const activeKey = active ? particleAgentFor(active) : 'manager';
  const identity = resolveAgentIdentity(active?.slug ?? 'mian');

  function rosterStateFor(slug: string): AgentUxState {
    if (!multiActive) {
      return slug === selected ? demoState : 'idle';
    }
    if (slug === 'mian') {
      if (demoState === 'error') return 'error';
      if (demoState === 'completed') return 'completed';
      return 'delegating';
    }
    if (slug === 'scrape') return 'scraping';
    if (slug === 'analyst') return 'analyzing';
    if (slug === 'ops' || slug === 'social') return 'working';
    return demoState;
  }

  return (
    <div className="view-shell shell-view">
      <div className="view-header">
        <h1>Agents</h1>
        <p>Living particle animals. Pause, activate, or archive via the bot registry.</p>
      </div>

      {error ? <p className="shell-error" role="alert">{error}</p> : null}

      <div className="agent-state-demo" aria-label="Animal animation state demo">
        <span className="agent-state-demo-label">Visual state</span>
        <div className="agent-state-demo-row">
          {DEMO_STATES.map((s) => (
            <button
              key={s}
              type="button"
              className={`agent-state-chip${demoState === s ? ' is-on' : ''}`}
              onClick={() => setDemoState(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="agent-state-multi">
          <input
            type="checkbox"
            checked={multiActive}
            onChange={(e) => setMultiActive(e.target.checked)}
          />
          Multiple agents active (delegation)
        </label>
      </div>

      {active ? (
        <div className="agent-living-stage" aria-live="polite">
          <AgentAvatar
            key={active.slug}
            agent={activeKey}
            state={rosterStateFor(active.slug)}
            size={300}
            entranceRoar={activeKey === 'manager'}
            metal={activeKey === 'manager' ? 'gold' : 'silver'}
            label={`HARVYX ${identity.label} · ${animalLabel(identity.animal)}`}
          />
          <div className="agent-living-meta">
            <span className="agent-living-name">
              {active.slug === 'mian' ? 'HARVYX BOT' : active.name}
            </span>
            <span className="agent-living-role">
              {active.slug === 'mian' ? 'Manager' : active.role}
              {' · '}
              {animalLabel(identity.animal)}
            </span>
            <span className="agent-living-desc">{active.description}</span>
            <span className={`badge ${active.status === 'active' ? 'badge-active' : 'badge-planned'}`}>
              {statusLabel(active.status)} · {rosterStateFor(active.slug)}
            </span>
            <div className="shell-actions" style={{ marginTop: 12 }}>
              {active.status !== 'active' ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busySlug === active.slug}
                  onClick={() => patchStatus(active.slug, 'active')}
                >
                  Activate
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busySlug === active.slug}
                  onClick={() => patchStatus(active.slug, 'paused')}
                >
                  Pause
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                disabled={busySlug === active.slug || active.status === 'archived'}
                onClick={() => patchStatus(active.slug, 'archived')}
              >
                Archive
              </button>
              <button type="button" className="btn-primary" onClick={() => onNavigate('chat')}>
                Open chat
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="agent-roster agent-roster--animals">
        {AGENT_IDENTITIES.map((id) => {
          const a = agents.find((x) => x.slug === id.slug);
          if (!a) return null;
          const isOn = a.slug === selected;
          return (
            <button
              key={a.slug}
              type="button"
              className={`agent-sign agent-sign-${a.slug}${isOn ? ' is-selected' : ''}`}
              onClick={() => setSelected(a.slug)}
              onDoubleClick={() => onNavigate('chat')}
              aria-pressed={isOn}
            >
              <span className="agent-sign-totem" aria-hidden>
                <AgentAvatar
                  agent={id.slug}
                  state={rosterStateFor(id.slug)}
                  size={56}
                  className="hx-agent-avatar--sign"
                />
              </span>
              <span className="agent-sign-copy">
                <span className="agent-sign-name">{a.slug === 'mian' ? 'HARVYX BOT' : a.name}</span>
                <span className="agent-sign-role">
                  {a.slug === 'mian' ? 'Manager' : a.role} · {animalLabel(id.animal)}
                </span>
                <span className="agent-sign-desc">{a.description}</span>
              </span>
              <span className="agent-sign-status">{statusLabel(a.status)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
