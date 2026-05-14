import { useState, Dispatch, SetStateAction } from "react";
import { AgentStepResult, BotPanel, createBot, Message, SavedChat } from "../lib/providers/types";
import { calculateMessageCost } from "../lib/pricing";
import { askAI, streamAI } from "../lib/providers";
import { getDB, getSetting } from "../db";
import { invoke } from "@tauri-apps/api/core";

export function useBots(
  setSavedChats: Dispatch<SetStateAction<SavedChat[]>>,
  setSessionTotal: Dispatch<SetStateAction<number>>
) {
  const [bots, setBots] = useState<BotPanel[]>([]);
  const [nextId, setNextId] = useState(1);
  const [topZIndex, setTopZIndex] = useState(1);
  

  function addBot(): number {
    const id = nextId;
    setBots(prev => [...prev, createBot(id)]);
    setNextId(prev => prev + 1);
    return id;
  }

  async function summariseBot(id: number) {
    const bot = bots.find(b => b.id === id);
    if (!bot || bot.messages.length === 0) return;

    updateBot(id, { loading: true });

    const result = await askAI(bot.model, [
      ...bot.messages.filter(m => m.role !== "tool"),
      { role: "user", content: "Summarise our conversation so far into a concise paragraph that preserves all important context." }
    ]);

    updateBot(id, { loading: false });

    const summary: Message[] = [{ role: "assistant", content: `[Summary] ${result.reply}` }];
    const newId = nextId;
    setNextId(prev => prev + 1);

    const newBot: BotPanel = {
      ...createBot(newId),
      title: `Summary of ${bot.title}`,
      model: bot.model,
      messages: summary,
      x: bot.x + 30,
      y: bot.y + 30,
      zIndex: topZIndex + 1,
    };
    setTopZIndex(prev => prev + 1);
    setBots(prev => [...prev, newBot]);

    const newSavedChat: SavedChat = {
      id: newId,
      title: newBot.title,
      model: newBot.model,
      messages: summary,
      updated_at: Math.floor(Date.now() / 1000),
    };
    setSavedChats(prev => [newSavedChat, ...prev]);
    getDB().execute(
      `INSERT INTO chats (id, title, model, messages, updated_at) VALUES ($1, $2, $3, $4, unixepoch())`,
      [newId, newBot.title, newBot.model, JSON.stringify(summary)]
    );
  }

  function sliceAIChat(id: number, keep: number = 20) {
    const bot = bots.find(b => b.id === id);
    if (!bot) return

    const sliced = bot.messages.slice(-keep);
    updateBot(id, {messages: sliced});
    setSavedChats(prev => prev.map(c => c.id === id ? {...c, messages: sliced} : c));

    getDB().execute(
      `UPDATE chats SET messages=$1, updated_at=unixepoch() WHERE id=$2`,
      [JSON.stringify(sliced), id]
    );

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

  async function runResearchAgent(id: number) {
    const bot = bots.find(b => b.id === id);
    if (!bot || !bot.prompt.trim()) return;

    const goal = bot.prompt;
    const anthropicKey = await getSetting("anthropic_api_key");
    const tavilyKey = await getSetting("tavily_api_key");

    if (!anthropicKey) {
      updateBot(id, { messages: [{ role: "assistant", content: "Error: Anthropic API key not set. Open Settings." }], loading: false });
      return;
    }
    if (!tavilyKey) {
      updateBot(id, { messages: [{ role: "assistant", content: "Error: Tavily API key not set. Open Settings." }], loading: false });
      return;
    }

    updateBot(id, { loading: true, prompt: "", messages: [{ role: "user", content: goal }] });

    const tools = [{
      name: "web_search",
      description: "Search the web for current, up-to-date information.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "A focused search query." }
        },
        required: ["query"]
      }
    }];

    const apiMessages: unknown[] = [{ role: "user", content: goal }];
    let totalCost = 0;

    try {
      for (let i = 0; i < 10; i++) {
        const step = await invoke<AgentStepResult>("ask_claude_agent", {
          messages: apiMessages,
          tools,
          model: "claude-sonnet-4-6",
          apiKey: anthropicKey,
        });

        totalCost += calculateMessageCost("claude-sonnet-4.6", step.usage.input_tokens, step.usage.cached_input_tokens, step.usage.output_tokens);

        if (step.done) {
          setBots(prev => prev.map(b => b.id === id ? {
            ...b,
            messages: [...b.messages, { role: "assistant" as const, content: step.reply }],
            loading: false,
            spent: b.spent + totalCost,
          } : b));
          break;
        }

        apiMessages.push({ role: "assistant", content: step.assistant_content });

        const toolResults: unknown[] = [];
        for (const call of step.tool_calls) {
          setBots(prev => prev.map(b => b.id === id ? {
            ...b,
            messages: [...b.messages, { role: "tool" as const, content: `🔍 Searching: "${call.input.query}"` }],
          } : b));

          try {
            const searchResult = await invoke<string>("web_search", {
              query: call.input.query as string,
              apiKey: tavilyKey,
            });

            setBots(prev => prev.map(b => b.id === id ? {
              ...b,
              messages: [...b.messages, { role: "tool" as const, content: searchResult }],
            } : b));

            toolResults.push({ type: "tool_result", tool_use_id: call.id, content: searchResult });
          } catch (searchErr) {
            toolResults.push({ type: "tool_result", tool_use_id: call.id, content: `Search failed: ${String(searchErr)}`, is_error: true });
          }
        }

        apiMessages.push({ role: "user", content: toolResults });
      }
    } catch (err) {
      setBots(prev => prev.map(b => b.id === id ? {
        ...b,
        messages: [...b.messages, { role: "assistant" as const, content: `Agent error: ${String(err)}` }],
        loading: false,
      } : b));
    }
  }

  async function askBot(id: number) {
    const bot = bots.find(b => b.id === id);
    if (!bot || !bot.prompt.trim()) return;

    const apiMessages = [...bot.messages.filter(m => m.role !== "tool"), { role: "user" as const, content: bot.prompt }];

    updateBot(id, { loading: true, reply: "", prompt: "" });

    try {
      let reply = "";

      // Push user message + empty assistant bubble so streaming fills it in live
      setBots(prev => prev.map(b => b.id === id ? {
        ...b,
        messages: [...apiMessages, { role: "assistant" as const, content: "" }],
      } : b));

      const result = await streamAI(bot.model, apiMessages, (chunk) => {
        reply += chunk;
        setBots(prev => prev.map(b => {
          if (b.id !== id) return b;
          const msgs = [...b.messages];
          msgs[msgs.length - 1] = { role: "assistant", content: reply };
          return { ...b, messages: msgs };
        }));
      }, bot.systemPrompt || undefined);

      const messageCost = calculateMessageCost(bot.model, result.usage.input_tokens, result.usage.cached_input_tokens, result.usage.output_tokens);
      setSessionTotal(prev => prev + messageCost);
      updateBot(id, { spent: (bots.find(b => b.id === id)?.spent ?? 0) + messageCost });

      const finalMessages = [...apiMessages, { role: "assistant" as const, content: reply }];

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
          messages: finalMessages,
          updated_at: Math.floor(Date.now() / 1000),
        };
        return [updatedChat, ...prev.filter(c => c.id !== id)];
      });

      try {
        const db = getDB();
        await db.execute(
          `INSERT INTO chats (id, title, model, messages, updated_at)
           VALUES ($1, $2, $3, $4, unixepoch())
           ON CONFLICT(id) DO UPDATE SET title=$2, model=$3, messages=$4, updated_at=unixepoch()`,
          [id, chatTitle, bot.model, JSON.stringify(finalMessages)]
        );
      } catch (dbErr) {
        console.error("DB save failed:", dbErr);
      }

    } catch (err) {
      setBots(prev => prev.map(b => b.id === id ? {
        ...b,
        messages: [...apiMessages, { role: "assistant", content: `Error: ${String(err)}` }],
      } : b));
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

  return { bots, setBots, nextId, setNextId, addBot, updateBot, focusBot, deleteBot, askBot, renameBot, summariseBot, sliceAIChat, runResearchAgent };
}
