import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateObject } from 'ai';
import { outlineNode } from '../../graph/nodes/outline.js';
import { ProviderRegistry } from '../../providers/registry.js';
import type { GenerationConfig, Outline } from '../../types.js';

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

// Mock providers
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => (modelId: string) => ({ modelId, provider: 'openai' })),
}));
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => (modelId: string) => ({ modelId, provider: 'anthropic' })),
}));
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => (modelId: string) => ({ modelId, provider: 'google' })),
}));
vi.mock('@ai-sdk/azure', () => ({
  createAzure: vi.fn(() => {
    const provider = (modelId: string) => ({ modelId, provider: 'azure' });
    provider.chat = (modelId: string) => ({ modelId, provider: 'azure' });
    return provider;
  }),
}));

const mockOutline: Outline = {
  title: 'Test Story',
  synopsis: 'A test synopsis about testing',
  themes: ['perseverance', 'technology'],
  targetAudience: 'developers',
  chapters: [
    {
      number: 1,
      title: 'The Beginning',
      summary: 'The story begins',
      targetWords: 3000,
      keyEvents: ['Introduction'],
      characters: ['Alice'],
    },
    {
      number: 2,
      title: 'The Middle',
      summary: 'Things get complicated',
      targetWords: 3000,
      keyEvents: ['Conflict'],
      characters: ['Alice', 'Bob'],
    },
  ],
  characters: [
    {
      name: 'Alice',
      role: 'protagonist',
      description: 'A skilled developer',
      traits: ['determined'],
      arc: 'Growth',
    },
  ],
};

describe('outlineNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateObject).mockResolvedValue({
      object: mockOutline,
      usage: { promptTokens: 500, completionTokens: 1500 },
    } as any);
  });

  const mockConfig: GenerationConfig = {
    contentType: 'novel',
    targetWords: 6000,
    chaptersCount: 2,
    maxEditCycles: 3,
    humanReview: false,
    models: {
      outline: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 8192 },
    },
  };

  const mockState = {
    title: 'Test Story',
    description: 'A story about testing',
    config: mockConfig,
    currentPhase: 'idle',
    currentChapter: 0,
    outline: null,
    currentDetailedPlan: null,
    currentDraft: '',
    currentEditResult: null,
    editCount: 0,
    chapters: [],
    rollingSummary: '',
    characterStates: [],
    costs: [],
    totalWordsWritten: 0,
    previousChapterEnding: '',
    humanFeedback: null,
    pendingEvents: [],
  };

  it('should generate an outline and return updated state', async () => {
    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test-key' } },
      { outline: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 8192 } },
    );

    const result = await outlineNode(mockState, {
      configurable: { registry },
    } as any);

    expect(result.outline).toEqual(mockOutline);
    expect(result.currentPhase).toBe('planning');
    expect(result.currentChapter).toBe(1);
  });

  it('should track costs', async () => {
    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test-key' } },
      { outline: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 8192 } },
    );

    const result = await outlineNode(mockState, {
      configurable: { registry },
    } as any);

    expect(result.costs).toHaveLength(1);
    expect(result.costs![0].step).toBe('outline');
    expect(result.costs![0].model).toBe('gpt-4.1');
    expect(result.costs![0].inputTokens).toBe(500);
    expect(result.costs![0].outputTokens).toBe(1500);
  });

  it('should emit outline_complete event', async () => {
    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test-key' } },
      { outline: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 8192 } },
    );

    const result = await outlineNode(mockState, {
      configurable: { registry },
    } as any);

    expect(result.pendingEvents).toHaveLength(1);
    expect(result.pendingEvents![0].type).toBe('outline_complete');
  });

  it('should call generateObject with correct parameters', async () => {
    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test-key' } },
      { outline: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 8192 } },
    );

    await outlineNode(mockState, {
      configurable: { registry },
    } as any);

    expect(vi.mocked(generateObject)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(generateObject).mock.calls[0][0];
    expect(call.system).toContain('novel');
    expect(call.prompt).toContain('Test Story');
  });
});
