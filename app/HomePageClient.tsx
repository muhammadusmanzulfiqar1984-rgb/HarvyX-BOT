'use client';

import { parseJson } from '@/lib/client-api';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar, type ConversationSummary } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { Chat } from '@/components/Chat';
import { TeamChat } from '@/components/TeamChat';
import { HomeView } from '@/components/views/HomeView';
import { AgentsView } from '@/components/views/AgentsView';
import { BotFactoryView } from '@/components/views/BotFactoryView';
import { MissionControlView } from '@/components/views/MissionControlView';
import { MarketplaceView } from '@/components/views/MarketplaceView';
import { SettingsView } from '@/components/views/SettingsView';
import { ToolsView } from '@/components/views/ToolsView';
import { ProjectsView } from '@/components/views/ProjectsView';
import { KnowledgeView } from '@/components/views/KnowledgeView';
import { ResearchView } from '@/components/views/ResearchView';
import { AutomationsView } from '@/components/views/AutomationsView';
import { AnalyticsView } from '@/components/views/AnalyticsView';
import { ProfileView } from '@/components/views/ProfileView';
import { NotificationsView } from '@/components/views/NotificationsView';
import { CommandPalette, type CommandActionId } from '@/components/CommandPalette';
import type { SearchHit } from '@/components/GlobalSearch';
import { WORKSPACE_SECTIONS, type WorkspaceSection } from '@/components/nav';
import type { AgentUxState } from '@/lib/agent-avatar/identity';

const STORAGE_KEY = 'crew.conversations';

function loadLocalConversations(): ConversationSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalConversations(list: ConversationSummary[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage unavailable
  }
}

function parseSection(raw: string | null): WorkspaceSection {
  if (raw && WORKSPACE_SECTIONS.has(raw)) return raw as WorkspaceSection;
  return 'chat';
}

function normalizeConversation(raw: {
  id: string;
  title?: string;
  pinned?: boolean | number;
  archived?: boolean | number;
}): ConversationSummary {
  return {
    id: raw.id,
    title: raw.title || 'New conversation',
    pinned: Boolean(raw.pinned),
    archived: Boolean(raw.archived),
  };
}

