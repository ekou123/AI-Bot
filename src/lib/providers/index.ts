import { MODEL_INFO, type ModelKey, type Provider } from "../models";
import type { AIProvider, AskResult, Message } from "./types";
import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";

import { geminiProvider } from "./gemini";

const PROVIDERS: Record<Provider, AIProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,   // add this
};

export function askAI(model: ModelKey, messages: Message[], system?: string): Promise<AskResult> {
  const config = MODEL_INFO[model];
  const provider = PROVIDERS[config.provider];
  return provider.ask(config.backendId, messages, system);
}

export async function streamAI(
  model: ModelKey,
  messages: Message[],
  onChunk: (text: string) => void,
  system?: string
): Promise<AskResult> {
  const config = MODEL_INFO[model];
  const provider = PROVIDERS[config.provider];
  if (provider.stream) {
    return provider.stream(config.backendId, messages, onChunk, system);
  }
  const result = await provider.ask(config.backendId, messages, system);
  onChunk(result.reply);
  return result;
}

export type { AskResult };