import { useState, useEffect, useRef } from "react";
import { ChatCard } from "./components/ChatCard";
import { calculateMessageCost } from "./lib/pricing";
import { createBot, type SavedChat, type BotPanel } from "./lib/providers/types";
import { askAI } from "./lib/providers";
import type { ChatUpdatePayload } from "./ChatWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import Database from "@tauri-apps/plugin-sql";
import { getDB, setupDB } from "./db";
import { ModelKey } from "./lib/models";

export default function App() {
  const [nextId, setNextId] = useState(2);
  const [bots, setBots] = useState<BotPanel[]>([createBot(1)]);
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [topZIndex, setTopZIndex] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  // Holds init state for chats being reopened as windows, keyed by window label
  const pendingInits = useRef<Map<string, SavedChat>>(new Map());



  useEffect(() => {
    setupDB().then(async (db) => {
    const rows = await db.select<{ id: number; title: string; model: string; messages: string }[]>(
      "SELECT * FROM chats ORDER BY updated_at DESC"
    );
    console.log("Loaded rows:", rows); // add this
    setSavedChats(rows.map(r => ({ ...r, model: r.model as ModelKey, messages: JSON.parse(r.messages) })));
    });

    // When a popped-out window signals ready, send it its initial state
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

    // Re-embed a popped-out window back as a card (window closes itself)
    const unlistenPopIn = listen<ChatUpdatePayload>("chat:popin", (event) => {
      const { id, title, model, messages } = event.payload;
      setBots(prev => {
        if (prev.some(b => b.id === id)) return prev;
        return [...prev, { ...createBot(id), title, model, messages }];
      });
    });

    // Keep history in sync when a standalone window sends a message
    const unlistenUpdate = listen<ChatUpdatePayload>("chat:update", (event) => {
      const { id, title, model, messages } = event.payload;
      setSavedChats(prev => {
        getDB().execute(
      `INSERT INTO chats (id, title, model, messages, updated_at)
      VALUES ($1, $2, $3, $4, unixepoch())
      ON CONFLICT(id) DO UPDATE SET title=$2, model=$3, messages=$4, updated_at=unixepoch()`,
      [id, title, model, JSON.stringify(messages)]
    );


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

  // ── Embedded chat card management ─────────────────────────────────────────

  function addBot() {
    setBots(prev => [...prev, createBot(nextId)]);
    setNextId(prev => prev + 1);
  }

  function updateBot(id: number, updates: Partial<BotPanel>) {
    setBots(prev => prev.map(bot => bot.id === id ? { ...bot, ...updates } : bot));
  }

  function focusBot(id: number) {
    const next = topZIndex + 1;
    setTopZIndex(next);
    updateBot(id, { zIndex: next });
  }

  function deleteBot(id: number) {
    setBots(prev => prev.filter(b => b.id !== id));
  }

  async function askBot(id: number) {
    const bot = bots.find(b => b.id === id);
    if (!bot || !bot.prompt.trim()) return;

    updateBot(id, { loading: true });

    try {
      const newMessages = [...bot.messages, { role: "user" as const, content: bot.prompt }];
      const result = await askAI(bot.model, newMessages);
      const messageCost = calculateMessageCost(
        bot.model,
        result.usage.input_tokens,
        result.usage.cached_input_tokens,
        result.usage.output_tokens
      );

      setBots(prev => prev.map(b => b.id === id ? {
        ...b,
        messages: [...newMessages, { role: "assistant" as const, content: result.reply }],
        prompt: "",
        spent: b.spent + messageCost,
        lastMessageCost: messageCost,
      } : b));

      let chatTitle = bot.title;
      if (bot.messages.length === 0) {
        const titleResult = await askAI(bot.model, [
          { role: "user", content: `Summarise this conversation topic in 5 words or less: "${bot.prompt}"` }
        ]);
        chatTitle = titleResult.reply.trim();
        updateBot(id, { title: chatTitle });
      }

      setSavedChats(prev => {
        const existing = prev.findIndex(c => c.id === id);
        const updatedChat: SavedChat = {
          id,
          title: chatTitle,
          model: bot.model,
          messages: [...newMessages, { role: "assistant" as const, content: result.reply }],
        };
        if (existing !== -1) {
          const copy = [...prev];
          copy[existing] = updatedChat;
          return copy;
        }
        return [...prev, updatedChat];
      });

      try {
      const db = getDB();
      await db.execute(
        `INSERT INTO chats (id, title, model, messages, updated_at)
        VALUES ($1, $2, $3, $4, unixepoch())
        ON CONFLICT(id) DO UPDATE SET title=$2, model=$3, messages=$4, updated_at=unixepoch()`,
        [id, chatTitle, bot.model, JSON.stringify([...newMessages, { role: "assistant", content: result.reply }])]
      );
      console.log("Saved chat", id);
    } catch (dbErr) {
      console.error("DB save failed:", dbErr);
    }

      setSessionTotal(prev => prev + messageCost);
    } catch (err) {
      updateBot(id, { reply: JSON.stringify(err) });
    } finally {
      updateBot(id, { loading: false });
    }
  }

  // ── Window management ─────────────────────────────────────────────────────

  // Pop an embedded card out into its own OS window
  function popOutBot(id: number) {
    const bot = bots.find(b => b.id === id);
    if (!bot) return;

    const label = `chat-${bot.id}`;
    pendingInits.current.set(label, {
      id: bot.id,
      title: bot.title,
      model: bot.model,
      messages: bot.messages,
    });

    setBots(prev => prev.filter(b => b.id !== id));

    new WebviewWindow(label, {
      url: window.location.origin,
      title: bot.title,
      width: 520,
      height: 700,
      resizable: true,
      decorations: true,
    });
  }

  // Open a history chat in an embedded card, or focus it if already open
  async function reopenChat(chat: SavedChat) {
    // Already open as an embedded card — bring it to front
    if (bots.some(b => b.id === chat.id)) {
      focusBot(chat.id);
      return;
    }

    // Already open as a standalone window — just focus it
    const win = await WebviewWindow.getByLabel(`chat-${chat.id}`);
    if (win) {
      win.setFocus();
      return;
    }

    const newBot: BotPanel = {
      ...createBot(chat.id),
      id: chat.id,
      title: chat.title,
      model: chat.model,
      messages: chat.messages,
    };
    setBots(prev => [...prev, newBot]);
  }

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
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
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
                  onClick={() => reopenChat(chat)}
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
        />
      ))}
    </div>
  );
}
