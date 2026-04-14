import { useState } from "react";
import { ChatCard } from "./components/ChatCard";
import { calculateMessageCost } from "./lib/pricing";
import { createBot, type SavedChat, type BotPanel } from "./lib/providers/types";
import { askAI } from "./lib/providers"
import "./App.css";

export default function App() {
  const [nextId, setNextId] = useState(2);
  const [bots, setBots] = useState<BotPanel[]>([createBot(1)]);
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [topZIndex, setTopZIndex] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function addBotToRight() {
    setBots((prev) => [...prev, createBot(nextId)]);
    setNextId((prev) => prev + 1);
  }

  function updateBot(id: number, updates: Partial<BotPanel>) {
    setBots((prev) =>
      prev.map((bot) => (bot.id === id ? { ...bot, ...updates } : bot))
    );
  }

  function focusBot(id: number) {
    const next = topZIndex + 1;
    setTopZIndex(next);
    updateBot(id, { zIndex: next });
  }

  function deleteBot(id: number) {
    const bot = bots.find((b) => b.id === id);
    setBots((prev) => prev.filter((b) => b.id !== id));
  }

  function reopenChat(chat: SavedChat) {
    const newBot: BotPanel = {
      ...createBot(nextId),
      title: chat.title,
      model: chat.model,
      messages: chat.messages,
    };
    setBots((prev) => [...prev, newBot]);
    setNextId((prev) => prev + 1);
  }

  async function askBot(id: number) {
    const bot = bots.find((b) => b.id === id);
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

      setBots((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                messages: [...newMessages, { role: "assistant" as const, content: result.reply }],
                prompt: "",
                spent: b.spent + messageCost,
                lastMessageCost: messageCost,
              }
            : b
        )
      );

      if (bot.messages.length === 0) {
        const titleResult = await askAI(bot.model, [
          { role: "user", content: `Summarise this conversation topic in 5 words or less: "${bot.prompt}"` }
        ]);
        updateBot(id, { title: titleResult.reply.trim() });
      }

      setSavedChats((prev) => {
        const existing = prev.findIndex((c) => c.id === id);
        const updatedChat: SavedChat = {
          id,
          title: bot.title,
          model: bot.model,
          messages: [...newMessages, { role: "assistant" as const, content: result.reply }],
        }

        if (existing != -1) {
          const updated = [...prev]
          updated[existing] = updatedChat;
          return updated;
        }

        return [...prev, updatedChat]
      })

      setSessionTotal((prev) => prev + messageCost);
    } catch (err) {
      updateBot(id, { reply: JSON.stringify(err) });
    } finally {
      updateBot(id, { loading: false });
    }
  }

  return (
    <div className="app-shell">
      <div className="background-glow glow-1" />
      <div className="background-glow glow-2" />

      <div className="app-body">
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <div className="sidebar-content">
            {savedChats.map((chat) => (
              <div key={chat.id} className="history-group" onClick={() => reopenChat(chat)} style={{ cursor: "pointer" }}>
                <span className="history-group-title">{chat.title}</span>
                <span className="history-item">{chat.messages.length} messages</span>
              </div>
            ))}
          </div>
        </div>

        <div className="workspace">
          <div className="workspace-header">
            <div className="tabs-bar">
              <button className="add-tab-button" onClick={() => setSidebarOpen(prev => !prev)}>
                ☰ History
              </button>
              <button className="add-tab-button" onClick={addBotToRight}>
                + Add tab on right
              </button>
            </div>

            <div className="total-cost-card">
              <span className="total-cost-label">Session Total</span>
              <span className="total-cost-value">${sessionTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="chat-layout">
            {bots.map((bot) => (
              <ChatCard
                key={bot.id}
                bot={bot}
                onUpdate={(updates) => updateBot(bot.id, updates)}
                onAsk={() => askBot(bot.id)}
                onFocus={() => focusBot(bot.id)}
                onDelete={() => deleteBot(bot.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
