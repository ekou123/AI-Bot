import type { AIProvider, AskResult, Message } from "./types";
import { getSetting } from "../../db";
import { streamViaRust } from "./stream-helper";

function toGeminiMessages(messages: Message[]) {
  return messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

function buildBody(backendId: string, messages: Message[], system?: string) {
  return {
    contents: toGeminiMessages(messages),
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };
}

export const geminiProvider: AIProvider = {
  async ask(backendId, messages, system?) {
    const apiKey = await getSetting("gemini_api_key");
    if (!apiKey) throw new Error("Gemini API key not set. Open Settings to add it.");

    let reply = "";
    await streamViaRust((chunk) => { reply += chunk; }, {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${backendId}:streamGenerateContent?key=${apiKey}&alt=sse`,
      headers: {},
      body: buildBody(backendId, messages, system),
      textPath: ["candidates", "0", "content", "parts", "0", "text"],
    });
    return { reply, usage: { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 } };
  },

  async stream(backendId, messages, onChunk, system?) {
    const apiKey = await getSetting("gemini_api_key");
    if (!apiKey) throw new Error("Gemini API key not set. Open Settings to add it.");
    return streamViaRust(onChunk, {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${backendId}:streamGenerateContent?key=${apiKey}&alt=sse`,
      headers: {},
      body: buildBody(backendId, messages, system),
      textPath: ["candidates", "0", "content", "parts", "0", "text"],
    });
  },
};
