import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AIProvider, AskResult } from "./types";
import { getSetting } from "../../db";

export const openaiProvider: AIProvider = {
  async ask(backendId, messages) {
    const apiKey = await getSetting("openai_api_key");
    if (!apiKey) throw new Error("OpenAI API Key not set");
    return invoke<AskResult>("ask_chatgpt", { messages, model: backendId, apiKey });
  },

  async stream(backendId, messages, onChunk) {
    const apiKey = await getSetting("openai_api_key");
    if (!apiKey) throw new Error("OpenAI API Key not set");

    const streamId = Math.random().toString(36).slice(2);

    return new Promise<AskResult>((resolve, reject) => {
      const unlisteners: (() => void)[] = [];
      const cleanup = () => unlisteners.forEach(fn => fn());

      Promise.all([
        listen<string>(`stream:chunk:${streamId}`, e => onChunk(e.payload)),
        listen<void>(`stream:done:${streamId}`, () => {
          cleanup();
          resolve({ reply: "", usage: { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 } });
        }),
        listen<string>(`stream:error:${streamId}`, e => {
          cleanup();
          reject(new Error(e.payload));
        }),
      ]).then(([u1, u2, u3]) => {
        unlisteners.push(u1, u2, u3);
        invoke("stream_chatgpt", { messages, model: backendId, apiKey, streamId })
          .catch(err => { cleanup(); reject(err); });
      });
    });
  },
};