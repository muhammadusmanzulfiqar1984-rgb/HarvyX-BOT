'use client';

import { ControlCenterLayout } from '@/components/control/ControlCenterLayout';
import { ComingSoonPanel } from '@/components/control/ControlCenterCard';

export function WorkflowsView() {
  return (
    <ControlCenterLayout eyebrow="Control Center" title="Workflows">
      <ComingSoonPanel
        title="Multi-step missions are planned"
        description="Today MIAN routes each message to one specialist per step. Saved, multi-step workflows (Mission Control) are Phase 4 on the roadmap."
      />
    </ControlCenterLayout>
  );
}
