import { BotPanel, SavedChat } from "../lib/providers/types";

type Props = {
  isOpen: boolean;
  savedChats: SavedChat[];
  bots: BotPanel[];
  onReopenChat: (chat: SavedChat) => void;
};

export function Sidebar({ isOpen, savedChats, bots, onReopenChat }: Props) {
  return (
    <div className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
      <div className="history-heading-box">
        <h1 className="history-heading-text">History</h1>
      </div>
      <div className="sidebar-content">
        {savedChats.length === 0 && (
          <div className="history-empty">No chats yet. Send a message to save history.</div>
        )}
        {savedChats.map((chat) => {
          const isOpenCard = bots.some(b => b.id === chat.id);
          return (
            <div
              key={chat.id}
              className={`history-group${isOpenCard ? " history-group-open" : ""}`}
              onClick={() => onReopenChat(chat)}
              style={{ cursor: "pointer" }}
            >
              <div className="history-group-header">
                <span className="history-group-title">{chat.title}</span>
                {isOpenCard && <span className="history-open-badge">open</span>}
              </div>
              <span className="history-item">{chat.messages.length} messages</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
