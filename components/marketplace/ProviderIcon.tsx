/**
 * Generic capability marks for Marketplace cards.
 * These are HARVYX-styled glyphs / monograms — not trademarked vendor logos.
 */

type Props = {
  icon: string;
  name?: string;
  size?: number;
  className?: string;
};

function initials(name?: string, fallback = '?'): string {
  if (!name?.trim()) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Soft tint classes by family — CSS variables only */
function toneFor(icon: string): string {
  if (['pptx', 'gamma', 'canva', 'docx', 'gdocs', 'pdf'].includes(icon)) return 'is-docs';
  if (['xlsx', 'gsheets'].includes(icon)) return 'is-sheets';
  if (['image', 'media-image', 'media-video', 'media-audio'].includes(icon)) return 'is-media';
  if (['search', 'research', 'scrape', 'knowledge'].includes(icon)) return 'is-research';
  if (['gmail', 'outlook', 'slack', 'whatsapp'].includes(icon)) return 'is-comm';
  if (['gcal', 'zoom', 'gmeet', 'schedule'].includes(icon)) return 'is-time';
  if (['github', 'gitlab', 'http', 'webhook', 'mcp', 'mock'].includes(icon)) return 'is-dev';
  if (['gdrive', 'onedrive', 'dropbox', 'box'].includes(icon)) return 'is-storage';
  if (['harvyx', 'hubspot', 'salesforce'].includes(icon)) return 'is-crm';
  if (['stt', 'tts'].includes(icon)) return 'is-media';
  return 'is-default';
}

function Glyph({ icon }: { icon: string }) {
  const stroke = {
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (icon) {
    case 'pptx':
      return (
        <g {...stroke}>
          <rect x="5" y="4" width="14" height="16" rx="1.5" />
          <path d="M8 9h8M8 13h5" />
          <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
        </g>
      );
    case 'gamma':
      return (
        <g {...stroke}>
          <path d="M12 4.5 19 8v8l-7 3.5L5 16V8l7-3.5Z" />
          <path d="M12 12v7.5M12 12 19 8M12 12 5 8" />
        </g>
      );
    case 'canva':
      return (
        <g {...stroke}>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M9 14.5c1.2 1.2 4.8 1.2 6 0M10 10h.01M14 10h.01" />
        </g>
      );
    case 'docx':
    case 'gdocs':
      return (
        <g {...stroke}>
          <path d="M7 3.5h7l4 4V20.5H7z" />
          <path d="M14 3.5v4h4M9 11h6M9 14.5h6M9 18h4" />
        </g>
      );
    case 'pdf':
      return (
        <g {...stroke}>
          <path d="M7 3.5h7l4 4V20.5H7z" />
          <path d="M14 3.5v4h4" />
          <path d="M9 13h6M9 16.5h4" />
        </g>
      );
    case 'xlsx':
    case 'gsheets':
      return (
        <g {...stroke}>
          <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" />
          <path d="M4.5 10h15M4.5 15h15M10 4.5v15M15 4.5v15" />
        </g>
      );
    case 'image':
    case 'media-image':
      return (
        <g {...stroke}>
          <rect x="4" y="5" width="16" height="14" rx="1.5" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="M4.5 16.5 9 12l3 3 2.5-2.5 5 4" />
        </g>
      );
    case 'media-video':
      return (
        <g {...stroke}>
          <rect x="3.5" y="6" width="12" height="12" rx="1.5" />
          <path d="M15.5 10.5 20.5 7.5v9l-5-3z" />
        </g>
      );
    case 'media-audio':
    case 'tts':
      return (
        <g {...stroke}>
          <path d="M11 5v14l-5-4H4.5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1H6l5-4Z" />
          <path d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7.5a6 6 0 0 1 0 9" />
        </g>
      );
    case 'stt':
      return (
        <g {...stroke}>
          <rect x="9" y="4" width="6" height="11" rx="3" />
          <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3" />
        </g>
      );
    case 'search':
      return (
        <g {...stroke}>
          <circle cx="10.5" cy="10.5" r="5.5" />
          <path d="M15 15l4.5 4.5" />
        </g>
      );
    case 'research':
      return (
        <g {...stroke}>
          <circle cx="10" cy="10" r="5" />
          <path d="M14 14l5 5M8 10h4M10 8v4" />
        </g>
      );
    case 'scrape':
      return (
        <g {...stroke}>
          <path d="M5 7h14M5 12h10M5 17h12" />
          <path d="M17 10l2.5 2.5L17 15" />
        </g>
      );
    case 'knowledge':
      return (
        <g {...stroke}>
          <path d="M4 5.5c2-1 5-1 8 0 3-1 6-1 8 0v13c-2-1-5-1-8 0-3-1-6-1-8 0v-13Z" />
          <path d="M12 5.5v13" />
        </g>
      );
    case 'gmail':
    case 'outlook':
      return (
        <g {...stroke}>
          <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
          <path d="M3.5 8 12 13.5 20.5 8" />
        </g>
      );
    case 'slack':
      return (
        <g {...stroke}>
          <path d="M8 4.5v4M16 4.5v4M8 15.5v4M16 15.5v4M4.5 8h4M15.5 8h4M4.5 16h4M15.5 16h4" />
          <rect x="8" y="8" width="3.2" height="3.2" rx="0.6" />
          <rect x="12.8" y="8" width="3.2" height="3.2" rx="0.6" />
          <rect x="8" y="12.8" width="3.2" height="3.2" rx="0.6" />
          <rect x="12.8" y="12.8" width="3.2" height="3.2" rx="0.6" />
        </g>
      );
    case 'whatsapp':
      return (
        <g {...stroke}>
          <path d="M6 18.5 7.2 15A7.5 7.5 0 1 1 12 19.5a7.4 7.4 0 0 1-3.2-.7Z" />
          <path d="M9.5 10.5c.3 1.4 1.6 2.7 3 3l1.2-.6.8.4-.4 1.3a5.5 5.5 0 0 1-2.4-2.2" />
        </g>
      );
    case 'gcal':
    case 'schedule':
      return (
        <g {...stroke}>
          <rect x="4" y="5.5" width="16" height="14" rx="1.5" />
          <path d="M4 10h16M8 3.5v4M16 3.5v4M8 14h3M13 14h3" />
        </g>
      );
    case 'zoom':
    case 'gmeet':
      return (
        <g {...stroke}>
          <rect x="3.5" y="7" width="11.5" height="10" rx="1.5" />
          <path d="M15 10.5 20.5 7.5v9L15 13.5z" />
        </g>
      );
    case 'github':
    case 'gitlab':
      return (
        <g {...stroke}>
          <path d="M9 19c-4 1.5-4-2-6-2m12 4v-3.2a3 3 0 0 0-.8-2.3c2.6-.3 5.3-1.3 5.3-5.8a4.5 4.5 0 0 0-1.2-3.1 4.2 4.2 0 0 0-.1-3.1s-1-.3-3.3 1.2a11.3 11.3 0 0 0-6 0C6.8 3.1 5.8 3.4 5.8 3.4a4.2 4.2 0 0 0-.1 3.1A4.5 4.5 0 0 0 4.5 9.6c0 4.5 2.7 5.5 5.3 5.8a3 3 0 0 0-.8 2.3V21" />
        </g>
      );
    case 'gdrive':
    case 'onedrive':
    case 'dropbox':
    case 'box':
      return (
        <g {...stroke}>
          <path d="M4 14.5 8 7.5h8l4 7-4 4H8l-4-4Z" />
          <path d="M8 7.5 12 14.5 16 7.5" />
        </g>
      );
    case 'http':
    case 'webhook':
      return (
        <g {...stroke}>
          <circle cx="12" cy="12" r="8" />
          <path d="M4.5 12h15M12 4.5c2.5 2.5 2.5 12.5 0 15M12 4.5c-2.5 2.5-2.5 12.5 0 15" />
        </g>
      );
    case 'mcp':
    case 'mock':
      return (
        <g {...stroke}>
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <path d="M9 9h6M9 12h6M9 15h3" />
        </g>
      );
    case 'harvyx':
      return (
        <g {...stroke}>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M8 12h8M12 8v8" />
        </g>
      );
    case 'hubspot':
    case 'salesforce':
      return (
        <g {...stroke}>
          <circle cx="8" cy="12" r="3" />
          <circle cx="16" cy="9" r="2.5" />
          <circle cx="15.5" cy="16" r="2.2" />
          <path d="M10.5 11.2 14 9.8M10.2 13.5l3.5 1.8" />
        </g>
      );
    default:
      return null;
  }
}

export function ProviderIcon({ icon, name, size = 36, className = '' }: Props) {
  const tone = toneFor(icon);
  const glyph = <Glyph icon={icon} />;
  const label = initials(name, icon.slice(0, 2).toUpperCase());

  return (
    <span
      className={`hx-mp-provider-icon ${tone}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      aria-hidden
      title={name || icon}
      data-icon={icon}
    >
      {glyph ? (
        <svg width={Math.round(size * 0.58)} height={Math.round(size * 0.58)} viewBox="0 0 24 24">
          {glyph}
        </svg>
      ) : (
        <span className="hx-mp-provider-mono">{label}</span>
      )}
    </span>
  );
}
