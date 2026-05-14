import { invoke } from "@tauri-apps/api/core";
import type { AIProvider, AskResult } from "./types";
import { getSetting } from "../../db";
import { streamViaRust } from "./stream-helper";

export const anthropicProvider: AIProvider = {
  async ask(backendId, messages, system?) {
    const apiKey = await getSetting("anthropic_api_key");
    if (!apiKey) throw new Error("Anthropic API key not set. Open Settings to add it.");
    return invoke<AskResult>("ask_claude", { messages, model: backendId, apiKey, system: system ?? null });
  },

  async stream(backendId, messages, onChunk, system?) {
    const apiKey = await getSetting("anthropic_api_key");
    if (!apiKey) throw new Error("Anthropic API key not set. Open Settings to add it.");
    return streamViaRust(onChunk, {
      url: "https://api.anthropic.com/v1/messages",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: { model: backendId, max_tokens: 8096, stream: true, messages, ...(system ? { system } : {}) },
      textPath: ["delta", "text"],
    });
  },
};


