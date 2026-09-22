'use client';

import { NAV_TITLES, type NavSection } from './nav';
import { MenuIcon } from './icons';

const AGENT_DOTS = [
  { label: 'MIAN', color: '#C9A227' },
  { label: 'OPS',  color: '#4A9EFF' },
  { label: 'ANALYST', color: '#9B59B6' },
  { label: 'SOCIAL', color: '#2ED9C3' },
  { label: 'SCRAPE', color: '#E08A3C' },
];

export function TopBar({
  section,
  onOpenSidebar,
}: {
  section: NavSection;
  onOpenSidebar: () => void;
}) {
  const title = NAV_TITLES[section] === 'Chat' ? 'Live Chat' : NAV_TITLES[section];

  return (
    <div className="top-bar">
      <button className="top-bar-menu" onClick={onOpenSidebar} aria-label="Open sidebar">
        <MenuIcon size={18} />
      </button>

      <span className="top-bar-left">{title}</span>

      <div className="top-bar-agents">
        {AGENT_DOTS.map(({ label, color }) => (
          <div key={label} className="agent-indicator">
            <span className="agent-indicator-dot" style={{ background: color }} />
            <span className="agent-indicator-label">{label}</span>
          </div>
        ))}
      </div>

      <span className="top-bar-right">Groq · GPT-OSS-120B</span>
    </div>
  );
}
