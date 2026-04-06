import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Resizable } from "re-resizable";
import "./App.css";

const MODEL_INFO = {
  "gpt-5.4": {
    label: "GPT-5.4",
    inputPricePer1M: 2.5,
    cachedInputPricePer1M: 0.25,
    outputPricePer1M: 15.0,
    inputPriceText: "$2.50 / 1M input tokens",
    outputPriceText: "$15.00 / 1M output tokens",
  },
  "gpt-5.4-mini": {
    label: "GPT-5.4 mini",
    inputPricePer1M: 0.75,
    cachedInputPricePer1M: 0.075,
    outputPricePer1M: 4.5,
    inputPriceText: "$0.75 / 1M input tokens",
    outputPriceText: "$4.50 / 1M output tokens",
  },
  "gpt-5.4-nano": {
    label: "GPT-5.4 nano",
    inputPricePer1M: 0.2,
    cachedInputPricePer1M: 0.02,
    outputPricePer1M: 1.25,
    inputPriceText: "$0.20 / 1M input tokens",
    outputPriceText: "$1.25 / 1M output tokens",
  },
} as const;

const MODEL_OPTIONS = Object.keys(MODEL_INFO) as Array<keyof typeof MODEL_INFO>;

type ModelKey = keyof typeof MODEL_INFO;

type BotPanel = {
  id: number;
  title: string;
  model: ModelKey;
  prompt: string;
  reply: string;
  loading: boolean;
  spent: number;
  lastMessageCost: number;
};

type AskChatGptResult = {
  reply: string;
  usage: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
  };
};

function createBot(id: number): BotPanel {
  return {
    id,
    title: `Bot ${id}`,
    model: "gpt-5.4-mini",
    prompt: "",
    reply: "",
    loading: false,
    spent: 0,
    lastMessageCost: 0,
  };
}

function calculateMessageCost(
  model: ModelKey,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_INFO[model];
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);

  const inputCost =
    (uncachedInputTokens / 1_000_000) * pricing.inputPricePer1M;

  const cachedInputCost =
    (cachedInputTokens / 1_000_000) * pricing.cachedInputPricePer1M;

  const outputCost =
    (outputTokens / 1_000_000) * pricing.outputPricePer1M;

  return inputCost + cachedInputCost + outputCost;
}

export default function App() {
  const [nextId, setNextId] = useState(2);
  const [bots, setBots] = useState<BotPanel[]>([createBot(1)]);
  const [sessionTotal, setSessionTotal] = useState(0);

  function addBotToRight() {
    const newBot = createBot(nextId);
    setBots((prev) => [...prev, newBot]);
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
      const result = await invoke<AskChatGptResult>("ask_chatgpt", {
        prompt: bot.prompt,
        model: bot.model,
      });

      const messageCost = calculateMessageCost(
        bot.model,
        result.usage.input_tokens,
        result.usage.cached_input_tokens,
        result.usage.output_tokens
      );

      setBots((prev) =>
        prev.map((currentBot) =>
          currentBot.id === id
            ? {
                ...currentBot,
                reply: result.reply,
                spent: currentBot.spent + messageCost,
                lastMessageCost: messageCost,
              }
            : currentBot
        )
      );

      setSessionTotal((prev) => prev + messageCost);
    } catch (err) {
      updateBot(id, { reply: String(err) });
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
            <span className="total-cost-value">
              ${sessionTotal.toFixed(2)}
            </span>
          </div>
        </div>

        
        <div className="chat-layout">
          {bots.map((bot) => {
            const selectedModel = MODEL_INFO[bot.model];
            return (
              <Resizable
              key={bot.id}
              defaultSize={{width: 600, height: 1000}}
              minWidth={440}
              maxWidth={1000}
              enable= {{left: true, right: true, top: true, bottom: true, topLeft: true, topRight: true, bottomLeft: true, bottomRight: true}}
              >
              <section className="chat-card" key={bot.id}>
                <div className="topbar">
                  <div className="topbar-left">
                    <h1>{bot.title}</h1>
                    <div className="topbar-meta">
                      <div className="chat-cost-card">
                        <span className="chat-cost-label">Chat total</span>
                        <span className="chat-cost-value">${bot.spent.toFixed(4)}</span>
                      </div>
                      <div className="chat-cost-card">
                        <span className="chat-cost-label">Last msg</span>
                        <span className="chat-cost-value">${bot.lastMessageCost.toFixed(6)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="status-pill">
                    <span className="status-dot" />
                    {bot.loading ? "Thinking..." : "Ready"}
                  </div>
                </div>

                <p className="subtitle">Choose a model and send a prompt.</p>

                <div className="model-price-banner">
                  <div className="model-price-name">{selectedModel.label}</div>
                  <div className="model-price-details">
                    <span>Input: {selectedModel.inputPriceText}</span>
                    <span>Output: {selectedModel.outputPriceText}</span>
                  </div>
                </div>

                <div className="input-section">
                  <select
                    id={`model-${bot.id}`}
                    className="selectAIModel"
                    value={bot.model}
                    onChange={(e) =>
                      updateBot(bot.id, {
                        model: e.target.value as ModelKey,
                      })
                    }
                  >
                    {MODEL_OPTIONS.map((model) => (
                      <option key={model} value={model}>
                        {MODEL_INFO[model].label}
                      </option>
                    ))}
                  </select>

                  <span className="section-label">Response</span>
                  <div className="reply-box">
                    {bot.reply ? (
                      <pre>{bot.reply}</pre>
                    ) : (
                      <p className="placeholder-text">
                        Your response will appear here.
                      </p>
                    )}
                  </div>
                </div>

                <div className="reply-section">
                  <div className="actions" style={{ marginTop: 0 }}>
                    <textarea
                      id={`prompt-${bot.id}`}
                      value={bot.prompt}
                      onChange={(e) =>
                        updateBot(bot.id, { prompt: e.target.value })
                      }
                      placeholder="Type your message here..."
                      className="prompt-box"
                    />
                  </div>
                  <div className="actions">
                    <button
                      onClick={() => askBot(bot.id)}
                      disabled={bot.loading}
                      className="send-button"
                    >
                      {bot.loading ? "Thinking..." : "Send"}
                    </button>
                  </div>
                </div>
                
              </section>
              </Resizable>
              
              
            );
          })}
        </div>
      </div>
    </div>
  );
}