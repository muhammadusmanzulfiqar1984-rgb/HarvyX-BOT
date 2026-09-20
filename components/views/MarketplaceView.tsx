'use client';

import { useEffect, useState } from 'react';
import type { BotCatalogItem } from '@/lib/bots/types';

const FALLBACK_INSTALLED: BotCatalogItem[] = [
  {
    id: 'mian',
    slug: 'mian',
    name: 'HarvYX Bot',
    role: 'Manager',
    kind: 'orchestrator',
    description: '',
    status: 'active',
    tags: [],
    modelTier: 'fast',
    toolPack: 'delegate',
  },
  {
    id: 'ops',
    slug: 'ops',
    name: 'OPS',
    role: 'Agent',
    kind: 'specialist',
    description: '',
    status: 'active',
    tags: [],
    modelTier: 'fast',
    toolPack: 'harvyx',
  },
  {
    id: 'analyst',
    slug: 'analyst',
    name: 'Analyst',
    role: 'Agent',
    kind: 'specialist',
    description: '',
    status: 'active',
    tags: [],
    modelTier: 'reasoning',
    toolPack: 'none',
  },
];

const FALLBACK_PLANNED: BotCatalogItem[] = [
  {
    id: 'code',
    slug: 'harvyx-code',
    name: 'HarvYX Code',
    role: 'Agent',
    kind: 'specialist',
    description: '',
    status: 'planned',
    tags: [],
    modelTier: 'code',
    toolPack: 'none',
  },
];

export function MarketplaceView() {
  const [installed, setInstalled] = useState<BotCatalogItem[]>(FALLBACK_INSTALLED);
  const [planned, setPlanned] = useState<BotCatalogItem[]>(FALLBACK_PLANNED);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/bots')
      .then(
        (r) =>
          r.json() as Promise<{ installed?: BotCatalogItem[]; planned?: BotCatalogItem[] }>,
      )
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.installed) && data.installed.length > 0) {
          setInstalled(data.installed);
        }
        if (Array.isArray(data?.planned) && data.planned.length > 0) {
          setPlanned(data.planned);
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
        <h1>Marketplace</h1>
        <p>Installed Bots from the registry, and what is planned next.</p>
      </div>

      <div className="marketplace-section-label">Installed</div>
      <div className="agent-grid">
        {installed.map((a) => (
          <div key={a.slug} className="card marketplace-card">
            <div className="card-eyebrow">{a.role}</div>
            <h3>{a.name}</h3>
            <span className="badge badge-active">{a.status === 'active' ? 'Active' : a.status}</span>
          </div>
        ))}
      </div>

      <div className="marketplace-section-label">Planned</div>
      <div className="agent-grid">
        {planned.map((a) => (
          <div key={a.slug} className="card marketplace-card marketplace-card-future">
            <div className="card-eyebrow">{a.role}</div>
            <h3>{a.name}</h3>
            <span className="badge badge-planned">Planned</span>
          </div>
        ))}
      </div>
    </div>
  );
}
