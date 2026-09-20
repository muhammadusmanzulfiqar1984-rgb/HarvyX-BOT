export function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <div className="view-shell">
      <div className="empty-state">
        <div className="empty-state-badge">Coming soon</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}
