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
};

type ItemProps = {
  chat: SavedChat;
  isOpenCard: boolean;
  favouriteIds: number[]
  onReopenChat: (chat: SavedChat) => void;
  onDeleteHistoryChat: (id: number) => void;
  onToggleFavourite: (id: number) => void;
};

type FilterDropdownProps = {
  historyFilter: string;
  setHistoryFilter: (v: string) => void;
  showFavourites: boolean;
  setShowFavourites: (v: boolean) => void;
};

function ChatHistoryItem({ chat, isOpenCard, onReopenChat, onDeleteHistoryChat, onToggleFavourite, favouriteIds }: ItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  
  const isFavourited = favouriteIds.includes(chat.id);
  

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
              <button className="chat-menu-item-favourite"
              onClick={(e) => {e.stopPropagation(); onToggleFavourite(chat.id); setMenuOpen(false);}}
              >{isFavourited ? "Unfavourite" : "Favourite"}</button>
              <button className="chat-menu-item-red"
              onClick={(e) => { e.stopPropagation(); onDeleteHistoryChat(chat.id); setMenuOpen(false);}}>
                Delete
              </button>
              
            </div>
          )}
        </div>
      </div>
      <div>
        <span className="history-item">{chat.messages.length} messages · {chat.model}</span>
      </div>
      
      <span className="history-item">Last used: {new Date(chat.updated_at * 1000).toLocaleDateString()}</span>

    </div>
  );
}

function FilterDropdown({historyFilter, setHistoryFilter, showFavourites, setShowFavourites} : FilterDropdownProps) {
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
    
        <div className="chat-history-filter-dropdown" ref={ref}>
          <button
            className="filter-history-btn"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
          >
            Filter
          </button>
          {menuOpen && (
            <div className="chat-history-settings">
              <button className="chat-menu-item-favourite"
              onClick={(e) => {e.stopPropagation(); setShowFavourites(false); setHistoryFilter(""); setMenuOpen(false);}}
              >All</button>
              <button className="chat-menu-item-favourite"
              onClick={(e) => { e.stopPropagation(); setShowFavourites(true); setMenuOpen(false);}}>
                Favourites
              </button>
              
              
              
            </div>
          )}
    </div>
  )

}

export function Sidebar({ savedChats, bots, onNewChat, onReopenChat, onDeleteHistoryChat, onToggleFavourite, favouriteIds }: Props) {
  const [historyFilter, setHistoryFilter] = useState("");
  const [sortMode, setSortMode] = useState<"date" | "alpha">("date");
  const [showFavourites, setShowFavourites] = useState(false);

  return (
    <div className="sidebar">

      {/* Logo */}
      <div className="nav-logo">
        <span className="nav-logo-icon">🤖</span>
        <div>
          <div className="nav-logo-title">AI Workspace</div>
          <div className="nav-logo-sub">Your intelligent co-pilot</div>
        </div>
      </div>

      {/* New Chat */}
      <div className="nav-new-chat-row">
        <button className="nav-new-chat-btn" onClick={onNewChat}>
          + New Chat
        </button>
      </div>

      {/* Nav items — wire up onClick as needed */}
      <nav className="nav-items">
        <div className="nav-item">🏠 Home</div>
        <div className="nav-item">
          💬 Chats
          {savedChats.length > 0 && <span className="nav-badge">{savedChats.length}</span>}
        </div>
        <div className="nav-item">⭐ Favourites</div>
        <div className="nav-item">🕓 History</div>
      </nav>

      {/* Pinned / History */}
      <div className="history-heading-box">
        <div className="history-heading-row">
          <span className="nav-section-label">Pinned Chats</span>
          <FilterDropdown
            historyFilter={historyFilter}
            setHistoryFilter={setHistoryFilter}
            showFavourites={showFavourites}
            setShowFavourites={setShowFavourites}
          />
        </div>
        <input
          className="nav-search-input"
          type="text"
          value={historyFilter}
          onChange={(e) => setHistoryFilter(e.target.value)}
          placeholder="Search chats..."
        />
      </div>

      <div className="sidebar-content">
        {savedChats.length === 0 && (
          <div className="history-empty">No chats yet. Send a message to save history.</div>
        )}
        {savedChats
          .filter(chat => !showFavourites || favouriteIds.includes(chat.id))
          .filter(chat => chat.title.toLowerCase().includes(historyFilter.toLowerCase()))
          .sort((a, b) => sortMode === "alpha"
            ? a.title.localeCompare(b.title)
            : b.updated_at - a.updated_at)
          .map((chat) => (
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

      {/* Bottom card — e.g. upgrade prompt, user info */}
      <div className="nav-bottom-card">
        <div className="nav-bottom-card-title">Settings</div>
        <div className="nav-bottom-card-sub">API keys &amp; preferences</div>
      </div>

    </div>
  );
}