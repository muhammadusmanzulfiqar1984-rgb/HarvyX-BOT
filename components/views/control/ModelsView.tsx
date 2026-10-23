'use client';

import { CANONICAL_BOTS, PLANNED_BOTS } from '@/lib/bots/definitions';
import { ControlCenterLayout } from '@/components/control/ControlCenterLayout';
import { ControlCenterCard } from '@/components/control/ControlCenterCard';
import { StatusBadge } from '@/components/control/StatusBadge';

export function ModelsView() {
  const bots = [...CANONICAL_BOTS, ...PLANNED_BOTS];
  return (
    <ControlCenterLayout
      eyebrow="Control Center"
      title="Models"
      subtitle="Model policy per bot, from the canonical bot registry. Provider keys are configured server-side."
    >
      <div className="cc-grid">
        {bots.map((b) => (
          <ControlCenterCard
            key={b.slug}
            title={b.name}
            meta={b.role}
            status={
              b.status === 'active' ? (
                <StatusBadge tone="ok">Active</StatusBadge>
              ) : (
                <StatusBadge tone="planned">{b.status}</StatusBadge>
              )
            }
          >
            <dl className="cc-dl">
              <div>
                <dt>Tier</dt>
                <dd>{b.modelPolicy.tier}</dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{b.modelPolicy.provider ?? 'Router default'}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{b.modelPolicy.model ?? 'Router default'}</dd>
              </div>
            </dl>
          </ControlCenterCard>
        ))}
      </div>
    </ControlCenterLayout>
  );
}
