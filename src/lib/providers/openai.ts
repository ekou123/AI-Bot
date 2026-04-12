import { invoke } from "@tauri-apps/api/core";
import type { AIProvider, AskResult } from "./types";

export const openaiProvider: AIProvider = {
  ask(backendId, messages) {
    return invoke<AskResult>("ask_chatgpt", { messages: messages, model: backendId });
  },
};