import type { NavSection } from '../nav';

export function HomeView({ onNavigate }: { onNavigate: (section: NavSection) => void }) {
  return (
    <div className="view-shell">
      <div className="home-hero">
        <div className="home-hero-eyebrow">HARVYX BOT</div>
        <h1>Your AI operating system, online.</h1>
        <p>MIAN orchestrates OPS and Analyst from the Bot Registry. Open a workspace or start a new conversation.</p>
        <div className="home-hero-actions">
          <button className="btn-primary" onClick={() => onNavigate('chat')}>
            Open Chat
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('agents')}>
            View Agents
          </button>
        </div>
      </div>

      <div className="home-grid">
        <div className="card">
          <div className="card-eyebrow">Manager</div>
          <h3>HarvYX Bot</h3>
          <p>Answers directly or delegates to OPS / Analyst based on the request.</p>
        </div>
        <div className="card">
          <div className="card-eyebrow">Agent</div>
          <h3>OPS</h3>
          <p>Handles HarvYX leads, campaigns, and pipeline operations.</p>
        </div>
        <div className="card">
          <div className="card-eyebrow">Agent</div>
          <h3>Analyst</h3>
          <p>Deep reasoning, drafting, and research synthesis.</p>
        </div>
      </div>
    </div>
  );
}
