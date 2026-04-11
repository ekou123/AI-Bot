import { MODEL_INFO, type ModelKey } from "./models";

export function calculateMessageCost(
  model: ModelKey,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_INFO[model];
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);

  const inputCost = (uncachedInputTokens / 1_000_000) * pricing.inputPricePer1M;
  const cachedInputCost = (cachedInputTokens / 1_000_000) * pricing.cachedInputPricePer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePer1M;

  return inputCost + cachedInputCost + outputCost;
}