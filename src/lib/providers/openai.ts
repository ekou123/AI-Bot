import { invoke } from "@tauri-apps/api/core";
import type { AIProvider, AskResult } from "./types";
import { getSetting } from "../../db";

export const openaiProvider: AIProvider = {
  async ask(backendId, messages) {
    const apiKey = await getSetting("openai_api_key");
    if (!apiKey) throw new Error("OpenAI API Key not set");
    return invoke<AskResult>("ask_chatgpt", { messages, model: backendId, apiKey });
  },
};