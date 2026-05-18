import { QUICK_PROMPTS, ACTIVE_MODELS } from "../../data/homeData";
import type { SavedChat } from "../../lib/providers/types";

type Props = {
  savedChats: SavedChat[];
  sessionTotal: number;
  onNewChat: () => void;
};

export function RightPanel({ savedChats, sessionTotal, onNewChat }: Props) {
  const chatsToday = savedChats.filter(c => Date.now() / 1000 - c.updated_at < 86400).length;

  return (
    <aside className="right-panel">
      <div className="rp-section">
        <div className="rp-section-title">Quick Stats</div>
        <div className="rp-stat-row">
          <span className="rp-stat-label">Chats today</span>
          <span className="rp-stat-value">{chatsToday}</span>
        </div>
        <div className="rp-stat-row">
          <span className="rp-stat-label">Total chats</span>
          <span className="rp-stat-value">{savedChats.length}</span>
        </div>
        <div className="rp-stat-row">
          <span className="rp-stat-label">Session cost</span>
          <span className="rp-stat-value">${sessionTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="rp-section">
        <div className="rp-section-title">Quick Prompts</div>
        {QUICK_PROMPTS.map(p => (
          <button key={p} className="rp-prompt-btn" onClick={onNewChat}>{p}</button>
        ))}
      </div>

      <div className="rp-section">
        <div className="rp-section-title">Active Models</div>
        {ACTIVE_MODELS.map(m => (
          <div key={m.name} className="rp-model-row">
            <span className="rp-model-dot" style={{ background: m.dot }} />
            <span className="rp-model-name">{m.name}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
