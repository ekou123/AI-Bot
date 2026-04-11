export type Provider = "openai" | "anthropic";

export type ModelConfig = {
  label: string;
  provider: Provider;
  // The ID the backend (Tauri command) expects
  backendId: string;
  inputPricePer1M: number;
  cachedInputPricePer1M: number;
  outputPricePer1M: number;
  inputPriceText: string;
  outputPriceText: string;
};

export const MODEL_INFO = {
  "gpt-5.4": {
    label: "GPT-5.4",
    provider: "openai",
    backendId: "gpt-5.4",
    inputPricePer1M: 2.5,
    cachedInputPricePer1M: 0.25,
    outputPricePer1M: 15.0,
    inputPriceText: "$2.50 / 1M input tokens",
    outputPriceText: "$15.00 / 1M output tokens",
  },
  "gpt-5.4-mini": {
    label: "GPT-5.4 mini",
    provider: "openai",
    backendId: "gpt-5.4-mini",
    inputPricePer1M: 0.75,
    cachedInputPricePer1M: 0.075,
    outputPricePer1M: 4.5,
    inputPriceText: "$0.75 / 1M input tokens",
    outputPriceText: "$4.50 / 1M output tokens",
  },
  "claude-opus-4.6": {
    label: "Claude Opus 4.6",
    provider: "anthropic",
    backendId: "claude-opus-4-6",
    inputPricePer1M: 15.0,
    cachedInputPricePer1M: 1.5,
    outputPricePer1M: 75.0,
    inputPriceText: "$15.00 / 1M input tokens",
    outputPriceText: "$75.00 / 1M output tokens",
  },
  "claude-sonnet-4.6": {
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    backendId: "claude-sonnet-4-6",
    inputPricePer1M: 3.0,
    cachedInputPricePer1M: 0.3,
    outputPricePer1M: 15.0,
    inputPriceText: "$3.00 / 1M input tokens",
    outputPriceText: "$15.00 / 1M output tokens",
  },
} as const satisfies Record<string, ModelConfig>;

export type ModelKey = keyof typeof MODEL_INFO;
export const MODEL_OPTIONS = Object.keys(MODEL_INFO) as ModelKey[];