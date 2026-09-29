type IconProps = { size?: number; className?: string };

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Svg({ size = 18, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </Svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </Svg>
  );
}

export function TeamIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 18} height={props.size ?? 18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 19c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14 19c.3-1.8 1.7-3.2 3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AgentsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

export function MarketplaceIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h16l-1.5 11h-13L4 8Z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </Svg>
  );
}

export function ProjectsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h6l2 2h8v10H4V6Z" />
    </Svg>
  );
}

export function KnowledgeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5.5c2-1 5-1 8 0 3-1 6-1 8 0v13c-2-1-5-1-8 0-3-1-6-1-8 0v-13Z" />
      <path d="M12 5.5v13" />
    </Svg>
  );
}

export function ToolsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 6.5a3 3 0 0 1 4 4L9 20l-4-4 9.5-9.5Z" />
      <path d="M13 8l3 3" />
    </Svg>
  );
}

export function AutomationsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <circle cx="12" cy="12" r="4.5" />
    </Svg>
  );
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 19V10" />
      <path d="M12 19V5" />
      <path d="M19 19v-7" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a7.4 7.4 0 0 0 0-2l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1L11 21h4l.3-2.6a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5Z" />
    </Svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </Svg>
  );
}

export function ControlIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </Svg>
  );
}

export function IntegrationsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="2.5" />
      <circle cx="16" cy="8" r="2.5" />
      <circle cx="12" cy="16" r="2.5" />
      <path d="M10 9.2 11.2 14" />
      <path d="M14 9.2 12.8 14" />
    </Svg>
  );
}

export function PluginsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4v3" />
      <path d="M16 4v3" />
      <rect x="5" y="7" width="14" height="12" rx="2" />
      <path d="M9 12h6" />
    </Svg>
  );
}

export function ConnectionsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 12a4 4 0 0 1 0-5.7L11.1 4.2a4 4 0 0 1 5.7 5.7L15 12" />
      <path d="M15 12a4 4 0 0 1 0 5.7l-2.1 2.1a4 4 0 0 1-5.7-5.7L9 12" />
    </Svg>
  );
}

export function ModelsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="M5.6 5.6 7.8 7.8" />
      <path d="M16.2 16.2 18.4 18.4" />
      <path d="M18.4 5.6 16.2 7.8" />
      <path d="M7.8 16.2 5.6 18.4" />
    </Svg>
  );
}

export function WorkflowsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="9" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M10 7h2.5L14 11" />
      <path d="M10 17h2.5L14 13" />
    </Svg>
  );
}

export function SecurityIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
      <path d="M9.5 12.2 11.2 14l3.3-3.5" />
    </Svg>
  );
}

export function ApiIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 8 4 12l4 4" />
      <path d="M16 8l4 4-4 4" />
      <path d="M13 6 11 18" />
    </Svg>
  );
}

export function LogsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 5h12v14H6z" />
      <path d="M9 9h6" />
      <path d="M9 12h6" />
      <path d="M9 15h4" />
    </Svg>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19" />
    </Svg>
  );
}

export function NotificationsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 16V10a6 6 0 0 1 12 0v6" />
      <path d="M5 16h14" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </Svg>
  );
}
