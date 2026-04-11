import { MODEL_INFO, type ModelKey, type Provider } from "../models";
import type { AIProvider, AskResult } from "./types";
import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";

const PROVIDERS: Record<Provider, AIProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

export function askAI(model: ModelKey, prompt: string): Promise<AskResult> {
  const config = MODEL_INFO[model];
  const provider = PROVIDERS[config.provider];
  return provider.ask(config.backendId, prompt);
}

export type { AskResult };