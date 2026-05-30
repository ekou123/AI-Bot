import { useState } from "react";
import type { SavedChat } from "../lib/providers/types";
import { HomeInputBar } from "./home/HomeInputBar";
import { RightPanel } from "./home/RightPanel";

type Props = {
  savedChats: SavedChat[];
  sessionTotal: number;
  onNewChat: () => void;
  onOpenTuner: () => void;
  onReopenChat: (chat: SavedChat) => void;
};

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

export function MainCanvas({ savedChats, sessionTotal, onNewChat, onOpenTuner, onReopenChat }: Props) {
  const [inputValue, setInputValue] = useState("");

  const recentChats = [...savedChats]
    .sort((a, b) => b.updated_at - a.updated_at)
    .slice(0, 3);

  function handleSend() {
    if (!inputValue.trim()) return;
    onNewChat();
    setInputValue("");
  }

  return (
    <main className="main-canvas">
      <div className="main-content">
        <div className="home-scroll">

          {/* Welcome */}
          <div className="home-welcome">
            <h2 className="home-welcome-title">Welcome back, Ethan! 👋</h2>
            <p className="home-welcome-sub">What would you like to work on today?</p>
          </div>

          {/* Feature cards */}
          <div className="home-feature-grid">
            {[
              { icon: "💬", label: "Ask Anything", sub: "Chat with any AI model", action: onNewChat },
              { icon: "⚖️", label: "Compare AI", sub: "Side-by-side model outputs", action: onNewChat },
              { icon: "🤖", label: "Create Agent", sub: "Build a custom AI agent", action: onNewChat },
              { icon: "📄", label: "Summarise Files", sub: "Upload & extract insights", action: onNewChat },
              { icon: "💻", label: "Code Helper", sub: "Write, review & debug code", action: onNewChat },
              { icon: "🔍", label: "Research Mode", sub: "Deep web research agent", action: onNewChat },
              { icon: "🎻", label: "Violin Tuner", sub: "Open the tuner page", action: onOpenTuner },
            ].map(card => (
              <button key={card.label} className="home-feature-card" onClick={card.action}>
                <span className="home-feature-icon">{card.icon}</span>
                <span className="home-feature-label">{card.label}</span>
                <span className="home-feature-sub">{card.sub}</span>
              </button>
            ))}
          </div>

          {/* Recent Workspaces */}
          <div className="home-section">
            <div className="home-section-header">
              <span className="home-section-title">Recent Workspaces</span>
              <button className="home-view-all">View all →</button>
            </div>
            <div className="home-workspace-grid">
              {[
                { icon: "📦", name: "Project Alpha", sub: "3 agents · last used 2h ago" },
                { icon: "🧪", name: "Research Lab", sub: "5 agents · last used 1d ago" },
                { icon: "💡", name: "Brainstorm", sub: "1 agent · last used 3d ago" },
                { icon: "🗂️", name: "Client Work", sub: "2 agents · last used 5d ago" },
              ].map(ws => (
                <button key={ws.name} className="home-workspace-card">
                  <span className="home-workspace-icon">{ws.icon}</span>
                  <div>
                    <div className="home-workspace-name">{ws.name}</div>
                    <div className="home-workspace-sub">{ws.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Pinned Agents */}
          <div className="home-section">
            <div className="home-section-header">
              <span className="home-section-title">Pinned Agents</span>
              <button className="home-view-all">Manage →</button>
            </div>
            <div className="home-agents-grid">
              {[
                { icon: "🤖", name: "General Assistant", model: "GPT-4o", color: "#5b7cff" },
                { icon: "💻", name: "Code Reviewer", model: "Claude Sonnet", color: "#7b61ff" },
                { icon: "📊", name: "Data Analyst", model: "Gemini 2.5", color: "#06b6d4" },
                { icon: "✍️", name: "Content Writer", model: "GPT-4o", color: "#10b981" },
              ].map(agent => (
                <button key={agent.name} className="home-agent-row" onClick={onNewChat}>
                  <span className="home-agent-icon" style={{ background: agent.color + "22", color: agent.color }}>{agent.icon}</span>
                  <div className="home-agent-info">
                    <span className="home-agent-name">{agent.name}</span>
                    <span className="home-agent-model">{agent.model}</span>
                  </div>
                  <span className="home-agent-arrow">›</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Chats */}
          <div className="home-section">
            <div className="home-section-header">
              <span className="home-section-title">Recent Chats</span>
              <button className="home-view-all">History →</button>
            </div>
            <div className="home-chats-list">
              {recentChats.length === 0 && (
                <div className="home-chats-empty">No chats yet — start one above.</div>
              )}
              {recentChats.map(chat => (
                <button key={chat.id} className="home-chat-row" onClick={() => onReopenChat(chat)}>
                  <span className="home-chat-icon">💬</span>
                  <div className="home-chat-info">
                    <span className="home-chat-title">{chat.title}</span>
                    <span className="home-chat-meta">{chat.messages.length} messages · {chat.model}</span>
                  </div>
                  <span className="home-chat-time">{timeAgo(chat.updated_at)}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
        <HomeInputBar value={inputValue} onChange={setInputValue} onSend={handleSend} />
      </div>
      <RightPanel savedChats={savedChats} sessionTotal={sessionTotal} onNewChat={onNewChat} />
    </main>
  );
}
