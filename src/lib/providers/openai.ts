import { invoke } from "@tauri-apps/api/core";
import type { AIProvider, AskResult } from "./types";
import { getSetting } from "../../db";
import { streamViaRust } from "./stream-helper";

export const openaiProvider: AIProvider = {
  async ask(backendId, messages, system?) {
    const apiKey = await getSetting("openai_api_key");
    if (!apiKey) throw new Error("OpenAI API Key not set");
    return invoke<AskResult>("ask_chatgpt", { messages, model: backendId, apiKey, system: system ?? null });
  },

  async stream(backendId, messages, onChunk, system?) {
    const apiKey = await getSetting("openai_api_key");
    if (!apiKey) throw new Error("OpenAI API Key not set");
    const fullMessages = system ? [{ role: "system", content: system }, ...messages] : messages;
    return streamViaRust(onChunk, {
      url: "https://api.openai.com/v1/chat/completions",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: { model: backendId, stream: true, messages: fullMessages },
      textPath: ["choices", "0", "delta", "content"],
    });
  },
};