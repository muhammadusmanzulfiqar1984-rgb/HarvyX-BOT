/** SVG totems for specialist thinking — OPS = horse, Analyst = lion. No emojis. */

type TotemProps = {
  active: boolean;
  className?: string;
};

export function HorseRunningIcon({ active, className }: TotemProps) {
  return (
    <svg
      className={`agent-totem horse ${active ? 'is-active' : ''} ${className ?? ''}`}
      viewBox="0 0 48 32"
      width="28"
      height="18"
      aria-hidden
    >
      <g className="horse-body" fill="currentColor">
        {/* body */}
        <ellipse cx="22" cy="16" rx="11" ry="6.5" />
        {/* neck + head */}
        <path d="M30 12c4-1 7-3 9-2.2.6.3.7 1.2.2 1.7l-2.2 2.2c-1.2.4-2.4.5-3.6.4l-1.2 1.4-2.4-1.2z" />
        <ellipse cx="38.5" cy="11.2" rx="2.2" ry="1.6" />
        {/* mane */}
        <path
          className="horse-mane"
          d="M31 9.5c1.5-2 3.5-3.2 5.2-2.8-.8 1.2-1.6 2.2-2.8 3.1-1 .7-2 1-3.2.8z"
          opacity="0.85"
        />
        {/* tail */}
        <path
          className="horse-tail"
          d="M11 14c-3 0-5 2-5.5 4.5 1.8-1 3.5-1.2 5.2-.4.4-1.4.6-2.8.3-4.1z"
          opacity="0.8"
        />
        {/* legs — animate when active */}
        <g className="horse-legs">
          <rect className="leg leg-fl" x="26" y="20" width="2" height="8" rx="1" />
          <rect className="leg leg-fr" x="30" y="20" width="2" height="8" rx="1" />
          <rect className="leg leg-bl" x="14" y="20" width="2" height="8" rx="1" />
          <rect className="leg leg-br" x="18" y="20" width="2" height="8" rx="1" />
        </g>
      </g>
      {/* ground dash */}
      <g className="horse-ground" stroke="currentColor" strokeWidth="1" opacity="0.35">
        <line className="dash d1" x1="4" y1="29" x2="10" y2="29" />
        <line className="dash d2" x1="16" y1="29" x2="22" y2="29" />
        <line className="dash d3" x1="28" y1="29" x2="34" y2="29" />
      </g>
    </svg>
  );
}

export function LionRoaringIcon({ active, className }: TotemProps) {
  return (
    <svg
      className={`agent-totem lion ${active ? 'is-active' : ''} ${className ?? ''}`}
      viewBox="0 0 40 40"
      width="22"
      height="22"
      aria-hidden
    >
      <g fill="currentColor">
        {/* mane */}
        <circle className="lion-mane" cx="20" cy="20" r="15" opacity="0.28" />
        <circle className="lion-mane-2" cx="20" cy="20" r="12.5" opacity="0.45" />
        {/* face */}
        <circle cx="20" cy="20" r="8.5" />
        {/* ears */}
        <circle cx="13.5" cy="13.5" r="2.2" opacity="0.9" />
        <circle cx="26.5" cy="13.5" r="2.2" opacity="0.9" />
        {/* eyes */}
        <circle cx="16.8" cy="18.5" r="1.15" fill="var(--void)" />
        <circle cx="23.2" cy="18.5" r="1.15" fill="var(--void)" />
        {/* nose */}
        <ellipse cx="20" cy="21.8" rx="1.4" ry="1" fill="var(--void)" opacity="0.75" />
        {/* roar mouth */}
        <path
          className="lion-mouth"
          d="M16.5 24.2c1.2 2.4 2.3 3.6 3.5 3.6s2.3-1.2 3.5-3.6"
          fill="none"
          stroke="var(--void)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>
      {/* roar rings */}
      <g
        className="lion-roar"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      >
        <path className="roar r1" d="M30 14c3 2 4.5 5 4.5 8" opacity="0" />
        <path className="roar r2" d="M31.5 12c4 2.5 6 6.5 6 10.5" opacity="0" />
        <path className="roar r3" d="M10 14c-3 2-4.5 5-4.5 8" opacity="0" />
      </g>
    </svg>
  );
}
