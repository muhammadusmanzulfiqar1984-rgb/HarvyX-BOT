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
