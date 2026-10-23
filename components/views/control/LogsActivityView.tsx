'use client';

import { ControlCenterLayout } from '@/components/control/ControlCenterLayout';
import { ComingSoonPanel } from '@/components/control/ControlCenterCard';

export function LogsActivityView() {
  return (
    <ControlCenterLayout eyebrow="Control Center" title="Logs & Activity">
      <ComingSoonPanel
        title="Execution history is not wired yet"
        description="Bot runs are logged server-side today (Cloudflare observability). A browsable history needs an activity API backed by the analytics_events table — no fake history is shown until then."
      />
    </ControlCenterLayout>
  );
}