export default function HomePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [section, setSection] = useState<WorkspaceSection>('chat');
  const [chatBusy, setChatBusy] = useState(false);
  const [rosterStates, setRosterStates] = useState<Partial<Record<string, AgentUxState>>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);

  const persist = useCallback((list: ConversationSummary[]) => {
    setConversations(list);
    saveLocalConversations(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/conversations');
        if (res.ok) {
          const data = await parseJson(res);
          const list = Array.isArray(data.conversations)
            ? data.conversations.map(normalizeConversation)
            : [];
          if (!cancelled && list.length > 0) {
            persist(list);
            setActiveId(list[0].id);
            return;
          }
        }
      } catch {
        /* fall through to local */
      }

      if (cancelled) return;
      const existing = loadLocalConversations();
      if (existing.length > 0) {
        setConversations(existing);
        setActiveId(existing[0].id);
      } else {
        const id = crypto.randomUUID();
        const initial = [{ id, title: 'New conversation', pinned: false }];
        persist(initial);
        setActiveId(id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persist]);

  useEffect(() => {
    setSection(parseSection(searchParams.get('section')));
  }, [searchParams]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open-lock', sidebarOpen);
    return () => document.body.classList.remove('sidebar-open-lock');
  }, [sidebarOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleNavigate(next: WorkspaceSection) {
    setSection(next);
    setSidebarOpen(false);
    if (next !== 'chat' && next !== 'team') {
      setChatBusy(false);
      setRosterStates({});
    }
    router.replace(next === 'chat' ? '/?section=chat' : `/?section=${next}`, { scroll: false });
  }

  async function handleNewChat() {
    let id = crypto.randomUUID();
    let title = 'New conversation';

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const data = await parseJson(res);
        if (data?.conversation?.id) {
          id = data.conversation.id;
          title = data.conversation.title || title;
        }
      }
    } catch {
      /* local fallback */
    }

    const next = [{ id, title, pinned: false }, ...conversations.filter((c) => c.id !== id)];
    persist(next);
    setActiveId(id);
    handleNavigate('chat');
  }

  function handleSelect(id: string) {
    setActiveId(id);
    handleNavigate('chat');
  }

  async function handleRename(id: string, title: string) {
    persist(conversations.map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
    } catch {
      /* local already updated */
    }
  }

  async function handlePin(id: string, pinned: boolean) {
    const next = conversations
      .map((c) => (c.id === id ? { ...c, pinned } : c))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
    persist(next);
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
      });
    } catch {
      /* local already updated */
    }
  }

  async function handleArchive(id: string) {
    const remaining = conversations.filter((c) => c.id !== id);
    persist(remaining);
    if (activeId === id) {
      if (remaining[0]) setActiveId(remaining[0].id);
      else void handleNewChat();
    }
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
    } catch {
      /* local already updated */
    }
  }

  async function handleSignOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    handleNavigate('profile');
  }

  function handlePaletteAction(id: CommandActionId, hit?: SearchHit) {
    switch (id) {
      case 'new-chat':
        void handleNewChat();
        break;
      case 'open-team':
        handleNavigate('team');
        break;
      case 'new-project':
        handleNavigate('projects');
        break;
      case 'new-automation':
        handleNavigate('automations');
        break;
      case 'upload-knowledge':
        handleNavigate('knowledge');
        break;
      case 'settings':
        handleNavigate('settings');
        break;
      case 'connections':
        router.push('/control/connections');
        break;
      case 'plugins':
        router.push('/control/plugins');
        break;
      case 'sign-out':
        void handleSignOut();
        break;
      case 'search':
        if (hit) {
          if (hit.type === 'conversation') {
            setActiveId(hit.id);
            handleNavigate('chat');
          } else if (hit.type === 'project') handleNavigate('projects');
          else if (hit.type === 'knowledge') handleNavigate('knowledge');
          else if (hit.type === 'bot') handleNavigate('agents');
          else if (hit.type === 'setting') handleNavigate('settings');
          else if (hit.type === 'tool' || hit.type === 'plugin') router.push('/control/plugins');
          else if (hit.type === 'integration') router.push('/control/integrations');
        }
        break;
      default:
        break;
    }
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
        activeSection={section}
        open={sidebarOpen}
        waiting={(section === 'chat' || section === 'team') && chatBusy}
        onSelect={handleSelect}
        onNewChat={() => void handleNewChat()}
        onToggle={() => setSidebarOpen((v) => !v)}
        onClose={() => setSidebarOpen(false)}
        onNavigate={handleNavigate}
        onRenameConversation={handleRename}
        onPinConversation={handlePin}
        onArchiveConversation={(id) => void handleArchive(id)}
        onSignOut={() => void handleSignOut()}
      />

      <div className="main-column">
        <TopBar
          section={section}
          onOpenSidebar={() => setSidebarOpen(true)}
          busy={(section === 'chat' || section === 'team') && chatBusy}
          rosterStates={rosterStates}
        />

        {section === 'chat' && (
          <Chat
            key={activeId}
            conversationId={activeId}
            onBusyChange={setChatBusy}
            onRosterChange={setRosterStates}
          />
        )}
        {section === 'team' && (
          <TeamChat
            key={`team-${activeId}`}
            conversationId={activeId}
            onBusyChange={setChatBusy}
            onRosterChange={setRosterStates}
          />
        )}
        {section === 'home' && <HomeView onNavigate={handleNavigate} />}
        {section === 'agents' && <AgentsView onNavigate={handleNavigate} />}
        {section === 'factory' && <BotFactoryView />}
        {section === 'missions' && <MissionControlView />}
        {section === 'marketplace' && <MarketplaceView />}
        {section === 'settings' && <SettingsView />}
        {section === 'tools' && <ToolsView />}
        {section === 'projects' && <ProjectsView />}
        {section === 'knowledge' && <KnowledgeView />}
        {section === 'research' && <ResearchView />}
        {section === 'automations' && <AutomationsView />}
        {section === 'analytics' && <AnalyticsView />}
        {section === 'profile' && <ProfileView />}
        {section === 'notifications' && <NotificationsView />}
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAction={handlePaletteAction}
      />
    </div>
  );
}
