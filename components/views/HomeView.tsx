import type { WorkspaceSection } from '../nav';
import { ManagerCoreIcon } from '../AgentTotems';

export function HomeView({ onNavigate }: { onNavigate: (section: WorkspaceSection) => void }) {
  return (
    <div className="view-shell home-shell">
      <div className="home-command">
        <ManagerCoreIcon state="idle" size="lg" className="home-command-core" />
        <p className="home-command-kicker">AI operating command system</p>
        <h1 className="home-command-title">HARVYX BOT</h1>
        <p className="home-command-line">
          Commerce · CRM · GTM · research · outreach · executive work
        </p>
        <p className="home-command-sub">
          Manager routes OPS, Analyst, Scrape, and Social. Real tools. Approval-gated sends.
        </p>
        <div className="home-command-actions">
          <button className="btn-primary" onClick={() => onNavigate('chat')}>
            Enter command
          </button>
          <button className="btn-ghost" onClick={() => onNavigate('agents')}>
            Agent roster
          </button>
        </div>
      </div>
    </div>
  );
}
