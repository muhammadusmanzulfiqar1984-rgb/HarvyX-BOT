'use client';

import { useEffect, useState } from 'react';
import type { NavSection } from '../nav';
import type { BotCatalogItem } from '@/lib/bots/types';
import { HorseRunningIcon, LionRoaringIcon } from '../AgentTotems';

const FALLBACK: BotCatalogItem[] = [
  {
    id: 'mian',
    slug: 'mian',
    name: 'HarvYX Bot',
    role: 'Manager',
    kind: 'orchestrator',
    description:
      'The only agent the user talks to directly. Answers strategic and simple questions itself, and delegates operational or analytical work to OPS and Analyst.',
    status: 'active',
    tags: ['Orchestration', 'Direct response'],
    modelTier: 'fast',
    toolPack: 'delegate',
  },
  {
    id: 'ops',
    slug: 'ops',
    name: 'OPS',
    role: 'Operations',
    kind: 'specialist',
    description:
      'Reads and writes HarvYX lead and campaign data — pipeline stats, campaign performance, lead search, adding contacts, creating campaigns.',
    status: 'active',
    tags: ['HarvYX', 'Leads', 'Campaigns'],
    modelTier: 'fast',
    toolPack: 'harvyx',
  },
  {
    id: 'analyst',
    slug: 'analyst',
    name: 'Analyst',
    role: 'Reasoning',
    kind: 'specialist',
    description: 'Deep reasoning, drafting, and research synthesis on tasks delegated by HarvYX Bot.',
    status: 'active',
    tags: ['Reasoning', 'Drafting', 'Research'],
    modelTier: 'reasoning',
    toolPack: 'none',
  },
  {
    id: 'social',
    slug: 'social',
    name: 'Social',
    role: 'Social Media',
    kind: 'specialist',
    description:
      'Platform-accurate social media strategy and critique across LinkedIn, Instagram, X, Facebook, TikTok, and WhatsApp — real mechanics, not generic advice.',
    status: 'active',
    tags: ['Social Media', 'Strategy', 'Content'],
    modelTier: 'reasoning',
    toolPack: 'none',
  },
  {
    id: 'scrape',
    slug: 'scrape',
    name: 'Scrape',
    role: 'Web Research',
    kind: 'specialist',
    description:
      'Fetches and extracts public web pages — company/lead enrichment, competitor/market research, general URL lookup. SSRF-guarded, robots.txt-respecting, no JS rendering.',
    status: 'active',
    tags: ['Web', 'Research', 'Enrichment'],
    modelTier: 'fast',
    toolPack: 'scrape',
  },
];

function TotemForSlug({ slug }: { slug: string }) {
  if (slug === 'ops' || slug === 'scrape') {
    return (
      <span className={`agent-card-totem ${slug === 'ops' ? 'ops' : 'scrape'}`} aria-hidden>
        <HorseRunningIcon active />
      </span>
    );
  }
  if (slug === 'analyst' || slug === 'social') {
    return (
      <span className={`agent-card-totem ${slug === 'analyst' ? 'analyst' : 'social'}`} aria-hidden>
        <LionRoaringIcon active />
      </span>
    );
  }
  return null;
}

export function AgentsView({ onNavigate }: { onNavigate: (section: NavSection) => void }) {
  const [agents, setAgents] = useState<BotCatalogItem[]>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/bots')
      .then((r) => r.json() as Promise<{ installed?: BotCatalogItem[] }>)
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.installed) && data.installed.length > 0) {
          setAgents(data.installed);
        }
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="view-shell">
      <div className="view-header">
        <h1>Agents</h1>
        <p>
          OPS &amp; Scrape = running horse · Analyst &amp; Social = roaring lion. Full thinking motion
          appears in Chat when they work.
        </p>
      </div>
      <div className="agent-grid">
        {agents.map((a) => (
          <div key={a.slug} className="card agent-card">
            <div className="card-eyebrow">{a.role}</div>
            <TotemForSlug slug={a.slug} />
            <h3>{a.name}</h3>
            <p>{a.description}</p>
            <div className="tag-row">
              {a.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
            <button className="btn-secondary" onClick={() => onNavigate('chat')}>
              Open in Chat
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
