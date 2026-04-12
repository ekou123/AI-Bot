import { invoke } from "@tauri-apps/api/core";
import type { AIProvider, AskResult } from "./types";

export const anthropicProvider: AIProvider = {
  ask(backendId, messages) {
    return invoke<AskResult>("ask_claude", { messages: messages, model: backendId });
  },
};