/** Original operator mark — golden fedora + cigar; silver smoke. Not a trademarked logo. */

type Props = {
  /** Waiting for agent reply — silver cigar smoke intensifies */
  waiting?: boolean;
  className?: string;
};

export function GodfatherMark({ waiting = false, className }: Props) {
  return (
    <span
      className={`godfather-mark${waiting ? ' is-waiting' : ''} ${className ?? ''}`}
      aria-hidden
      title="Operator"
    >
      <svg viewBox="0 0 72 80" width="56" height="62" focusable="false">
        {/* soft plate behind mark */}
        <circle cx="34" cy="38" r="28" fill="#0A0B0D" stroke="currentColor" strokeWidth="1" opacity="0.45" />
        {/* fedora — brim */}
        <ellipse cx="34" cy="24" rx="26" ry="6" fill="currentColor" />
        {/* fedora — crown */}
        <path
          d="M16 24c1.5-12 9-18 18-18s16.5 6 18 18c-5-2.5-11-3.5-18-3.5S21 21.5 16 24z"
          fill="currentColor"
        />
        {/* hat band */}
        <rect x="17" y="22.5" width="34" height="3" rx="1" fill="#0A0B0D" opacity="0.55" />
        {/* jaw / face block */}
        <path
          d="M20 28c0 14 5 24 14 26 9-2 14-12 14-26-4 3-9 4.5-14 4.5S24 31 20 28z"
          fill="currentColor"
          opacity="0.92"
        />
        {/* brow shadow */}
        <path d="M26 36h10" stroke="#0A0B0D" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        {/* collar hint */}
        <path d="M24 54c3 4 7 6 10 6s7-2 10-6" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.55" />
        {/* cigar */}
        <g className="cigar">
          <rect x="46" y="44" width="16" height="3.4" rx="1.5" fill="#E2C35A" />
          <rect x="46" y="44" width="3.2" height="3.4" rx="1" fill="#8B1A2E" opacity="0.9" />
          <circle className="ember" cx="62.4" cy="45.7" r="1.8" fill="#FFB060" />
        </g>
        {/* silver smoke — never inherits gold */}
        <g className="smoke">
          <ellipse className="smoke-p p1" cx="63" cy="40" rx="2.4" ry="3.8" fill="#C8D0D8" />
          <ellipse className="smoke-p p2" cx="66" cy="34" rx="3" ry="4.5" fill="#E8ECF0" />
          <ellipse className="smoke-p p3" cx="60" cy="30" rx="2.6" ry="4.2" fill="#A8B4C0" />
        </g>
      </svg>
    </span>
  );
}
