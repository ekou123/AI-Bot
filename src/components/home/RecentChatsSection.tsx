import type { SavedChat } from "../../lib/providers/types";

type Props = {
  chats: SavedChat[];
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

export function RecentChatsSection({ chats, onReopenChat }: Props) {
  return (
    <div className="home-section">
      <div className="home-section-header">
        <span className="home-section-title">Recent Chats</span>
        <button className="home-view-all">History →</button>
      </div>
      <div className="home-chats-list">
        {chats.length === 0 && (
          <div className="home-chats-empty">No chats yet — start one above.</div>
        )}
        {chats.map(chat => (
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
  );
}
