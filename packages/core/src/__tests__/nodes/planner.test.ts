import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateObject } from 'ai';
import { plannerNode } from '../../graph/nodes/planner.js';
import { ProviderRegistry } from '../../providers/registry.js';
import type { GenerationConfig, Outline, DetailedChapterPlan } from '../../types.js';

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

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

const mockDetailedPlan: DetailedChapterPlan = {
  chapterNumber: 1,
  title: 'The Beginning',
  scenes: [
    {
      number: 1,
      setting: 'A dark office',
      characters: ['Alice'],
      objective: 'Introduce Alice',
      conflict: 'System crash',
      resolution: 'Alice investigates',
      targetWords: 1500,
    },
    {
      number: 2,
      setting: 'Server room',
      characters: ['Alice', 'Bob'],
      objective: 'Discover the bug',
      conflict: 'Disagreement on approach',
      resolution: 'Collaboration',
      targetWords: 1500,
    },
  ],
  pov: 'Third person limited',
  tone: 'Mysterious yet hopeful',
  targetWords: 3000,
  bridgeFromPrevious: '',
  bridgeToNext: 'Alice discovers a pattern in the data',
};

const mockOutline: Outline = {
  title: 'Test Story',
  synopsis: 'A test synopsis',
  themes: ['technology'],
  targetAudience: 'developers',
  chapters: [
    { number: 1, title: 'The Beginning', summary: 'Story begins', targetWords: 3000, keyEvents: ['Intro'], characters: ['Alice'] },
    { number: 2, title: 'The Middle', summary: 'Complications', targetWords: 3000, keyEvents: ['Conflict'], characters: ['Alice', 'Bob'] },
    { number: 3, title: 'The End', summary: 'Resolution', targetWords: 3000, keyEvents: ['Climax'], characters: ['Alice'] },
  ],
  characters: [
    { name: 'Alice', role: 'protagonist', description: 'Developer', traits: ['smart'], arc: 'Growth' },
  ],
};

describe('plannerNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateObject).mockResolvedValue({
      object: mockDetailedPlan,
      usage: { promptTokens: 1000, completionTokens: 800 },
    } as any);
  });

  const mockConfig: GenerationConfig = {
    contentType: 'novel',
    targetWords: 9000,
    chaptersCount: 3,
    maxEditCycles: 3,
    humanReview: false,
    models: {
      planning: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 },
    },
  };

  const makeState = (chapter: number, summary = '') => ({
    title: 'Test Story',
    description: 'A story about testing',
    config: mockConfig,
    currentPhase: 'planning',
    currentChapter: chapter,
    outline: mockOutline,
    currentDetailedPlan: null,
    currentDraft: '',
    currentEditResult: null,
    editCount: 0,
    chapters: [],
    rollingSummary: summary,
    characterStates: [],
    costs: [],
    totalWordsWritten: 0,
    previousChapterEnding: '',
    humanFeedback: null,
    pendingEvents: [],
  });

  it('should generate a detailed plan for the current chapter', async () => {
    const registry = new ProviderRegistry(
      { google: { apiKey: 'test-key' } },
      { planning: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 } },
    );

    const result = await plannerNode(makeState(1), {
      configurable: { registry },
    } as any);

    expect(result.currentDetailedPlan).toEqual(mockDetailedPlan);
    expect(result.currentPhase).toBe('writing');
    expect(result.editCount).toBe(0);
  });

  it('should reset edit state for new chapter', async () => {
    const registry = new ProviderRegistry(
      { google: { apiKey: 'test-key' } },
      { planning: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 } },
    );

    const result = await plannerNode(makeState(2), {
      configurable: { registry },
    } as any);

    expect(result.editCount).toBe(0);
    expect(result.currentEditResult).toBeNull();
  });

  it('should use rolling summary when available', async () => {
    const registry = new ProviderRegistry(
      { google: { apiKey: 'test-key' } },
      { planning: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 } },
    );

    await plannerNode(makeState(2, 'Chapter 1 summary...'), {
      configurable: { registry },
    } as any);

    const call = vi.mocked(generateObject).mock.calls[0][0];
    expect(call.prompt).toContain('Chapter 1 summary...');
  });

  it('should track costs', async () => {
    const registry = new ProviderRegistry(
      { google: { apiKey: 'test-key' } },
      { planning: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 } },
    );

    const result = await plannerNode(makeState(1), {
      configurable: { registry },
    } as any);

    expect(result.costs).toHaveLength(1);
    expect(result.costs![0].step).toBe('planning');
  });

  it('should emit chapter_started event', async () => {
    const registry = new ProviderRegistry(
      { google: { apiKey: 'test-key' } },
      { planning: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 } },
    );

    const result = await plannerNode(makeState(1), {
      configurable: { registry },
    } as any);

    expect(result.pendingEvents).toHaveLength(1);
    expect(result.pendingEvents![0].type).toBe('chapter_started');
    expect(result.pendingEvents![0].chapter).toBe(1);
  });
});
