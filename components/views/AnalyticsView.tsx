'use client';

import { parseJson } from '@/lib/client-api';
import { useEffect, useState } from 'react';

type AnalyticsSummary = {
  eventsByKind: Record<string, number>;
  totalEvents: number;
  conversations: number;
  archivedConversations: number;
  messages: number;
  projects: number;
  knowledgeDocs: number;
  automations: number;
  automationRuns: number;
  notificationsUnread: number;
  tokens: null;
  costs: null;
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="shell-stat card">
      <div className="card-eyebrow">{label}</div>
      <div className="shell-stat-value">{value}</div>
    </div>
  );
}

export function AnalyticsView() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/analytics/summary')
      .then(async (res) => {
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || 'Failed to load analytics.');
        if (!cancelled) setSummary(data.summary ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load analytics.');
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="view-shell shell-view">
      <div className="view-header">
        <h1>Analytics</h1>
        <p>Counts from stored records only. Token and cost telemetry is not collected.</p>
      </div>

      {error ? <p className="shell-error" role="alert">{error}</p> : null}
      {loading ? <p className="shell-muted">Loading…</p> : null}

      {summary ? (
        <>
          <div className="shell-stat-grid">
            <Stat label="Conversations" value={summary.conversations} />
            <Stat label="Archived" value={summary.archivedConversations} />
            <Stat label="Messages" value={summary.messages} />
            <Stat label="Projects" value={summary.projects} />
            <Stat label="Knowledge docs" value={summary.knowledgeDocs} />
            <Stat label="Automations" value={summary.automations} />
            <Stat label="Automation runs" value={summary.automationRuns} />
            <Stat label="Unread notifications" value={summary.notificationsUnread} />
            <Stat label="Total events" value={summary.totalEvents} />
            <Stat label="Tokens" value="N/A" />
            <Stat label="Costs" value="N/A" />
          </div>

          <section className="shell-section">
            <h2>Events by kind</h2>
            {Object.keys(summary.eventsByKind).length === 0 ? (
              <p className="shell-muted">No analytics events recorded yet.</p>
            ) : (
              <ul className="shell-kv-list">
                {Object.entries(summary.eventsByKind).map(([kind, count]) => (
                  <li key={kind}>
                    <span>{kind}</span>
                    <span>{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
