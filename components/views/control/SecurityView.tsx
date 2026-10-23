'use client';

import { TOOL_CLASSES } from '@/lib/policy/classes';
import { ControlCenterLayout } from '@/components/control/ControlCenterLayout';
import { ControlCenterCard } from '@/components/control/ControlCenterCard';
import { StatusBadge } from '@/components/control/StatusBadge';

const RULES = [
  'Outbound sends (email, SMS/WhatsApp, calendar invites) need explicit approval in your own latest message — "send it" alone is refused, "I approve" passes, any negation fails closed.',
  'At most one outbound send per user message, shared across every channel.',
  'Approval is checked against your real message, never against text the model wrote.',
  'Operator APIs (marketplace jobs) require a valid, unexpired operator session.',
];

export function SecurityView() {
  const entries = Object.entries(TOOL_CLASSES);
  return (
    <ControlCenterLayout
      eyebrow="Control Center"
      title="Security"
      subtitle="Policy enforced in code (lib/policy). This page reflects it; it does not change it."
    >
      <ControlCenterCard title="Enforced rules" status={<StatusBadge tone="ok">Active</StatusBadge>}>
        <ul className="cc-cap-list">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </ControlCenterCard>
      <div className="cc-grid" style={{ marginTop: 16 }}>
        {entries.map(([id, c]) => (
          <ControlCenterCard
            key={id}
            title={id}
            meta={`Class · ${c.cls}`}
            status={
              c.requiresApproval ? (
                <StatusBadge tone="warn">Approval required</StatusBadge>
              ) : (
                <StatusBadge tone="muted">No approval</StatusBadge>
              )
            }
          />
        ))}
      </div>
    </ControlCenterLayout>
  );
}
