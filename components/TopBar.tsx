'use client';

import { NAV_TITLES, type NavSection } from './nav';
import { MenuIcon } from './icons';
import { AgentAvatar } from './AgentAvatar';
import { AGENT_IDENTITIES, type AgentUxState } from '@/lib/agent-avatar/identity';

export function TopBar({
  section,
  onOpenSidebar,
  modelLabel = 'HARVYX Manager',
  status = 'Ready',
  busy,
  rosterStates,
}: {
  section: NavSection;
  onOpenSidebar: () => void;
  modelLabel?: string;
  status?: string;
  busy?: boolean;
  /** Optional live roster states from chat / team (real runtime only). */
  rosterStates?: Partial<Record<string, AgentUxState>>;
}) {
  const workspace = NAV_TITLES[section] === 'Chat' ? 'Manager' : NAV_TITLES[section];
  const showRoster = section === 'chat' || section === 'team' || section === 'agents';

  return (
    <header className="top-bar hx-topbar">
      <button type="button" className="top-bar-menu" onClick={onOpenSidebar} aria-label="Open sidebar">
        <MenuIcon size={18} />
      </button>
      <div className="hx-topbar-brand">
        <AgentAvatar
          agent="mian"
          state={busy ? (rosterStates?.mian ?? 'thinking') : (rosterStates?.mian ?? 'idle')}
          size={26}
          className="hx-agent-avatar--topbar-mark"
        />
        <span className="hx-topbar-name">HARVYX</span>
        <span className="hx-topbar-sep" aria-hidden>
          /
        </span>
        <span className="hx-topbar-workspace">{workspace}</span>
      </div>

      {showRoster ? (
        <div className="hx-topbar-roster" aria-label="Agent animal roster">
          {AGENT_IDENTITIES.map((id) => {
            const state = rosterStates?.[id.slug] ?? (busy && id.slug === 'mian' ? 'thinking' : 'idle');
            return (
              <AgentAvatar
                key={id.slug}
                agent={id.slug}
                state={state}
                size={22}
                className="hx-agent-avatar--topbar"
                label={`${id.label} · ${id.animal}`}
              />
            );
          })}
        </div>
      ) : null}

      <div className="hx-topbar-meta">
        <span className="hx-topbar-model">{modelLabel}</span>
        <span className={`hx-topbar-status${busy ? ' is-busy' : ''}`}>{busy ? 'Thinking' : status}</span>
      </div>
    </header>
  );
}
