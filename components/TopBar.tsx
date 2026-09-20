'use client';

import { NAV_TITLES, type NavSection } from './nav';
import { MenuIcon } from './icons';

export function TopBar({
  section,
  onOpenSidebar,
}: {
  section: NavSection;
  onOpenSidebar: () => void;
}) {
  return (
    <div className="top-bar">
      <button className="hamburger-btn top-bar-menu" onClick={onOpenSidebar} aria-label="Open sidebar">
        <MenuIcon size={20} />
      </button>
      <span className="top-bar-title">{NAV_TITLES[section]}</span>
    </div>
  );
}
