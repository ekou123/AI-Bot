import { useEffect, useRef, useState } from "react";
import { BotPanel, SavedChat } from "../lib/providers/types";

type Props = {
  isOpen: boolean;
  savedChats: SavedChat[];
  bots: BotPanel[];
  onReopenChat: (chat: SavedChat) => void;
  onDeleteHistoryChat: (id: number) => void;
};

type ItemProps = {
  chat: SavedChat;
  isOpenCard: boolean;
  onReopenChat: (chat: SavedChat) => void;
  onDeleteHistoryChat: (id: number) => void;
};

function ChatHistoryItem({ chat, isOpenCard, onReopenChat, onDeleteHistoryChat }: ItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div
      className={`history-group${isOpenCard ? " history-group-open" : ""}`}
      onClick={() => onReopenChat(chat)}
      style={{ cursor: "pointer" }}
    >
      <div className="history-group-header">
        <span className="history-group-title">{chat.title}</span>
        {isOpenCard && <span className="history-open-badge">open</span>}
        <div className="chat-history-settings-dropdown" ref={ref}>
          <button
            className="chat-menu-btn"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="chat-history-settings">
              <button onClick={(e) => { e.stopPropagation(); onDeleteHistoryChat(chat.id); setMenuOpen(false); }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      <span className="history-item">{chat.messages.length} messages</span>
    </div>
  );
}

export function Sidebar({ isOpen, savedChats, bots, onReopenChat, onDeleteHistoryChat }: Props) {
  return (
    <div className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
      <div className="history-heading-box">
        <h1 className="history-heading-text">History</h1>
      </div>
      <div className="sidebar-content">
        {savedChats.length === 0 && (
          <div className="history-empty">No chats yet. Send a message to save history.</div>
        )}
        {savedChats.map((chat) => (
          <ChatHistoryItem
            key={chat.id}
            chat={chat}
            isOpenCard={bots.some(b => b.id === chat.id)}
            onReopenChat={onReopenChat}
            onDeleteHistoryChat={onDeleteHistoryChat}
          />
        ))}
      </div>
    </div>
  );
}
