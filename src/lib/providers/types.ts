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
  ask(backendId: string, messages: Message[], system?: string): Promise<AskResult>;
  stream?(backendId: string, messages: Message[], onChunk: (text: string) => void, system?: string): Promise<AskResult>;
}

export type Message = {
  role: "user" | "assistant" | "tool";
  content: string;
}

export type AgentStepResult = {
  done: boolean;
  reply: string;
  tool_calls: { id: string; name: string; input: Record<string, unknown> }[];
  assistant_content: unknown;
  usage: { input_tokens: number; cached_input_tokens: number; output_tokens: number };
}

export type SavedChat = {
  id: number;
  title: string;
  model: ModelKey;
  messages: Message[];
  updated_at: number;
};

export type WorkspaceFile = { id: number; name: string; description: string };

export type Workspace = {
  id: number;
  icon: string;
  name: string;
  systemPrompt: string;
  files: WorkspaceFile[];
  agents: string[];
  updatedAt: number;
};

export type BotPanel = {
  id: number;
  title: string;
  model: ModelKey;
  prompt: string;
  systemPrompt: string;
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
    systemPrompt: "",
    reply: "",
    messages: [],
    loading: false,
    spent: 0,
    lastMessageCost: 0,
    x: -700 + (id - 1) * 30,
    y: -700 + (id - 1) * 30,
    zIndex: 0,
  };
}