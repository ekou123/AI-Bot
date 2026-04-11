import { invoke } from "@tauri-apps/api/core";
import type { AIProvider, AskResult } from "./types";

export const anthropicProvider: AIProvider = {
  ask(backendId, prompt) {
    return invoke<AskResult>("ask_claude", { prompt, model: backendId });
  },
};