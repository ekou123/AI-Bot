import { useState, useEffect } from "react";
import { ChatCard } from "./components/ChatCard";
import { Sidebar } from "./components/Sidebar";
import { createBot, type SavedChat } from "./lib/providers/types";
import type { ChatUpdatePayload } from "./ChatWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import { getDB, setupDB } from "./db";
import { ModelKey } from "./lib/models";
import { useBots } from "./hooks/botCommands";
import { useWindowManager } from "./hooks/useWindowManager";

export default function App() {
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  const { bots, setBots, setNextId, addBot, updateBot, focusBot, deleteBot, askBot, renameBot } =
    useBots(setSavedChats, setSessionTotal);

  const { pendingInits, popOutBot, reopenChat } =
    useWindowManager(bots, setBots, focusBot);

  useEffect(() => {
    setupDB().then(async (db) => {
      const rows = await db.select<{ id: number; title: string; model: string; messages: string }[]>(
        "SELECT * FROM chats ORDER BY updated_at DESC"
      );

      if (rows.length === 0) {
        setBots([createBot(1)]);
        setNextId(2);
      } else {
        setNextId(Math.max(...rows.map(r => r.id)) + 1);
      }

      setSavedChats(rows.map(r => ({ ...r, model: r.model as ModelKey, messages: JSON.parse(r.messages) })));
    });

    const unlistenReady = listen<{ label: string }>("chat:ready", (event) => {
      const { label } = event.payload;
      const pending = pendingInits.current.get(label);
      if (pending) {
        pendingInits.current.delete(label);
        emit("chat:init", {
          label,
          title: pending.title,
          model: pending.model,
          messages: pending.messages,
        });
      }
    });

    const unlistenPopIn = listen<ChatUpdatePayload>("chat:popin", (event) => {
      const { id, title, model, messages } = event.payload;
      setBots(prev => {
        if (prev.some(b => b.id === id)) return prev;
        return [...prev, { ...createBot(id), title, model, messages }];
      });
    });

    const unlistenUpdate = listen<ChatUpdatePayload>("chat:update", (event) => {
      const { id, title, model, messages } = event.payload;
      getDB().execute(
        `INSERT INTO chats (id, title, model, messages, updated_at)
         VALUES ($1, $2, $3, $4, unixepoch())
         ON CONFLICT(id) DO UPDATE SET title=$2, model=$3, messages=$4, updated_at=unixepoch()`,
        [id, title, model, JSON.stringify(messages)]
      );
      setSavedChats(prev => {
        const existing = prev.findIndex(c => c.id === id);
        const updated: SavedChat = { id, title, model, messages };
        if (existing !== -1) {
          const copy = [...prev];
          copy[existing] = updated;
          return copy;
        }
        return [...prev, updated];
      });
    });

    return () => {
      unlistenReady.then(fn => fn());
      unlistenPopIn.then(fn => fn());
      unlistenUpdate.then(fn => fn());
    };
  }, []);

  async function togglePin() {
    const next = !pinned;
    await getCurrentWindow().setAlwaysOnTop(next);
    setPinned(next);
  }

  return (
    <div className="app-shell">
      <div className="background-glow glow-1" />
      <div className="background-glow glow-2" />

      <div className="app-body">
        <Sidebar
          isOpen={sidebarOpen}
          savedChats={savedChats}
          bots={bots}
          onReopenChat={reopenChat}
        />

        <div className="workspace">
          <div className="workspace-header">
            <div className="tabs-bar">
              <button className="add-tab-button" onClick={() => setSidebarOpen(prev => !prev)}>
                ☰ History
              </button>
              <button className="add-tab-button" onClick={addBot}>
                + Add Chat
              </button>
              <button
                className="add-tab-button"
                onClick={togglePin}
                style={{ opacity: pinned ? 1 : 0.6 }}
              >
                {pinned ? "📌 Pinned" : "📌 Pin on top"}
              </button>
            </div>

            <div className="total-cost-card">
              <span className="total-cost-label">Session Total</span>
              <span className="total-cost-value">${sessionTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {bots.map(bot => (
        <ChatCard
          key={bot.id}
          bot={bot}
          onUpdate={updates => updateBot(bot.id, updates)}
          onAsk={() => askBot(bot.id)}
          onFocus={() => focusBot(bot.id)}
          onDelete={() => deleteBot(bot.id)}
          onPopOut={() => popOutBot(bot.id)}
          onRename={(newTitle) => renameBot(bot.id, newTitle)}
        />
      ))}
    </div>
  );
}
