import { useState, useEffect, useRef } from "react";
import { MODEL_INFO, MODEL_OPTIONS, type ModelKey } from "./lib/models";
import { askAI } from "./lib/providers";
import { calculateMessageCost } from "./lib/pricing";
import type { Message } from "./lib/providers/types";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ChatUI } from "./components/ChatUI";

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

  const [isRenaming, setIsRenaming] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);



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

  async function commitRename() {
    const newName = renameRef.current?.value;

    if (!newName?.trim()) return;

    titleRef.current = newName;
    setTitle(newName);
    getCurrentWindow().setTitle(newName);
    await emit("chat:rename", { id: chatIdRef.current, title: newName });

    setIsRenaming(false);
  }

  async function handleRename(newTitle: string) {
  titleRef.current = newTitle;
  setTitle(newTitle);
  getCurrentWindow().setTitle(newTitle);
  await emit("chat:rename", { id: chatIdRef.current, title: newTitle });
}

  function sliceMessages() {
  setMessages(prev => prev.slice(-20));
  }

  async function summariseMessages() {
    if (messages.length === 0) return;
    setLoading(true);
    const result = await askAI(model, [
      ...messagesRef.current,
      { role: "user", content: "Summarise our conversation so far into a concise paragraph that preserves all important context." }
    ]);
    const summary: Message[] = [{ role: "assistant", content: `[Summary] ${result.reply}` }];
    setMessages(summary);
    messagesRef.current = summary;
    setLoading(false);
  }

  

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
  <ChatUI
      title={title}
      model={model}
      messages={messages}
      prompt={prompt}
      loading={loading}
      spent={spent}
      isRenaming={isRenaming}
      onPromptChange={setPrompt}
      onSend={sendMessage}
      onModelChange={setModel}
      onRename={handleRename}
      onSlice={sliceMessages}
      onSummarise={summariseMessages}
      onSetRenaming={setIsRenaming}
      headerActions={<button onClick={popBack} className="delete-button">Pop back</button>}
      responseActions={<>
        <button onClick={sliceMessages} className="slice-btn">Slice</button>
        <button onClick={summariseMessages} className="slice-btn">Summarise</button>
      </>} onTopbarMouseDown={function (e: React.MouseEvent<HTMLDivElement>): void {
        throw new Error("Function not implemented.");
      } }  />
  );
}
