import { describe, it, expect } from 'vitest';
import { estimateCost, CostTracker } from '../cost/estimator.js';
import type { GenerationConfig } from '../types.js';

describe('estimateCost', () => {
  it('should estimate cost for a full config', () => {
    const config: GenerationConfig = {
      contentType: 'novel',
      targetWords: 50000,
      chaptersCount: 20,
      maxEditCycles: 3,
      humanReview: false,
      models: {
        outline: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 8192 },
        planning: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 },
        writing: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.8, maxTokens: 8192 },
        editing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.3, maxTokens: 4096 },
        continuity: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 4096 },
      },
    };

    const estimate = estimateCost(config);
    expect(estimate.estimatedCost).toBeGreaterThan(0);
    expect(estimate.breakdown).toHaveLength(5);
    expect(estimate.estimatedInputTokens).toBeGreaterThan(0);
    expect(estimate.estimatedOutputTokens).toBeGreaterThan(0);
    expect(estimate.warnings).toHaveLength(0);
  });

  it('should warn about missing model configs', () => {
    const config: GenerationConfig = {
      contentType: 'novel',
      targetWords: 50000,
      chaptersCount: 20,
      maxEditCycles: 3,
      humanReview: false,
      models: {},
    };

    const estimate = estimateCost(config);
    expect(estimate.warnings.length).toBeGreaterThan(0);
    expect(estimate.estimatedCost).toBe(0);
  });

  it('should warn about models without pricing', () => {
    const config: GenerationConfig = {
      contentType: 'novel',
      targetWords: 10000,
      chaptersCount: 5,
      maxEditCycles: 1,
      humanReview: false,
      models: {
        writing: { provider: 'ollama', model: 'llama3-custom', temperature: 0.7, maxTokens: 4096 },
      },
    };

    const estimate = estimateCost(config);
    expect(estimate.warnings.some(w => w.includes('No pricing data'))).toBe(true);
  });

  it('should scale cost with chapter count', () => {
    const baseConfig: GenerationConfig = {
      contentType: 'novel',
      targetWords: 10000,
      chaptersCount: 5,
      maxEditCycles: 1,
      humanReview: false,
      models: {
        writing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 4096 },
      },
    };

    const doubledConfig = { ...baseConfig, chaptersCount: 10, targetWords: 20000 };

    const base = estimateCost(baseConfig);
    const doubled = estimateCost(doubledConfig);

    // With doubled chapters and words, cost should roughly double
    expect(doubled.estimatedCost).toBeGreaterThan(base.estimatedCost * 1.5);
  });
});

describe('CostTracker', () => {
  it('should track usage entries', () => {
    const tracker = new CostTracker();
    tracker.trackUsage('outline', 'gpt-4.1', { promptTokens: 1000, completionTokens: 2000 });
    tracker.trackUsage('writing', 'claude-sonnet-4-5-20250929', { promptTokens: 3000, completionTokens: 4000 });

    const entries = tracker.getEntries();
    expect(entries).toHaveLength(2);
    expect(tracker.getTotalCost()).toBeGreaterThan(0);
  });

  it('should provide breakdown by step', () => {
    const tracker = new CostTracker();
    tracker.trackUsage('writing', 'gpt-4.1', { promptTokens: 1000, completionTokens: 2000 });
    tracker.trackUsage('writing', 'gpt-4.1', { promptTokens: 1500, completionTokens: 2500 });
    tracker.trackUsage('editing', 'gpt-4.1', { promptTokens: 5000, completionTokens: 1000 });

    const breakdown = tracker.getBreakdownByStep();
    expect(breakdown['writing'].inputTokens).toBe(2500);
    expect(breakdown['writing'].outputTokens).toBe(4500);
    expect(breakdown['editing']).toBeDefined();
  });

  it('should reset correctly', () => {
    const tracker = new CostTracker();
    tracker.trackUsage('outline', 'gpt-4.1', { promptTokens: 1000, completionTokens: 2000 });
    expect(tracker.getEntries()).toHaveLength(1);
    tracker.reset();
    expect(tracker.getEntries()).toHaveLength(0);
    expect(tracker.getTotalCost()).toBe(0);
  });
});
