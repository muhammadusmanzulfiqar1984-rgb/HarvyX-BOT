'use client';

import { useEffect, useState } from 'react';
import { parseJson } from '@/lib/client-api';
import { PLUGINS } from '@/lib/control/catalog';
import { ControlCenterLayout } from '@/components/control/ControlCenterLayout';
import { ControlCenterCard } from '@/components/control/ControlCenterCard';
import { StatusBadge } from '@/components/control/StatusBadge';

type ConnectorStatus = {
  connected: boolean;
  accountEmail?: string;
  connectedAt?: string;
};

const CONNECTORS = PLUGINS.filter((p) => p.kind === 'connector' && p.statusUrl);

export function ConnectionsView() {
  const [status, setStatus] = useState<Record<string, ConnectorStatus | 'error'>>({});

  useEffect(() => {
    for (const p of CONNECTORS) {
      fetch(p.statusUrl!)
        .then(async (res) => {
          const data = await parseJson(res);
          if (!res.ok) throw new Error();
          setStatus((s) => ({ ...s, [p.id]: data as ConnectorStatus }));
        })
        .catch(() => setStatus((s) => ({ ...s, [p.id]: 'error' })));
    }
  }, []);

  return (
    <ControlCenterLayout
      eyebrow="Control Center"
      title="Connections"
      subtitle="Accounts linked to HARVYX-BOT. Tokens stay in D1 and are never shown here."
    >
      <div className="cc-grid">
        {CONNECTORS.map((p) => {
          const s = status[p.id];
          const badge =
            s === undefined ? (
              <StatusBadge tone="muted">Checking…</StatusBadge>
            ) : s === 'error' ? (
              <StatusBadge tone="danger">Status unavailable</StatusBadge>
            ) : s.connected ? (
              <StatusBadge tone="ok">Connected</StatusBadge>
            ) : (
              <StatusBadge tone="warn">Not connected</StatusBadge>
            );
          const connectHref = p.statusUrl!.replace(/\/status$/, '/connect');
          return (
            <ControlCenterCard
              key={p.id}
              title={p.name}
              meta={p.description}
              status={badge}
              footer={
                s !== undefined && s !== 'error' && !s.connected ? (
                  <a className="btn-primary" href={connectHref}>
                    Connect
                  </a>
                ) : null
              }
            >
              {s !== undefined && s !== 'error' && s.connected ? (
                <dl className="cc-dl">
                  <div>
                    <dt>Account</dt>
                    <dd>{s.accountEmail}</dd>
                  </div>
                  {s.connectedAt ? (
                    <div>
                      <dt>Since</dt>
                      <dd>{s.connectedAt}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </ControlCenterCard>
          );
        })}
      </div>
    </ControlCenterLayout>
  );
}
