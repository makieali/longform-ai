import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOpenAI } from '@ai-sdk/openai';
import { ProviderRegistry } from '../providers/registry.js';
import { resolvePreset, getPresetNames, getPreset } from '../providers/presets.js';
import { calculateCost, getModelPricing, COST_TABLE } from '../providers/cost-table.js';

// Mock the AI SDK providers
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => {
    const provider = (modelId: string) => ({
      modelId,
      provider: 'openai',
      specificationVersion: 'v1',
    });
    return provider;
  }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => {
    const provider = (modelId: string) => ({
      modelId,
      provider: 'anthropic',
      specificationVersion: 'v1',
    });
    return provider;
  }),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => {
    const provider = (modelId: string) => ({
      modelId,
      provider: 'google',
      specificationVersion: 'v1',
    });
    return provider;
  }),
}));

vi.mock('@ai-sdk/azure', () => ({
  createAzure: vi.fn(() => {
    const provider = (modelId: string) => ({
      modelId,
      provider: 'azure',
      specificationVersion: 'v1',
    });
    provider.chat = (modelId: string) => ({
      modelId,
      provider: 'azure',
      specificationVersion: 'v1',
    });
    return provider;
  }),
}));

describe('ProviderRegistry', () => {
  it('should create a model for a configured role', () => {
    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test-key' } },
      { writing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 4096 } },
    );
    const model = registry.getModel('writing');
    expect(model).toBeDefined();
    expect((model as any).modelId).toBe('gpt-4.1');
  });

  it('should throw for unconfigured role', () => {
    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test-key' } },
      {},
    );
    expect(() => registry.getModel('writing')).toThrow('No model configured for role "writing"');
  });

  it('should throw for missing API key', () => {
    const registry = new ProviderRegistry(
      {},
      { writing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 4096 } },
    );
    expect(() => registry.getModel('writing')).toThrow('No API key found for provider "openai"');
  });

  it('should not require API key for ollama', () => {
    const registry = new ProviderRegistry(
      {},
      { writing: { provider: 'ollama', model: 'llama3', temperature: 0.7, maxTokens: 4096 } },
    );
    expect(() => registry.getModel('writing')).not.toThrow();
  });

  it('should return model ID for a role', () => {
    const registry = new ProviderRegistry(
      { anthropic: { apiKey: 'test-key' } },
      { editing: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.3, maxTokens: 4096 } },
    );
    expect(registry.getModelId('editing')).toBe('claude-sonnet-4-5-20250929');
  });

  it('should check if role has model', () => {
    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test-key' } },
      { writing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 4096 } },
    );
    expect(registry.hasModel('writing')).toBe(true);
    expect(registry.hasModel('editing')).toBe(false);
  });

  it('should list configured roles', () => {
    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test-key' } },
      {
        writing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 4096 },
        editing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.3, maxTokens: 4096 },
      },
    );
    const roles = registry.getConfiguredRoles();
    expect(roles).toContain('writing');
    expect(roles).toContain('editing');
    expect(roles).toHaveLength(2);
  });

  it('should cache provider factories', () => {
    vi.mocked(createOpenAI).mockClear();

    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test-key' } },
      {
        writing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 4096 },
        editing: { provider: 'openai', model: 'gpt-4.1-mini', temperature: 0.3, maxTokens: 4096 },
      },
    );
    // Both use openai — factory should be reused
    registry.getModel('writing');
    registry.getModel('editing');
    // If it didn't cache, it would create 2 factories
    expect(vi.mocked(createOpenAI)).toHaveBeenCalledTimes(1);
  });

  it('should create Azure provider with API key', () => {
    const registry = new ProviderRegistry(
      { azure: { apiKey: 'azure-key', endpoint: 'https://test.openai.azure.com/' } },
      { writing: { provider: 'azure', model: 'gpt-4o-deployment' } },
    );
    const model = registry.getModel('writing');
    expect(model).toBeDefined();
    expect((model as any).modelId).toBe('gpt-4o-deployment');
  });

  it('should resolve Azure preset', () => {
    const models = resolvePreset('azure');
    expect(models.outline.provider).toBe('azure');
    expect(models.writing.provider).toBe('azure');
    expect(models.editing.provider).toBe('azure');
  });
});

describe('Presets', () => {
  it('should resolve budget preset', () => {
    const models = resolvePreset('budget');
    expect(models.writing.provider).toBe('google');
    expect(models.writing.model).toBe('gemini-2.0-flash');
  });

  it('should resolve balanced preset', () => {
    const models = resolvePreset('balanced');
    expect(models.writing.provider).toBe('anthropic');
    expect(models.editing.provider).toBe('openai');
  });

  it('should resolve premium preset', () => {
    const models = resolvePreset('premium');
    expect(models.writing.model).toBe('claude-opus-4-6');
  });

  it('should allow overrides', () => {
    const models = resolvePreset('budget', {
      writing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.8, maxTokens: 8192 },
    });
    expect(models.writing.provider).toBe('openai');
    expect(models.writing.model).toBe('gpt-4.1');
    // Other roles still use budget defaults
    expect(models.editing.provider).toBe('google');
  });

  it('should throw for unknown preset', () => {
    expect(() => resolvePreset('ultra' as any)).toThrow('Unknown preset');
  });

  it('should list preset names', () => {
    expect(getPresetNames()).toEqual(['budget', 'balanced', 'premium', 'azure']);
  });
});

describe('Cost Table', () => {
  it('should have pricing for major models', () => {
    expect(getModelPricing('gpt-4.1')).toBeDefined();
    expect(getModelPricing('claude-sonnet-4-5-20250929')).toBeDefined();
    expect(getModelPricing('gemini-2.0-flash')).toBeDefined();
  });

  it('should return undefined for unknown models', () => {
    expect(getModelPricing('nonexistent-model')).toBeUndefined();
  });

  it('should calculate cost correctly', () => {
    const cost = calculateCost('gpt-4.1', {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });
    // gpt-4.1: $2/M input + $8/M output = $10
    expect(cost).toBe(10);
  });

  it('should return 0 for unknown models', () => {
    const cost = calculateCost('unknown-model', { promptTokens: 1000, completionTokens: 1000 });
    expect(cost).toBe(0);
  });

  it('should handle small token counts', () => {
    const cost = calculateCost('gpt-4.1', {
      promptTokens: 1000,
      completionTokens: 500,
    });
    // $2/M * 0.001 + $8/M * 0.0005 = $0.002 + $0.004 = $0.006
    expect(cost).toBeCloseTo(0.006, 4);
  });
});
