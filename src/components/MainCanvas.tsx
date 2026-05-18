import { useState } from "react";
import type { SavedChat, Workspace } from "../lib/providers/types";
import { WelcomeSection } from "./home/WelcomeSection";
import { FeatureGrid } from "./home/FeatureGrid";
import { ContextFilesSection } from "./home/ContextFilesSection";
import { WorkspacesSection } from "./home/WorkspacesSection";
import { PinnedAgentsSection } from "./home/PinnedAgentsSection";
import { RecentChatsSection } from "./home/RecentChatsSection";
import { HomeInputBar } from "./home/HomeInputBar";
import { RightPanel } from "./home/RightPanel";


type Props = {
  savedChats: SavedChat[];
  sessionTotal: number;
  onNewChat: () => void;
  onReopenChat: (chat: SavedChat) => void;
  onOpenWorkspace: (ws: Workspace) => void;
};

export function MainCanvas({ savedChats, sessionTotal, onNewChat, onReopenChat, onOpenWorkspace }: Props) {
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
          <WelcomeSection />
          <FeatureGrid onNewChat={onNewChat} />
          <WorkspacesSection onOpenWorkspace={onOpenWorkspace} />
          <ContextFilesSection />
          <PinnedAgentsSection onNewChat={onNewChat} />
          <RecentChatsSection chats={recentChats} onReopenChat={onReopenChat} />
        </div>
        <HomeInputBar value={inputValue} onChange={setInputValue} onSend={handleSend} />
      </div>
      <RightPanel savedChats={savedChats} sessionTotal={sessionTotal} onNewChat={onNewChat} />
    </main>
  );
}
