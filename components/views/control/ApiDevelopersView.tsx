'use client';

import { ControlCenterLayout } from '@/components/control/ControlCenterLayout';
import { ControlCenterCard } from '@/components/control/ControlCenterCard';
import { StatusBadge } from '@/components/control/StatusBadge';

const ENDPOINTS: { path: string; methods: string; purpose: string; auth: 'public' | 'operator' }[] = [
  { path: '/api/chat', methods: 'POST', purpose: 'Talk to MIAN (streams the reply).', auth: 'public' },
  { path: '/api/bots', methods: 'GET', purpose: 'Bot registry.', auth: 'public' },
  { path: '/api/attachments', methods: 'POST', purpose: 'Generate PDF / Word / Excel / CSV / text exports.', auth: 'public' },
  { path: '/api/knowledge', methods: 'GET, POST', purpose: 'Knowledge base documents.', auth: 'public' },
  { path: '/api/research', methods: 'GET, POST', purpose: 'Research runs.', auth: 'public' },
  { path: '/api/connectors/{gmail|calendar}/status', methods: 'GET', purpose: 'Connector status.', auth: 'public' },
  { path: '/api/marketplace', methods: 'GET', purpose: 'Marketplace catalog.', auth: 'public' },
  { path: '/api/marketplace/jobs', methods: 'GET, POST', purpose: 'Run marketplace capabilities.', auth: 'operator' },
];

export function ApiDevelopersView() {
  return (
    <ControlCenterLayout
      eyebrow="Control Center"
      title="API & Developers"
      subtitle="HTTP endpoints served by this app."
    >
      <div className="cc-grid">
        {ENDPOINTS.map((e) => (
          <ControlCenterCard
            key={e.path}
            title={e.path}
            meta={e.methods}
            status={
              e.auth === 'operator' ? (
                <StatusBadge tone="warn">Operator session</StatusBadge>
              ) : (
                <StatusBadge tone="muted">No auth</StatusBadge>
              )
            }
          >
            <p className="cc-card-copy">{e.purpose}</p>
          </ControlCenterCard>
        ))}
      </div>
    </ControlCenterLayout>
  );
}
