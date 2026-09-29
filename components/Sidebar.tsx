'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NAV_GROUPS, WORKSPACE_SECTIONS, type NavSection, type WorkspaceSection } from './nav';
import { GodfatherMark } from './GodfatherMark';

export interface ConversationSummary {
  id: string;
  title: string;
  pinned?: boolean | number;
  archived?: boolean | number;
}

export function Sidebar({
  conversations,
  activeId,
  activeSection,
  open,
  waiting,
  onSelect,
  onNewChat,
  onToggle,
  onNavigate,
  onClose,
  onRenameConversation,
  onPinConversation,
  onArchiveConversation,
  onSignOut,
}: {
  conversations: ConversationSummary[];
  activeId: string;
  activeSection: NavSection;
  open: boolean;
  waiting?: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onToggle: () => void;
  onNavigate: (section: WorkspaceSection) => void;
  onClose?: () => void;
  onRenameConversation?: (id: string, title: string) => void;
  onPinConversation?: (id: string, pinned: boolean) => void;
  onArchiveConversation?: (id: string) => void;
  onSignOut?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const onControlRoute = pathname.startsWith('/control');
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    function onDoc(e: MouseEvent) {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [accountOpen]);

  function close() {
    onClose?.();
    setAccountOpen(false);
    setMenuId(null);
  }

  function handleItem(id: NavSection, href?: string) {
    if (href) {
      router.push(href);
      close();
      return;
    }
    if (WORKSPACE_SECTIONS.has(id)) {
      if (onControlRoute) {
        router.push(`/?section=${id}`);
        close();
        return;
      }
      onNavigate(id as WorkspaceSection);
    }
  }

  const pinned = conversations.filter((c) => Boolean(c.pinned));
  const recent = conversations.filter((c) => !c.pinned);

  function renderConversation(c: ConversationSummary) {
    const isPinned = Boolean(c.pinned);
    const isMenu = menuId === c.id;
    return (
      <div
        key={c.id}
        className={`conversation-item-wrap${activeSection === 'chat' && c.id === activeId ? ' is-active' : ''}`}
      >
        <button
          type="button"
          className={`conversation-item ${activeSection === 'chat' && c.id === activeId ? 'active' : ''}`}
          onClick={() => {
            onSelect(c.id);
            setMenuId(null);
          }}
        >
          <div className="conversation-item-title">
            {isPinned ? <span className="conversation-pin" aria-hidden>📌 </span> : null}
            {c.title}
          </div>
        </button>
        <button
          type="button"
          className="conversation-menu-btn"
          aria-label="Conversation actions"
          onClick={(e) => {
            e.stopPropagation();
            setMenuId(isMenu ? null : c.id);
          }}
        >
          ···
        </button>
        {isMenu ? (
          <div className="conversation-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const next = window.prompt('Rename conversation', c.title);
                if (next?.trim()) onRenameConversation?.(c.id, next.trim());
                setMenuId(null);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onPinConversation?.(c.id, !isPinned);
                setMenuId(null);
              }}
            >
              {isPinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onArchiveConversation?.(c.id);
                setMenuId(null);
              }}
            >
              Archive
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-wordmark">
          <span className="sidebar-wordmark-harvyx">HARVYX</span>
          <span className="sidebar-wordmark-bot">BOT</span>
        </div>
        <div className="sidebar-subtitle">Command system</div>
        <button type="button" className="hamburger-btn" onClick={onToggle} aria-label="Toggle sidebar">
          ✕
        </button>
      </div>

      <button type="button" className="new-chat-btn" onClick={onNewChat}>
        New Chat
      </button>

      <nav className="nav-list nav-list-grouped" aria-label="Primary">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className={`nav-group nav-group-${group.tone ?? 'workspace'}`}>
            <div className="nav-group-label">{group.label}</div>
            <div className="nav-group-items">
              {group.items.map(({ id, label, icon: Icon, href }) => {
                const active = activeSection === id;
                const className = `nav-item ${active ? 'active' : ''}${
                  group.tone === 'control' ? ' nav-item-control' : ''
                }`;
                if (href) {
                  return (
                    <Link key={id} href={href} className={className} onClick={() => close()}>
                      <Icon size={15} />
                      <span>{label}</span>
                    </Link>
                  );
                }
                return (
                  <button
                    key={id}
                    type="button"
                    className={className}
                    onClick={() => handleItem(id, href)}
                  >
                    <Icon size={15} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-divider" />

      <div className="conversation-list">
        {pinned.length > 0 ? (
          <>
            <div className="conversation-list-label">Pinned</div>
            {pinned.map(renderConversation)}
          </>
        ) : null}
        <div className="conversation-list-label">Recent</div>
        {recent.map(renderConversation)}
      </div>

      <div className={`sidebar-account${accountOpen ? ' is-open' : ''}`} ref={accountRef}>
        <button
          type="button"
          className={`sidebar-operator${waiting ? ' is-waiting' : ''}`}
          onClick={() => setAccountOpen((v) => !v)}
          aria-expanded={accountOpen}
          aria-haspopup="menu"
        >
          <GodfatherMark waiting={Boolean(waiting)} />
          <div className="sidebar-operator-meta">
            <div className="sidebar-operator-label">{waiting ? 'Waiting…' : 'Operator'}</div>
            <div className="sidebar-user-status">
              <span className="status-dot-online" />
              <span className="sidebar-user-status-label">{waiting ? 'On hold' : 'Online'}</span>
            </div>
          </div>
        </button>
        {accountOpen ? (
          <div className="sidebar-account-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onNavigate('profile');
                close();
              }}
            >
              Profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onNavigate('settings');
                close();
              }}
            >
              Settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onNavigate('notifications');
                close();
              }}
            >
              Notifications
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onSignOut?.();
                setAccountOpen(false);
              }}
            >
              Sign Out
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
