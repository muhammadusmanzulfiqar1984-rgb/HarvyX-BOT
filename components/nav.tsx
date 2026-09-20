import {
  HomeIcon,
  ChatIcon,
  AgentsIcon,
  MarketplaceIcon,
  ProjectsIcon,
  KnowledgeIcon,
  ToolsIcon,
  AutomationsIcon,
  AnalyticsIcon,
  SettingsIcon,
} from './icons';

export type NavSection =
  | 'home'
  | 'chat'
  | 'agents'
  | 'marketplace'
  | 'projects'
  | 'knowledge'
  | 'tools'
  | 'automations'
  | 'analytics'
  | 'settings';

export const NAV_ITEMS: { id: NavSection; label: string; icon: (p: { size?: number }) => React.ReactElement }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'chat', label: 'Chat', icon: ChatIcon },
  { id: 'agents', label: 'Agents', icon: AgentsIcon },
  { id: 'marketplace', label: 'Marketplace', icon: MarketplaceIcon },
  { id: 'projects', label: 'Projects', icon: ProjectsIcon },
  { id: 'knowledge', label: 'Knowledge', icon: KnowledgeIcon },
  { id: 'tools', label: 'Tools', icon: ToolsIcon },
  { id: 'automations', label: 'Automations', icon: AutomationsIcon },
  { id: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export const NAV_TITLES: Record<NavSection, string> = {
  home: 'Home',
  chat: 'Chat',
  agents: 'Agents',
  marketplace: 'Marketplace',
  projects: 'Projects',
  knowledge: 'Knowledge',
  tools: 'Tools',
  automations: 'Automations',
  analytics: 'Analytics',
  settings: 'Settings',
};
