// Cost per 1 million tokens (USD)
export interface ModelPricing {
  input: number;   // per 1M input tokens
  output: number;  // per 1M output tokens
  cached?: number; // per 1M cached input tokens (if supported)
}

export const COST_TABLE: Record<string, ModelPricing> = {
  // OpenAI — GPT-5.x
  'gpt-5.1': { input: 1.25, output: 10.0, cached: 0.125 },
  'gpt-5.1-chat': { input: 1.25, output: 10.0, cached: 0.125 },

  // OpenAI — GPT-4.1 family
  'gpt-4.1': { input: 2.0, output: 8.0, cached: 0.5 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6, cached: 0.1 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4, cached: 0.025 },

  // OpenAI — GPT-4o family
  'gpt-4o': { input: 2.5, output: 10.0, cached: 1.25 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cached: 0.075 },

  // OpenAI — o-series reasoning
  'o1': { input: 15.0, output: 60.0, cached: 7.5 },
  'o3': { input: 2.0, output: 8.0, cached: 0.5 },
  'o3-mini': { input: 1.1, output: 4.4, cached: 0.55 },
  'o3-pro': { input: 20.0, output: 80.0 },
  'o4-mini': { input: 1.1, output: 4.4, cached: 0.275 },

  // Anthropic
  'claude-opus-4-6': { input: 5.0, output: 25.0, cached: 0.5 },
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-sonnet-4-5': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0, cached: 0.1 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0, cached: 0.1 },

  // Google
  'gemini-2.5-pro': { input: 1.25, output: 10.0, cached: 0.125 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5, cached: 0.03 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4, cached: 0.025 },
  'gemini-2.0-flash-lite': { input: 0.025, output: 0.1 },

  // DeepSeek (V3.2)
  'deepseek-chat': { input: 0.28, output: 0.42, cached: 0.028 },
  'deepseek-reasoner': { input: 0.28, output: 0.42, cached: 0.028 },

  // Mistral
  'mistral-large-latest': { input: 0.5, output: 1.5 },
  'mistral-medium-latest': { input: 0.4, output: 2.0 },
  'mistral-small-latest': { input: 0.06, output: 0.18 },
  'codestral-latest': { input: 0.3, output: 0.9 },
  'open-mistral-nemo': { input: 0.02, output: 0.04 },

  // Embeddings
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'text-embedding-3-large': { input: 0.13, output: 0 },
  'text-embedding-ada-002': { input: 0.1, output: 0 },
};

/**
 * Get pricing for a model. Returns undefined if not in cost table.
 */
export function getModelPricing(modelId: string): ModelPricing | undefined {
  return COST_TABLE[modelId];
}

/**
 * Calculate cost for a specific usage
 */
export function calculateCost(
  modelId: string,
  usage: { promptTokens: number; completionTokens: number },
): number {
  const pricing = COST_TABLE[modelId];
  if (!pricing) return 0;

  const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(6));
}
