import { ControlCenterLayout } from '@/components/control/ControlCenterLayout';
import { ControlCenterCard } from '@/components/control/ControlCenterCard';
import { StatusBadge } from '@/components/control/StatusBadge';

const LINKS = [
  {
    title: 'Harvics OS ERP',
    path: 'MIAN → delegateToErp → harvics.com /api/intelligence',
    detail: 'Live orders, inventory, finance, HR, logistics, procurement. Needs HARVICS_API_KEY = backend INTERNAL_API_KEY.',
  },
  {
    title: 'HARVYX CRM',
    path: 'MIAN → Ops agent → harvics.com HARVYX API',
    detail: 'Contacts, leads, enrichment. Needs HARVYX_API_KEY.',
  },
  {
    title: 'Google Workspace',
    path: 'MIAN → Gmail / Calendar connectors',
    detail: 'Needs an account linked under Connections.',
  },
];

/** Server component — static map of how the BRAIN (this bot) reaches the BODY (Harvics systems). */
export function EcosystemView() {
  return (
    <ControlCenterLayout
      eyebrow="Control Center"
      title="Ecosystem"
      subtitle="How HARVYX-BOT connects to Harvics systems."
    >
      <div className="cc-grid">
        {LINKS.map((l) => (
          <ControlCenterCard key={l.title} title={l.title} status={<StatusBadge tone="ok">Wired</StatusBadge>}>
            <div className="cc-eco-path">{l.path}</div>
            <p className="cc-eco-detail">{l.detail}</p>
          </ControlCenterCard>
        ))}
      </div>
      <p className="cc-footnote">"Wired" means the code path exists; it works once the listed key is set.</p>
    </ControlCenterLayout>
  );
}
