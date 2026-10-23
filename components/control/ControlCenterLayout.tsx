export function ControlCenterLayout({
  title,
  subtitle,
  eyebrow = 'Control Center',
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="view-shell cc-shell">
      <div className="view-header cc-header">
        <div>
          <div className="cc-eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="cc-header-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
