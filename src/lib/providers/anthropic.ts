import { invoke } from "@tauri-apps/api/core";
import type { AIProvider, AskResult } from "./types";
import { getSetting } from "../../db";

export const anthropicProvider: AIProvider = {
  async ask(backendId, messages) {
    const apiKey = await getSetting("anthropic_api_key");
    if (!apiKey) throw new Error("Anthropic API key not set. Open Settings to add it.");
    return invoke<AskResult>("ask_claude", { messages, model: backendId, apiKey });
  },
};