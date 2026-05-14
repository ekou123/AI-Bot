import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AIProvider, AskResult, Message } from "./types";
import { getSetting } from "../../db";

export const anthropicProvider: AIProvider = {
  async ask(backendId, messages) {
    const apiKey = await getSetting("anthropic_api_key");
    if (!apiKey) throw new Error("Anthropic API key not set. Open Settings to add it.");
    return invoke<AskResult>("ask_claude", { messages, model: backendId, apiKey });
  },

  async stream(backendId, messages, onChunk) {
    const apiKey = await getSetting("anthropic_api_key");
    if (!apiKey) throw new Error("Anthropic API key not set. Open Settings to add it.");

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
        invoke("stream_claude", { messages, model: backendId, apiKey, streamId })
          .catch(err => { cleanup(); reject(err); });
      });
    });
  },
};

export async function streamClaude(
  backendId: string,
  messages: Message[],
  onChunk: (text: string) => void,
): Promise<AskResult> {
  const apiKey = await getSetting("anthropic_api_key");
  if (!apiKey) throw new Error("Anthropic API key not set. Open Settings to add it.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: backendId,
      max_tokens: 8096,
      stream: true,
      messages,
    }),
  });

  if (!response.ok || !response.body) throw new Error(`API error: ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  

  while (true) {
    const {done, value} = await reader?.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n")

    for (const line of lines) {
      if (line.startsWith("data:")) {
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            onChunk(parsed.delta.text);
          }
        } catch {}
      }
    }
    
  }

    return { reply: "", usage: { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 } };

}

