'use client';

import { PLUGINS } from '@/lib/control/catalog';
import { TOOL_CLASSES } from '@/lib/policy/classes';
import { ControlCenterLayout } from '@/components/control/ControlCenterLayout';
import { ControlCenterCard } from '@/components/control/ControlCenterCard';
import { StatusBadge } from '@/components/control/StatusBadge';

export function PluginsView({ connectorsOnly = false }: { connectorsOnly?: boolean }) {
  const plugins = connectorsOnly ? PLUGINS.filter((p) => p.kind === 'connector') : PLUGINS;
  return (
    <ControlCenterLayout
      eyebrow="Control Center"
      title={connectorsOnly ? 'Integrations' : 'Plugins'}
      subtitle={
        connectorsOnly
          ? 'Integrations that act on an account you link under Connections.'
          : 'Every capability HARVYX-BOT can execute, with its approval rule.'
      }
    >
      <div className="cc-grid">
        {plugins.map((p) => (
          <ControlCenterCard
            key={p.id}
            title={p.name}
            meta={p.kind === 'connector' ? 'Connector · needs a linked account' : 'Built-in'}
            status={<StatusBadge tone="ok">{p.capabilities.length} capabilities</StatusBadge>}
          >
            <p className="cc-card-copy">{p.description}</p>
            <ul className="cc-cap-list">
              {p.capabilities.map((c) => (
                <li key={c.id}>
                  {c.label}
                  {TOOL_CLASSES[c.id]?.requiresApproval ? ' — approval required' : ''}
                  {c.note ? <div className="cc-cap-note">{c.note}</div> : null}
                </li>
              ))}
            </ul>
          </ControlCenterCard>
        ))}
      </div>
    </ControlCenterLayout>
  );
}
