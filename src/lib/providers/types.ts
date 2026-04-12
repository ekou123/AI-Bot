import type { ModelKey } from "../models";

export type AskResult = {
    reply: string;
    usage: {
        input_tokens: number;
        cached_input_tokens: number;
        output_tokens: number;
    }
}

export interface AIProvider {
    ask(backendId: string, messages: Message[]): Promise<AskResult>;
}

export type Message = {
  role: "user" | "assistant";
  content: string;
}

export type BotPanel = {
  id: number;
  title: string;
  model: ModelKey;
  prompt: string;
  reply: string;
  messages: Message[];
  loading: boolean;
  spent: number;
  lastMessageCost: number;
  x: number;
  y: number;
  zIndex: number;
};

export function createBot(id: number): BotPanel {
  return {
    id,
    title: `Bot ${id}`,
    model: "gpt-5.4-mini",
    prompt: "",
    reply: "",
    messages: [],
    loading: false,
    spent: 0,
    lastMessageCost: 0,
    x: (id-1)*30,
    y: (id-1)*30,
    zIndex: 0,
  };
}