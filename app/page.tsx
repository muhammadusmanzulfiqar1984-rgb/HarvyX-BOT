'use client';

import { useEffect, useState } from 'react';
import { Sidebar, type ConversationSummary } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { Chat } from '@/components/Chat';
import { HomeView } from '@/components/views/HomeView';
import { AgentsView } from '@/components/views/AgentsView';
import { MarketplaceView } from '@/components/views/MarketplaceView';
import { SettingsView } from '@/components/views/SettingsView';
import { PlaceholderView } from '@/components/views/PlaceholderView';
import type { NavSection } from '@/components/nav';

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
    // localStorage unavailable — conversation list just won't persist across reloads
  }
}

export default function HomePage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [section, setSection] = useState<NavSection>('home');

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

  function handleNewChat() {
    const id = crypto.randomUUID();
    const next = [{ id, title: 'New conversation' }, ...conversations];
    setConversations(next);
    setActiveId(id);
    saveConversations(next);
    setSection('chat');
    setSidebarOpen(false);
  }

  function handleSelect(id: string) {
    setActiveId(id);
    setSection('chat');
    setSidebarOpen(false);
  }

  function handleNavigate(next: NavSection) {
    setSection(next);
    setSidebarOpen(false);
  }

  if (!activeId) return null;

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        activeSection={section}
        open={sidebarOpen}
        onSelect={handleSelect}
        onNewChat={handleNewChat}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNavigate={handleNavigate}
      />

      <div className="main-column">
        <TopBar section={section} onOpenSidebar={() => setSidebarOpen(true)} />

        {section === 'chat' && <Chat key={activeId} conversationId={activeId} />}
        {section === 'home' && <HomeView onNavigate={handleNavigate} />}
        {section === 'agents' && <AgentsView onNavigate={handleNavigate} />}
        {section === 'marketplace' && <MarketplaceView />}
        {section === 'settings' && <SettingsView />}
        {section === 'projects' && (
          <PlaceholderView title="Projects" description="Group conversations and work into projects. Coming soon." />
        )}
        {section === 'knowledge' && (
          <PlaceholderView title="Knowledge" description="Give HarvYX Bot durable reference material. Coming soon." />
        )}
        {section === 'tools' && (
          <PlaceholderView title="Tools" description="Manage the tools available to OPS and Analyst. Coming soon." />
        )}
        {section === 'automations' && (
          <PlaceholderView title="Automations" description="Trigger agent work on a schedule or event. Coming soon." />
        )}
        {section === 'analytics' && (
          <PlaceholderView title="Analytics" description="Usage and performance across agents. Coming soon." />
        )}
      </div>
    </div>
  );
}
