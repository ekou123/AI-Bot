import { useState } from "react";
import type { Workspace, SavedChat } from "../../lib/providers/types";
import { HomeInputBar } from "../home/HomeInputBar";
import { RightPanel } from "../home/RightPanel";


type Props = {
  workspace: Workspace;
  savedChats: SavedChat[];
  sessionTotal: number;
  onNewChat: () => void;
  onReopenChat: (chat: SavedChat) => void;
  onClose: () => void;
};

export function WorkspacesCanvas({ workspace, savedChats, onClose, onNewChat}: Props) {
  const [inputValue, setInputValue] = useState("");
  const [sessionTotal] = useState(0);

  function handleSend() {
    if (!inputValue.trim()) return;
    onNewChat();
    setInputValue("");
  }

  return (
    <main className="main-canvas">
      <div className="main-content">
        <div className="home-scroll">
          <div className="home-welcome">
            <h2 className="home-welcome-title">{workspace.icon} {workspace.name}</h2>
            <p className="home-welcome-sub">{workspace.agents.length} agents · {workspace.files.length} files</p>
          </div>
          {workspace.systemPrompt && (
            <div className="home-section">
              <div className="home-section-title">Context</div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-2)", margin: 0 }}>{workspace.systemPrompt}</p>
            </div>
          )}
          <button className="home-view-all" onClick={onClose} style={{ alignSelf: "flex-start" }}>← Back to home</button>
        </div>
        <HomeInputBar value={inputValue} onChange={setInputValue} onSend={handleSend} />
      </div>
      <RightPanel savedChats={savedChats} sessionTotal={sessionTotal} onNewChat={onNewChat} />
    </main>
  );
}
