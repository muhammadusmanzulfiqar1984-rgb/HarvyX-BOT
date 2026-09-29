'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, type ConversationSummary } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { controlHrefToSection, type NavSection, type WorkspaceSection } from '@/components/nav';

const STORAGE_KEY = 'crew.conversations';

function loadConversations(): ConversationSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(list: ConversationSummary[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/** Shell for `/control/*` — reuses sidebar; does not own Chat. */
export function ControlAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeSection: NavSection = controlHrefToSection(pathname) ?? 'control';

  useEffect(() => {
    const existing = loadConversations();
    if (existing.length > 0) {
      setConversations(existing);
      setActiveId(existing[0].id);
    } else {
      const id = crypto.randomUUID();
      const initial = [{ id, title: 'New conversation' }];
      setConversations(initial);
      setActiveId(id);
      saveConversations(initial);
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open-lock', sidebarOpen);
    return () => document.body.classList.remove('sidebar-open-lock');
  }, [sidebarOpen]);

  function handleNewChat() {
    const id = crypto.randomUUID();
    const next = [{ id, title: 'New conversation' }, ...conversations];
    setConversations(next);
    setActiveId(id);
    saveConversations(next);
    setSidebarOpen(false);
    router.push('/?section=chat');
  }

  function handleSelect(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
    router.push('/?section=chat');
  }

  function handleNavigate(section: WorkspaceSection) {
    setSidebarOpen(false);
    router.push(section === 'chat' ? '/?section=chat' : `/?section=${section}`);
  }

  if (!activeId) return null;

  return (
    <div className="app-shell">
      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        activeSection={activeSection}
        open={sidebarOpen}
        onSelect={handleSelect}
        onNewChat={handleNewChat}
        onToggle={() => setSidebarOpen((v) => !v)}
        onClose={() => setSidebarOpen(false)}
        onNavigate={handleNavigate}
      />
      <div className="main-column">
        <TopBar section={activeSection} onOpenSidebar={() => setSidebarOpen(true)} status="Control" />
        {children}
      </div>
    </div>
  );
}
