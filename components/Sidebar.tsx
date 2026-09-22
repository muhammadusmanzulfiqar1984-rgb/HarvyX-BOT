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
        <div className="sidebar-wordmark">
          <span className="sidebar-wordmark-harvyx">HARVYX</span>
          <span className="sidebar-wordmark-bot">BOT</span>
        </div>
        <div className="sidebar-subtitle">Autonomous Intelligence System</div>
        <button className="hamburger-btn" onClick={onToggle} aria-label="Toggle sidebar">✕</button>
      </div>

      <nav className="nav-list">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${activeSection === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-divider" />

      <button className="new-chat-btn" onClick={onNewChat}>
        + Initiate Session
      </button>

      <div className="conversation-list">
        <div className="conversation-list-label">Recent</div>
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`conversation-item ${activeSection === 'chat' && c.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <div className="conversation-item-title">{c.title}</div>
          </div>
        ))}
      </div>

      <div className="sidebar-user">
        <div className="sidebar-avatar">MU</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">Mian Muhammad Usman</div>
          <div className="sidebar-user-status">
            <span className="status-dot-online" />
            <span className="sidebar-user-status-label">Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
