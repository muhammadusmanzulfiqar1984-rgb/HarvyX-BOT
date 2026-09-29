export function StatusBadge({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'muted' | 'danger' | 'planned';
  children: React.ReactNode;
}) {
  return <span className={`cc-badge cc-badge-${tone}`}>{children}</span>;
}
