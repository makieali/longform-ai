import type { GenerationConfig, CostEntry, CostEstimate, ModelRole } from '../types.js';
import { getModelPricing, calculateCost, COST_TABLE } from '../providers/cost-table.js';

// Rough estimates for tokens per step per chapter
const TOKENS_PER_STEP: Record<string, { inputMultiplier: number; outputMultiplier: number }> = {
  outline: { inputMultiplier: 0.5, outputMultiplier: 2.0 },    // ~500 in, ~2000 out
  planning: { inputMultiplier: 2.0, outputMultiplier: 1.5 },   // ~2000 in, ~1500 out per chapter
  writing: { inputMultiplier: 3.0, outputMultiplier: 4.0 },    // ~3000 in, ~4000 out per chapter
  editing: { inputMultiplier: 5.0, outputMultiplier: 1.0 },    // ~5000 in (full chapter), ~1000 out
  continuity: { inputMultiplier: 4.0, outputMultiplier: 2.0 }, // ~4000 in (summary+chapter), ~2000 out
};

/**
 * Estimate the cost of a generation before running it.
 */
export function estimateCost(config: GenerationConfig): CostEstimate {
  const breakdown: CostEstimate['breakdown'] = [];
  const warnings: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;

  // Average words-to-tokens ratio (~1.3 tokens per word)
  const tokensPerWord = 1.3;
  const avgWordsPerChapter = config.targetWords / config.chaptersCount;
  const baseTokensPerChapter = avgWordsPerChapter * tokensPerWord;

  const steps: { step: string; role: ModelRole; perChapter: boolean }[] = [
    { step: 'outline', role: 'outline', perChapter: false },
    { step: 'planning', role: 'planning', perChapter: true },
    { step: 'writing', role: 'writing', perChapter: true },
    { step: 'editing', role: 'editing', perChapter: true },
    { step: 'continuity', role: 'continuity', perChapter: true },
  ];

  for (const { step, role, perChapter } of steps) {
    const modelConfig = config.models[role];
    if (!modelConfig) {
      warnings.push(`No model configured for "${role}" — skipping cost estimate for this step`);
      continue;
    }

    const pricing = getModelPricing(modelConfig.model);
    if (!pricing) {
      warnings.push(`No pricing data for model "${modelConfig.model}" — cost may be inaccurate`);
      continue;
    }

    const multipliers = TOKENS_PER_STEP[step] ?? { inputMultiplier: 2.0, outputMultiplier: 2.0 };
    const iterations = perChapter ? config.chaptersCount : 1;
    // Account for edit cycles (editing + rewriting)
    const editMultiplier = step === 'editing' || step === 'writing'
      ? 1 + (config.maxEditCycles * 0.3) // assume 30% of chapters need edits
      : 1;

    const inputTokens = Math.round(baseTokensPerChapter * multipliers.inputMultiplier * iterations * editMultiplier);
    const outputTokens = Math.round(baseTokensPerChapter * multipliers.outputMultiplier * iterations * editMultiplier);

    const cost = calculateCost(modelConfig.model, {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
    });

    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;
    totalCost += cost;

    breakdown.push({
      step,
      model: modelConfig.model,
      estimatedCost: Number(cost.toFixed(4)),
    });
  }

  return {
    estimatedInputTokens: totalInputTokens,
    estimatedOutputTokens: totalOutputTokens,
    estimatedCost: Number(totalCost.toFixed(4)),
    breakdown,
    warnings,
  };
}

/**
 * Tracks actual costs during generation
 */
export class CostTracker {
  private entries: CostEntry[] = [];

  trackUsage(
    step: string,
    modelId: string,
    usage: { promptTokens: number; completionTokens: number },
  ): CostEntry {
    const cost = calculateCost(modelId, usage);
    const entry: CostEntry = {
      step,
      model: modelId,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      cost,
    };
    this.entries.push(entry);
    return entry;
  }

  getTotalCost(): number {
    return Number(this.entries.reduce((sum, e) => sum + e.cost, 0).toFixed(6));
  }

  getEntries(): CostEntry[] {
    return [...this.entries];
  }

  getBreakdownByStep(): Record<string, { cost: number; inputTokens: number; outputTokens: number }> {
    const breakdown: Record<string, { cost: number; inputTokens: number; outputTokens: number }> = {};
    for (const entry of this.entries) {
      if (!breakdown[entry.step]) {
        breakdown[entry.step] = { cost: 0, inputTokens: 0, outputTokens: 0 };
      }
      breakdown[entry.step].cost += entry.cost;
      breakdown[entry.step].inputTokens += entry.inputTokens;
      breakdown[entry.step].outputTokens += entry.outputTokens;
    }
    return breakdown;
  }

  reset(): void {
    this.entries = [];
  }
}
