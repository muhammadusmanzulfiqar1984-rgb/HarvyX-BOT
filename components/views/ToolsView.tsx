'use client';

import { parseJson } from '@/lib/client-api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PLUGINS } from '@/lib/control/catalog';
import { TOOL_CLASSES } from '@/lib/policy/classes';
import { ControlCenterLayout } from '@/components/control/ControlCenterLayout';
import { ControlCenterCard } from '@/components/control/ControlCenterCard';
import { StatusBadge } from '@/components/control/StatusBadge';

type ToolSettingRow = {
  id: string;
  name: string;
  enabled: boolean;
  source: string;
  config: unknown;
};

type DisplayTool = {
  id: string;
  label: string;
  plugin: string;
  pluginId: string;
  note?: string;
  enabled: boolean;
  requiresApproval: boolean;
  approvalNote?: string;
};

export function ToolsView() {
  const [settings, setSettings] = useState<ToolSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/tools/settings');
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to load tool settings.');
      setSettings(Array.isArray(data.tools) ? data.tools : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tool settings.');
      setSettings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const t of settings) m.set(t.id, t.enabled);
    return m;
  }, [settings]);

  const tools: DisplayTool[] = useMemo(() => {
    const fromPlugins = PLUGINS.flatMap((p) =>
      p.capabilities
        .filter((c) => c.available)
        .map((c) => {
          const cls = TOOL_CLASSES[c.id];
          return {
            id: c.id,
            label: c.label,
            plugin: p.name,
            pluginId: p.id,
            note: c.note,
            enabled: enabledMap.has(c.id) ? Boolean(enabledMap.get(c.id)) : true,
            requiresApproval: Boolean(cls?.requiresApproval),
            approvalNote: cls?.note,
          };
        }),
    );

    // Include policy tools not listed as plugin capabilities
    const seen = new Set(fromPlugins.map((t) => t.id));
    for (const [id, cls] of Object.entries(TOOL_CLASSES)) {
      if (seen.has(id)) continue;
      fromPlugins.push({
        id,
        label: id,
        plugin: 'Policy registry',
        pluginId: 'policy',
        note: cls.note,
        enabled: enabledMap.has(id) ? Boolean(enabledMap.get(id)) : true,
        requiresApproval: cls.requiresApproval,
        approvalNote: cls.note,
      });
    }
    return fromPlugins;
  }, [enabledMap]);

  async function toggle(id: string, enabled: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch('/api/tools/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to save.');
      if (Array.isArray(data.tools)) setSettings(data.tools);
      else await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ControlCenterLayout
      eyebrow="Workspace"
      title="Tools"
      subtitle="Enable or disable executable capabilities. Approval requirements come from the policy classification map — enforcement may still be pending for some send-class tools."
    >
      {error ? <p className="shell-error" role="alert">{error}</p> : null}
      {loading ? <p className="shell-muted">Loading tool settings…</p> : null}

      <div className="cc-grid">
        {tools.map((tool) => (
          <ControlCenterCard
            key={`${tool.pluginId}-${tool.id}`}
            title={tool.label}
            meta={`Plugin · ${tool.plugin}`}
            status={
              tool.enabled ? (
                <StatusBadge tone="ok">Enabled</StatusBadge>
              ) : (
                <StatusBadge tone="muted">Disabled</StatusBadge>
              )
            }
          >
            <dl className="cc-dl">
              <div>
                <dt>Tool id</dt>
                <dd>{tool.id}</dd>
              </div>
              <div>
                <dt>Approval</dt>
                <dd>
                  {tool.requiresApproval ? 'Required (policy)' : 'Not required'}
                  {tool.approvalNote ? (
                    <div className="shell-muted" style={{ marginTop: 4, fontSize: 11 }}>
                      {tool.approvalNote}
                    </div>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Permissions</dt>
                <dd>{tool.note ?? 'As configured server-side'}</dd>
              </div>
            </dl>
            <div className="shell-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className={tool.enabled ? 'btn-secondary' : 'btn-primary'}
                disabled={busyId === tool.id}
                onClick={() => toggle(tool.id, !tool.enabled)}
              >
                {tool.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </ControlCenterCard>
        ))}
      </div>
      <p className="cc-footnote">
        Settings persist in D1 when available. No fake execution history.
      </p>
    </ControlCenterLayout>
  );
}
