import {
  HomeIcon,
  ChatIcon,
  TeamIcon,
  AgentsIcon,
  MarketplaceIcon,
  ProjectsIcon,
  KnowledgeIcon,
  ToolsIcon,
  AutomationsIcon,
  AnalyticsIcon,
  SettingsIcon,
  ProfileIcon,
  NotificationsIcon,
  ControlIcon,
  IntegrationsIcon,
  PluginsIcon,
  ConnectionsIcon,
  ModelsIcon,
  WorkflowsIcon,
  SecurityIcon,
  ApiIcon,
  LogsIcon,
} from './icons';

export type WorkspaceSection =
  | 'home'
  | 'chat'
  | 'team'
  | 'agents'
  | 'factory'
  | 'missions'
  | 'marketplace'
  | 'projects'
  | 'knowledge'
  | 'research'
  | 'tools'
  | 'automations'
  | 'analytics'
  | 'settings'
  | 'profile'
  | 'notifications';

export type ControlSection =
  | 'control'
  | 'ecosystem'
  | 'integrations'
  | 'plugins'
  | 'connections'
  | 'models'
  | 'workflows'
  | 'security'
  | 'api'
  | 'logs';

export type NavSection = WorkspaceSection | ControlSection;

export type NavItem = {
  id: NavSection;
  label: string;
  icon: (p: { size?: number }) => React.ReactElement;
  /** Workspace items stay on `/`; control items use href */
  href?: string;
};

export type NavGroup = {
  id: string;
  label: string;
  tone?: 'workspace' | 'control' | 'system';
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'home',
    label: 'Home',
    tone: 'workspace',
    items: [{ id: 'home', label: 'Home', icon: HomeIcon }],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    tone: 'workspace',
    items: [
      { id: 'chat', label: 'Chat', icon: ChatIcon },
      { id: 'team', label: 'Team', icon: TeamIcon },
      { id: 'agents', label: 'Agents', icon: AgentsIcon },
      { id: 'factory', label: 'Bot Factory', icon: PluginsIcon },
      { id: 'missions', label: 'Mission Control', icon: WorkflowsIcon },
      { id: 'marketplace', label: 'Marketplace', icon: MarketplaceIcon },
      { id: 'projects', label: 'Projects', icon: ProjectsIcon },
      { id: 'knowledge', label: 'Knowledge', icon: KnowledgeIcon },
      { id: 'research', label: 'Research', icon: WorkflowsIcon },
      { id: 'tools', label: 'Tools', icon: ToolsIcon },
      { id: 'automations', label: 'Automations', icon: AutomationsIcon },
      { id: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
    ],
  },
  {
    id: 'control',
    label: 'Control Center',
    tone: 'control',
    items: [
      { id: 'control', label: 'Overview', icon: ControlIcon, href: '/control' },
      { id: 'ecosystem', label: 'Ecosystem', icon: ControlIcon, href: '/control/ecosystem' },
      { id: 'integrations', label: 'Integrations', icon: IntegrationsIcon, href: '/control/integrations' },
      { id: 'plugins', label: 'Plugins', icon: PluginsIcon, href: '/control/plugins' },
      { id: 'connections', label: 'Connections', icon: ConnectionsIcon, href: '/control/connections' },
      { id: 'models', label: 'Models', icon: ModelsIcon, href: '/control/models' },
      { id: 'workflows', label: 'Workflows', icon: WorkflowsIcon, href: '/control/workflows' },
      { id: 'security', label: 'Security', icon: SecurityIcon, href: '/control/security' },
      { id: 'api', label: 'API & Developers', icon: ApiIcon, href: '/control/api' },
      { id: 'logs', label: 'Logs & Activity', icon: LogsIcon, href: '/control/logs' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    tone: 'system',
    items: [
      { id: 'profile', label: 'Profile', icon: ProfileIcon },
      { id: 'notifications', label: 'Notifications', icon: NotificationsIcon },
      { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

/** Flat list for title lookups */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const NAV_TITLES: Record<NavSection, string> = {
  home: 'Home',
  chat: 'Chat',
  team: 'Team',
  agents: 'Agents',
  factory: 'Bot Factory',
  missions: 'Mission Control',
  marketplace: 'Marketplace',
  projects: 'Projects',
  knowledge: 'Knowledge',
  research: 'Research',
  tools: 'Tools',
  automations: 'Automations',
  analytics: 'Analytics',
  settings: 'Settings',
  profile: 'Profile',
  notifications: 'Notifications',
  control: 'Control Center',
  ecosystem: 'Ecosystem',
  integrations: 'Integrations',
  plugins: 'Plugins',
  connections: 'Connections',
  models: 'Models',
  workflows: 'Workflows',
  security: 'Security',
  api: 'API & Developers',
  logs: 'Logs & Activity',
};

export const WORKSPACE_SECTIONS = new Set<string>([
  'home',
  'chat',
  'team',
  'agents',
  'factory',
  'missions',
  'marketplace',
  'projects',
  'knowledge',
  'research',
  'tools',
  'automations',
  'analytics',
  'settings',
  'profile',
  'notifications',
]);

export function controlHrefToSection(pathname: string): ControlSection | null {
  if (pathname === '/control' || pathname === '/control/') return 'control';
  const map: Record<string, ControlSection> = {
    '/control/ecosystem': 'ecosystem',
    '/control/integrations': 'integrations',
    '/control/plugins': 'plugins',
    '/control/connections': 'connections',
    '/control/models': 'models',
    '/control/workflows': 'workflows',
    '/control/security': 'security',
    '/control/api': 'api',
    '/control/logs': 'logs',
  };
  return map[pathname] ?? null;
}
