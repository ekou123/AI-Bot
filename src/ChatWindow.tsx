import { useState, useEffect, useRef } from "react";
import { MODEL_INFO, MODEL_OPTIONS, type ModelKey } from "./lib/models";
import { askAI } from "./lib/providers";
import { calculateMessageCost } from "./lib/pricing";
import type { Message } from "./lib/providers/types";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type ChatUpdatePayload = {
  id: number;
  title: string;
  model: ModelKey;
  messages: Message[];
};

export function ChatWindow() {
  const [title, setTitle] = useState("New Chat");
  const [model, setModel] = useState<ModelKey>("gpt-5.4-mini");
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [spent, setSpent] = useState(0);
  const [lastCost, setLastCost] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatIdRef = useRef<number>(0);
  const messagesRef = useRef<Message[]>([]);
  const titleRef = useRef("New Chat");

  useEffect(() => {
    const label = getCurrentWindow().label; // e.g. "chat-3"
    const id = parseInt(label.split("-")[1] ?? "0", 10);
    chatIdRef.current = id;

    // Tell the main window this window is ready to receive init data
    emit("chat:ready", { label });

    // Listen for init payload (sent by main window for reopened chats)
    const unlistenInit = listen<{ label: string; title: string; model: ModelKey; messages: Message[] }>(
      "chat:init",
      (event) => {
        if (event.payload.label !== label) return;
        const p = event.payload;
        setTitle(p.title);
        titleRef.current = p.title;
        setModel(p.model);
        setMessages(p.messages);
        messagesRef.current = p.messages;
        getCurrentWindow().setTitle(p.title);
      }
    );

    return () => { unlistenInit.then(fn => fn()); };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!prompt.trim() || loading) return;
    const currentMessages = messagesRef.current;
    const currentPrompt = prompt;
    const currentModel = model;

    setLoading(true);
    setPrompt("");

    try {
      const newMessages: Message[] = [...currentMessages, { role: "user", content: currentPrompt }];
      const result = await askAI(currentModel, newMessages);
      const cost = calculateMessageCost(
        currentModel,
        result.usage.input_tokens,
        result.usage.cached_input_tokens,
        result.usage.output_tokens
      );
      const finalMessages: Message[] = [...newMessages, { role: "assistant", content: result.reply }];

      setMessages(finalMessages);
      messagesRef.current = finalMessages;
      setSpent(prev => prev + cost);
      setLastCost(cost);

      let finalTitle = titleRef.current;
      if (currentMessages.length === 0) {
        const titleResult = await askAI(currentModel, [
          { role: "user", content: `Summarise this conversation topic in 5 words or less: "${currentPrompt}"` }
        ]);
        finalTitle = titleResult.reply.trim();
        setTitle(finalTitle);
        titleRef.current = finalTitle;
        getCurrentWindow().setTitle(finalTitle);
      }

      emit("chat:update", {
        id: chatIdRef.current,
        title: finalTitle,
        model: currentModel,
        messages: finalMessages,
      } satisfies ChatUpdatePayload);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function popBack() {
    
    await emit("chat:popin", {
      id: chatIdRef.current,
      title: titleRef.current,
      model,
      messages: messagesRef.current,
    });
    
    await getCurrentWindow().close();
  }

  const selectedModel = MODEL_INFO[model];

  return (
    <div className="chat-window-root">
      <div className="chat-window-header">
        <div className="chat-window-title-row">
          <h1 className="chat-window-title">{title}</h1>
          <button onClick={popBack} className="delete-button">Pop back</button>
          <div className="status-pill">
            <span
              className="status-dot"
              style={{
                background: loading ? "#f59e0b" : "#4ade80",
                boxShadow: loading
                  ? "0 0 10px rgba(245,158,11,0.7)"
                  : "0 0 10px rgba(74,222,128,0.7)",
              }}
            />
            {loading ? "Thinking..." : "Ready"}
          </div>
        </div>
        <div className="chat-window-meta">
          <div className="chat-cost-card">
            <span className="chat-cost-label">Chat total</span>
            <span className="chat-cost-value">${spent.toFixed(4)}</span>
          </div>
          <div className="chat-cost-card">
            <span className="chat-cost-label">Last msg</span>
            <span className="chat-cost-value">${lastCost.toFixed(6)}</span>
          </div>
        </div>
      </div>

      <div className="model-price-banner">
        <div className="model-price-name">{selectedModel.label}</div>
        <div className="model-price-details">
          <span>Input: {selectedModel.inputPriceText}</span>
          <span>Output: {selectedModel.outputPriceText}</span>
        </div>
      </div>

      <select
        className="selectAIModel"
        value={model}
        onChange={(e) => setModel(e.target.value as ModelKey)}
      >
        {MODEL_OPTIONS.map((m) => (
          <option key={m} value={m}>{MODEL_INFO[m].label}</option>
        ))}
      </select>

      <div className="chat-window-messages">
        {messages.length === 0 && (
          <p className="placeholder-text">Your conversation will appear here.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <pre>{msg.content}</pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-window-input">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type your message... (Ctrl+Enter to send)"
          className="prompt-box"
        />
        <div className="actions">
          <button onClick={sendMessage} disabled={loading} className="send-button">
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
