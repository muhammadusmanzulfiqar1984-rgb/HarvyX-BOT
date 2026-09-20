'use client';

import { NAV_ITEMS, type NavSection } from './nav';

export interface ConversationSummary {
  id: string;
  title: string;
}

export function Sidebar({
  conversations,
  activeId,
  activeSection,
  open,
  onSelect,
  onNewChat,
  onToggle,
  onNavigate,
}: {
  conversations: ConversationSummary[];
  activeId: string;
  activeSection: NavSection;
  open: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onToggle: () => void;
  onNavigate: (section: NavSection) => void;
}) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-title">
          HARVY<span className="sidebar-title-accent">X</span> BOT
        </span>
        <button className="hamburger-btn" onClick={onToggle} aria-label="Toggle sidebar">
          ✕
        </button>
      </div>

      <nav className="nav-list">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${activeSection === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-divider" />

      <button className="new-chat-btn" onClick={onNewChat}>
        + New chat
      </button>

      <div className="conversation-list">
        <div className="conversation-list-label">Recent</div>
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`conversation-item ${activeSection === 'chat' && c.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            {c.title}
          </div>
        ))}
      </div>
    </aside>
  );
}
