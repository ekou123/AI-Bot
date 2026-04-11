import { useState } from "react";
import { ChatCard } from "./components/ChatCard";
import { calculateMessageCost } from "./lib/pricing";
import { createBot, type BotPanel } from "./lib/providers/types";
import { askAI } from "./lib/providers"
import "./App.css";

export default function App() {
  const [nextId, setNextId] = useState(2);
  const [bots, setBots] = useState<BotPanel[]>([createBot(1)]);
  const [sessionTotal, setSessionTotal] = useState(0);

  function addBotToRight() {
    setBots((prev) => [...prev, createBot(nextId)]);
    setNextId((prev) => prev + 1);
  }

  function updateBot(id: number, updates: Partial<BotPanel>) {
    setBots((prev) =>
      prev.map((bot) => (bot.id === id ? { ...bot, ...updates } : bot))
    );
  }

  async function askBot(id: number) {
    const bot = bots.find((b) => b.id === id);
    if (!bot || !bot.prompt.trim()) return;

    updateBot(id, { loading: true });

    try {
      const result = await askAI(bot.model, bot.prompt);
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
                reply: result.reply,
                spent: b.spent + messageCost,
                lastMessageCost: messageCost,
              }
            : b
        )
      );
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

      <div className="workspace">
        <div className="workspace-header">
          <div className="tabs-bar">
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}