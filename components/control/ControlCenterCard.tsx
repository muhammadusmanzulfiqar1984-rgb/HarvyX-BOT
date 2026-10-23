import { StatusBadge } from './StatusBadge';

export function ControlCenterCard({
  title,
  meta,
  status,
  children,
  footer,
}: {
  title: string;
  meta?: string;
  status?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <article className="cc-card">
      <header className="cc-card-head">
        <div>
          <h3>{title}</h3>
          {meta && <p className="cc-card-meta">{meta}</p>}
        </div>
        {status}
      </header>
      {children && <div className="cc-card-body">{children}</div>}
      {footer && <footer className="cc-card-foot">{footer}</footer>}
    </article>
  );
}

export function ComingSoonPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="cc-coming-soon">
      <StatusBadge tone="planned">Coming soon</StatusBadge>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
