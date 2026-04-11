import { invoke } from "@tauri-apps/api/core";
import type { AIProvider, AskResult } from "./types";

export const openaiProvider: AIProvider = {
  ask(backendId, prompt) {
    return invoke<AskResult>("ask_chatgpt", { prompt, model: backendId });
  },
};