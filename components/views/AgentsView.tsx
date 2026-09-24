'use client';

import { useEffect, useState } from 'react';
import type { WorkspaceSection } from '../nav';
import type { BotCatalogItem } from '@/lib/bots/types';
import { LivingParticleAgent } from '../LivingParticleAgent';
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

/** Prefer BotDefinition.visual.particleAgent; fall back to living-particle alias map. */
function particleAgentFor(bot: BotCatalogItem): string {
  const fromBot = bot.visual?.particleAgent?.trim();
  if (fromBot) return fromBot;
  return resolveAgentId(bot.slug) ?? bot.slug;
}

export function AgentsView({ onNavigate }: { onNavigate: (section: WorkspaceSection) => void }) {
  const [agents, setAgents] = useState<BotCatalogItem[]>(FALLBACK);
  const [selected, setSelected] = useState<string>('mian');

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

  const active = agents.find((a) => a.slug === selected) ?? agents[0];
  const activeKey = active ? particleAgentFor(active) : 'manager';

  return (
    <div className="view-shell">
      <div className="view-header">
        <h1>Agents</h1>
        <p>Living particle agents. Select to inspect symbolic form.</p>
      </div>

      {active ? (
        <div className="agent-living-stage" aria-live="polite">
          <LivingParticleAgent
            key={active.slug}
            agent={activeKey}
            size={300}
            entranceRoar={activeKey === 'manager'}
            metal={activeKey === 'manager' ? 'gold' : 'silver'}
            maxParticles={42000}
            label={`HARVYX ${activeKey}`}
          />
          <div className="agent-living-meta">
            <span className="agent-living-name">{active.name}</span>
            <span className="agent-living-role">{active.role}</span>
            <span className="agent-living-desc">{active.description}</span>
          </div>
        </div>
      ) : null}

      <div className="agent-roster">
        {agents.map((a) => {
          const isOn = a.slug === selected;
          const glyph = particleAgentFor(a).slice(0, 1).toUpperCase();
          return (
            <button
              key={a.slug}
              type="button"
              className={`agent-sign agent-sign-${a.slug}${isOn ? ' is-selected' : ''}`}
              onClick={() => setSelected(a.slug)}
              onDoubleClick={() => onNavigate('chat')}
              aria-pressed={isOn}
            >
              <span className="agent-sign-totem agent-sign-glyph" aria-hidden>
                {glyph}
              </span>
              <span className="agent-sign-copy">
                <span className="agent-sign-name">{a.name}</span>
                <span className="agent-sign-role">{a.role}</span>
                <span className="agent-sign-desc">{a.description}</span>
              </span>
              <span className="agent-sign-status">{isOn ? 'Viewing' : 'Active'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
