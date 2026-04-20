import { useState, Dispatch, SetStateAction } from "react";
import { BotPanel, createBot, SavedChat } from "../lib/providers/types";
import { calculateMessageCost } from "../lib/pricing";
import { askAI } from "../lib/providers";
import { getDB } from "../db";

export function useBots(
  setSavedChats: Dispatch<SetStateAction<SavedChat[]>>,
  setSessionTotal: Dispatch<SetStateAction<number>>
) {
  const [bots, setBots] = useState<BotPanel[]>([]);
  const [nextId, setNextId] = useState(1);
  const [topZIndex, setTopZIndex] = useState(1);

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

    updateBot(id, { loading: true, reply: "" });

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
      if (bot.messages.length === 0 && bot.title === `Bot ${id}`) {
        const titleResult = await askAI(bot.model, [
          { role: "user", content: `Summarise this conversation topic in 5 words or less: "${bot.prompt}"` }
        ]);
        chatTitle = titleResult.reply.trim();
        updateBot(id, { title: chatTitle });
      }

      setSavedChats(prev => {
        const updatedChat: SavedChat = {
          id,
          title: chatTitle,
          model: bot.model,
          messages: [...newMessages, { role: "assistant" as const, content: result.reply }],
        };
        const without = prev.filter(c => c.id !== id);
        return [updatedChat, ...without];
      });

      try {
        const db = getDB();
        await db.execute(
          `INSERT INTO chats (id, title, model, messages, updated_at)
           VALUES ($1, $2, $3, $4, unixepoch())
           ON CONFLICT(id) DO UPDATE SET title=$2, model=$3, messages=$4, updated_at=unixepoch()`,
          [id, chatTitle, bot.model, JSON.stringify([...newMessages, { role: "assistant", content: result.reply }])]
        );
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

  function renameBot(id: number, newTitle: string) {
    const bot = bots.find(b => b.id === id);
    if (bot) updateBot(id, { title: newTitle });
    
    setSavedChats(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
    getDB().execute("UPDATE chats SET title=$1, updated_at=unixepoch() WHERE id=$2", [newTitle, id]);
  }

  return { bots, setBots, nextId, setNextId, addBot, updateBot, focusBot, deleteBot, askBot, renameBot };
}
