import { useEffect, useRef, useState } from "react";
import { BotPanel, SavedChat } from "../lib/providers/types";

type Props = {
  savedChats: SavedChat[];
  favouriteIds: number[];
  bots: BotPanel[];
  onNewChat: () => void;
  onReopenChat: (chat: SavedChat) => void;
  onDeleteHistoryChat: (id: number) => void;
  onToggleFavourite: (id: number) => void;
  onNavigate: (page: string) => void;
};

type ItemProps = {
  chat: SavedChat;
  isOpenCard: boolean;
  favouriteIds: number[];
  onReopenChat: (chat: SavedChat) => void;
  onDeleteHistoryChat: (id: number) => void;
  onToggleFavourite: (id: number) => void;
};

function ChatHistoryItem({ chat, isOpenCard, onReopenChat, onDeleteHistoryChat, onToggleFavourite, favouriteIds }: ItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isFavourited = favouriteIds.includes(chat.id);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
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
          <button className="chat-menu-btn" onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }}>⋮</button>
          {menuOpen && (
            <div className="chat-history-settings">
              <button className="chat-menu-item-favourite" onClick={e => { e.stopPropagation(); onToggleFavourite(chat.id); setMenuOpen(false); }}>
                {isFavourited ? "Unfavourite" : "Favourite"}
              </button>
              <button className="chat-menu-item-red" onClick={e => { e.stopPropagation(); onDeleteHistoryChat(chat.id); setMenuOpen(false); }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      <span className="history-item">{chat.messages.length} messages · {chat.model}</span>
    </div>
  );
}

const NAV_ITEMS = [
  { icon: "🏠", label: "Home" },
  { icon: "💬", label: "Chats" },
  { icon: "⚖️", label: "Compare AI" },
  { icon: "🤖", label: "Agents" },
  { icon: "📦", label: "Workspaces" },
  { icon: "📄", label: "Files" },
  { icon: "💡", label: "Prompts" },
  { icon: "🕓", label: "History" },
  { icon: "💰", label: "Usage & Cost" },
  { icon: "⚙", label: "Settings" },
];

export function Sidebar({ savedChats, bots, onReopenChat, onDeleteHistoryChat, onToggleFavourite, favouriteIds, onNavigate }: Props) {
  const [activeNav, setActiveNav] = useState("Home");
  const [historyFilter, setHistoryFilter] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`}>

      <nav className="nav-items">
        {NAV_ITEMS.map(item => (
          <div
            key={item.label}
            className={`nav-item${activeNav === item.label ? " nav-item-active" : ""}`}
            onClick={() => {
              setActiveNav(item.label);
              onNavigate(item.label);
            }}
          >
            <span className="nav-item-icon">{item.icon}</span>
            {!collapsed && <span className="nav-item-label">{item.label}</span>}
            {!collapsed && item.label === "Chats" && savedChats.length > 0 && (
              <span className="nav-badge">{savedChats.length}</span>
            )}
          </div>
        ))}
      </nav>

      {/* History list — shown when History is active */}
      {activeNav === "History" && !collapsed && (
        <div className="nav-history-panel">
          <input
            className="nav-search-input"
            type="text"
            value={historyFilter}
            onChange={e => setHistoryFilter(e.target.value)}
            placeholder="Search chats..."
          />
          <div className="sidebar-content">
            {savedChats.length === 0 && (
              <div className="history-empty">No chats yet.</div>
            )}
            {savedChats
              .filter(c => c.title.toLowerCase().includes(historyFilter.toLowerCase()))
              .sort((a, b) => b.updated_at - a.updated_at)
              .map(chat => (
                <ChatHistoryItem
                  key={chat.id}
                  chat={chat}
                  favouriteIds={favouriteIds}
                  isOpenCard={bots.some(b => b.id === chat.id)}
                  onReopenChat={onReopenChat}
                  onDeleteHistoryChat={onDeleteHistoryChat}
                  onToggleFavourite={onToggleFavourite}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
