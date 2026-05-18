import { PINNED_AGENTS } from "../../data/homeData";

type Props = { onNewChat: () => void };

export function PinnedAgentsSection({ onNewChat }: Props) {
  return (
    <div className="home-section">
      <div className="home-section-header">
        <span className="home-section-title">Pinned Agents</span>
        <button className="home-view-all">Manage →</button>
      </div>
      <div className="home-agents-grid">
        {PINNED_AGENTS.map(agent => (
          <button key={agent.name} className="home-agent-row" onClick={onNewChat}>
            <span
              className="home-agent-icon"
              style={{ background: agent.color + "22", color: agent.color }}
            >
              {agent.icon}
            </span>
            <div className="home-agent-info">
              <span className="home-agent-name">{agent.name}</span>
              <span className="home-agent-model">{agent.model}</span>
            </div>
            <span className="home-agent-arrow">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
