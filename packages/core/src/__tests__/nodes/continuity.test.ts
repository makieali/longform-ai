import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText } from 'ai';
import { continuityNode } from '../../graph/nodes/continuity.js';
import { ProviderRegistry } from '../../providers/registry.js';
import type { GenerationConfig, Outline, DetailedChapterPlan } from '../../types.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

vi.mock('@langchain/langgraph', () => {
  // Annotation must be callable (Annotation<T>({reducer, default})) AND have .Root
  const Annotation = Object.assign(
    (config?: any) => config?.default?.() ?? undefined,
    { Root: (schema: any) => ({ State: {}, spec: schema }) },
  );
  return {
    Annotation,
    StateGraph: vi.fn().mockImplementation(() => ({
      addNode: vi.fn().mockReturnThis(),
      addEdge: vi.fn().mockReturnThis(),
      addConditionalEdges: vi.fn().mockReturnThis(),
      compile: vi.fn().mockReturnValue({ invoke: vi.fn() }),
    })),
    START: '__start__',
    END: '__end__',
    interrupt: vi.fn(),
  };
});

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
  title: 'Test',
  synopsis: 'A test story',
  themes: ['tech'],
  targetAudience: 'developers',
  chapters: [
    { number: 1, title: 'Ch1', summary: 'S1', targetWords: 3000, keyEvents: [], characters: [] },
    { number: 2, title: 'Ch2', summary: 'S2', targetWords: 3000, keyEvents: [], characters: [] },
  ],
  characters: [],
};

const mockPlan: DetailedChapterPlan = {
  chapterNumber: 1,
  title: 'Chapter One',
  scenes: [{ number: 1, setting: 'Office', characters: ['Alice'], objective: 'Intro', conflict: 'Bug', resolution: 'Fix', targetWords: 3000 }],
  pov: 'Third person',
  tone: 'Mysterious',
  targetWords: 3000,
  bridgeFromPrevious: '',
  bridgeToNext: 'Discovery',
};

describe('continuityNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateText).mockResolvedValue({
      text: 'Updated rolling summary: Alice discovered the bug in chapter 1. She is now investigating the pattern.',
      usage: { promptTokens: 3000, completionTokens: 500 },
    } as any);
  });

  const mockConfig: GenerationConfig = {
    contentType: 'novel',
    targetWords: 6000,
    chaptersCount: 2,
    maxEditCycles: 3,
    humanReview: false,
    models: {
      continuity: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 4096 },
    },
  };

  const makeState = (overrides = {}) => ({
    title: 'Test',
    description: 'Test story',
    config: mockConfig,
    currentPhase: 'continuity',
    currentChapter: 1,
    outline: mockOutline,
    currentDetailedPlan: mockPlan,
    currentDraft: 'Alice sat at her desk. '.repeat(100), // ~600 words
    currentEditResult: { scores: { prose: 8, plot: 8, character: 7, pacing: 8, dialogue: 7, overall: 8 }, editNotes: [], approved: true },
    editCount: 1,
    chapters: [],
    rollingSummary: '',
    characterStates: [],
    costs: [],
    totalWordsWritten: 0,
    previousChapterEnding: '',
    humanFeedback: null,
    pendingEvents: [],
    ...overrides,
  });

  it('should add completed chapter and advance to next', async () => {
    const registry = new ProviderRegistry(
      { google: { apiKey: 'test' } },
      { continuity: mockConfig.models.continuity! },
    );

    const result = await continuityNode(makeState(), {
      configurable: { registry },
    } as any);

    expect(result.chapters).toHaveLength(1);
    expect(result.chapters![0].number).toBe(1);
    expect(result.chapters![0].approved).toBe(true);
    expect(result.currentChapter).toBe(2);
    expect(result.currentPhase).toBe('planning'); // more chapters remain
  });

  it('should set phase to complete on last chapter', async () => {
    const registry = new ProviderRegistry(
      { google: { apiKey: 'test' } },
      { continuity: mockConfig.models.continuity! },
    );

    const result = await continuityNode(makeState({ currentChapter: 2 }), {
      configurable: { registry },
    } as any);

    expect(result.currentChapter).toBe(3);
    expect(result.currentPhase).toBe('complete');
  });

  it('should update rolling summary', async () => {
    const registry = new ProviderRegistry(
      { google: { apiKey: 'test' } },
      { continuity: mockConfig.models.continuity! },
    );

    const result = await continuityNode(makeState(), {
      configurable: { registry },
    } as any);

    expect(result.rollingSummary).toContain('Alice discovered the bug');
  });

  it('should track word count', async () => {
    const registry = new ProviderRegistry(
      { google: { apiKey: 'test' } },
      { continuity: mockConfig.models.continuity! },
    );

    const result = await continuityNode(makeState(), {
      configurable: { registry },
    } as any);

    expect(result.totalWordsWritten).toBeGreaterThan(0);
  });

  it('should emit chapter_complete event', async () => {
    const registry = new ProviderRegistry(
      { google: { apiKey: 'test' } },
      { continuity: mockConfig.models.continuity! },
    );

    const result = await continuityNode(makeState(), {
      configurable: { registry },
    } as any);

    expect(result.pendingEvents).toHaveLength(1);
    expect(result.pendingEvents![0].type).toBe('chapter_complete');
    expect(result.pendingEvents![0].chapter).toBe(1);
  });
});
