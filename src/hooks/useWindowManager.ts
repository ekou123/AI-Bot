import { useRef, Dispatch, SetStateAction } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { BotPanel, createBot, SavedChat } from "../lib/providers/types";

export function useWindowManager(
  bots: BotPanel[],
  setBots: Dispatch<SetStateAction<BotPanel[]>>,
  focusBot: (id: number) => void
) {
  const pendingInits = useRef<Map<string, SavedChat>>(new Map());

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

  async function reopenChat(chat: SavedChat) {
    if (bots.some(b => b.id === chat.id)) {
      focusBot(chat.id);
      return;
    }

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

  return { pendingInits, popOutBot, reopenChat };
}
