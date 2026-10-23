'use client';

import Link from 'next/link';
import { ControlCenterLayout } from '@/components/control/ControlCenterLayout';
import { ControlCenterCard } from '@/components/control/ControlCenterCard';
import { StatusBadge } from '@/components/control/StatusBadge';

type Section = {
  href: string;
  title: string;
  copy: string;
  state: 'live' | 'planned';
};

const SECTIONS: Section[] = [
  { href: '/control/models', title: 'Models', copy: 'Which model tier each bot runs on.', state: 'live' },
  { href: '/control/connections', title: 'Connections', copy: 'Gmail and Calendar account status.', state: 'live' },
  { href: '/control/integrations', title: 'Integrations', copy: 'Connector plugins that need a linked account.', state: 'live' },
  { href: '/control/plugins', title: 'Plugins', copy: 'Every capability HARVYX-BOT can execute.', state: 'live' },
  { href: '/control/security', title: 'Security', copy: 'Approval rules for outbound actions.', state: 'live' },
  { href: '/control/ecosystem', title: 'Ecosystem', copy: 'How the bot connects to Harvics OS.', state: 'live' },
  { href: '/control/api', title: 'API & Developers', copy: 'HTTP endpoints this app exposes.', state: 'live' },
  { href: '/control/logs', title: 'Logs & Activity', copy: 'Execution history.', state: 'planned' },
  { href: '/control/workflows', title: 'Workflows', copy: 'Multi-step missions.', state: 'planned' },
];

export function ControlOverviewView() {
  return (
    <ControlCenterLayout
      eyebrow="Control Center"
      title="Overview"
      subtitle="Configuration and status for HARVYX-BOT."
    >
      <div className="cc-grid">
        {SECTIONS.map((s) => (
          <ControlCenterCard
            key={s.href}
            title={s.title}
            status={
              s.state === 'live' ? (
                <StatusBadge tone="ok">Live</StatusBadge>
              ) : (
                <StatusBadge tone="planned">Planned</StatusBadge>
              )
            }
            footer={<Link href={s.href}>Open</Link>}
          >
            <p className="cc-card-copy">{s.copy}</p>
          </ControlCenterCard>
        ))}
      </div>
    </ControlCenterLayout>
  );
}
