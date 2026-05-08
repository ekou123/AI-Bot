import { useEffect, useRef, useState } from "react";
import { BotPanel, SavedChat } from "../lib/providers/types";

type Props = {
  isOpen: boolean;
  savedChats: SavedChat[];
  favouriteIds: number[];
  bots: BotPanel[];
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

function ChatHistoryItem({ chat, isOpenCard, onReopenChat, onDeleteHistoryChat, onToggleFavourite, favouriteIds }: ItemProps) {
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
              <button className="chat-menu-item-favourite"
              onClick={(e) => {e.stopPropagation(); onToggleFavourite(chat.id); setMenuOpen(false);}}
              >Favourite</button>
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

export function Sidebar({ isOpen, savedChats, bots, onReopenChat, onDeleteHistoryChat, onToggleFavourite, favouriteIds }: Props) {
  const [historyFilter, setHistoryFilter] = useState("");
  const [sortMode, setSortMode] = useState<"date" | "alpha">("date");
  const [showFavourites, setShowFavourites] = useState(false);
  function handleChangeHistoryFilter(newHistoryFilter: string) {
    setHistoryFilter(newHistoryFilter);

  }

  return (
    <div className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
      <div className="history-heading-box">
        <h1 className="history-heading-text">History</h1>
        <div>
          <button className="filter-history-btn"
          onClick={() => {setShowFavourites(false); setHistoryFilter("")}}
          >All</button>
          <button className="filter-history-btn"
          onClick={() => {setShowFavourites(true)}}>Favourites</button>
          </div>
        <div>Filter: <input
            type="text"
            value={historyFilter}
            onChange={(e) => setHistoryFilter(e.target.value)}
          />
        </div>
      </div>
      <div className="sidebar-content">
        {savedChats.length === 0 && (
          <div className="history-empty">No chats yet. Send a message to save history.</div> 
        )}
        { 
        savedChats
        .filter(chat => !showFavourites || favouriteIds.includes(chat.id))
        .filter(chat => chat.title.toLowerCase().includes(historyFilter.toLowerCase()))
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
    </div>
  );
}
