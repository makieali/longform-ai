import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateObject } from 'ai';
import { editorNode } from '../../graph/nodes/editor.js';
import { ProviderRegistry } from '../../providers/registry.js';
import type { GenerationConfig, EditResult, DetailedChapterPlan, Outline } from '../../types.js';

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

const approvedResult: EditResult = {
  scores: { prose: 8, plot: 8, character: 7, pacing: 8, dialogue: 7, overall: 8 },
  editNotes: ['Strong opening', 'Good character voice'],
  approved: true,
};

const rejectedResult: EditResult = {
  scores: { prose: 5, plot: 6, character: 4, pacing: 5, dialogue: 5, overall: 5 },
  editNotes: ['Pacing is slow', 'Characters feel flat'],
  approved: false,
  rewriteInstructions: 'Add more conflict, deepen character interactions',
};

const mockOutline: Outline = {
  title: 'Test',
  synopsis: 'A test story',
  themes: ['technology'],
  targetAudience: 'developers',
  chapters: [{ number: 1, title: 'Ch1', summary: 'Summary', targetWords: 3000, keyEvents: [], characters: [] }],
  characters: [],
};

const mockPlan: DetailedChapterPlan = {
  chapterNumber: 1,
  title: 'The Beginning',
  scenes: [{ number: 1, setting: 'Office', characters: ['Alice'], objective: 'Intro', conflict: 'Bug', resolution: 'Fix', targetWords: 3000 }],
  pov: 'Third person',
  tone: 'Mysterious',
  targetWords: 3000,
  bridgeFromPrevious: '',
  bridgeToNext: 'Discovery',
};

describe('editorNode', () => {
  const mockConfig: GenerationConfig = {
    contentType: 'novel',
    targetWords: 6000,
    chaptersCount: 2,
    maxEditCycles: 3,
    humanReview: false,
    models: {
      editing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.3, maxTokens: 4096 },
    },
  };

  const makeState = (overrides = {}) => ({
    title: 'Test',
    description: 'Test story',
    config: mockConfig,
    currentPhase: 'editing',
    currentChapter: 1,
    outline: mockOutline,
    currentDetailedPlan: mockPlan,
    currentDraft: 'Alice sat at her desk, staring at the screen...',
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
    ...overrides,
  });

  it('should approve a high-quality chapter', async () => {
    vi.clearAllMocks();
    vi.mocked(generateObject).mockResolvedValue({
      object: approvedResult,
      usage: { promptTokens: 4000, completionTokens: 500 },
    } as any);

    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test' } },
      { editing: mockConfig.models.editing! },
    );

    const result = await editorNode(makeState(), {
      configurable: { registry },
    } as any);

    expect(result.currentEditResult!.approved).toBe(true);
    expect(result.currentPhase).toBe('continuity');
    expect(result.editCount).toBe(1);
  });

  it('should reject a low-quality chapter', async () => {
    vi.clearAllMocks();
    vi.mocked(generateObject).mockResolvedValue({
      object: rejectedResult,
      usage: { promptTokens: 4000, completionTokens: 600 },
    } as any);

    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test' } },
      { editing: mockConfig.models.editing! },
    );

    const result = await editorNode(makeState(), {
      configurable: { registry },
    } as any);

    expect(result.currentEditResult!.approved).toBe(false);
    expect(result.currentPhase).toBe('writing');
    expect(result.currentEditResult!.rewriteInstructions).toBeDefined();
  });

  it('should increment edit count', async () => {
    vi.clearAllMocks();
    vi.mocked(generateObject).mockResolvedValue({
      object: rejectedResult,
      usage: { promptTokens: 4000, completionTokens: 600 },
    } as any);

    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test' } },
      { editing: mockConfig.models.editing! },
    );

    const result = await editorNode(makeState({ editCount: 1 }), {
      configurable: { registry },
    } as any);

    expect(result.editCount).toBe(2);
  });

  it('should track costs', async () => {
    vi.clearAllMocks();
    vi.mocked(generateObject).mockResolvedValue({
      object: approvedResult,
      usage: { promptTokens: 4000, completionTokens: 500 },
    } as any);

    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test' } },
      { editing: mockConfig.models.editing! },
    );

    const result = await editorNode(makeState(), {
      configurable: { registry },
    } as any);

    expect(result.costs).toHaveLength(1);
    expect(result.costs![0].step).toBe('editing');
    expect(result.costs![0].model).toBe('gpt-4.1');
  });

  it('should emit edit_cycle event with scores', async () => {
    vi.clearAllMocks();
    vi.mocked(generateObject).mockResolvedValue({
      object: approvedResult,
      usage: { promptTokens: 4000, completionTokens: 500 },
    } as any);

    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test' } },
      { editing: mockConfig.models.editing! },
    );

    const result = await editorNode(makeState(), {
      configurable: { registry },
    } as any);

    expect(result.pendingEvents).toHaveLength(1);
    expect(result.pendingEvents![0].type).toBe('edit_cycle');
    expect(result.pendingEvents![0].approved).toBe(true);
    expect(result.pendingEvents![0].scores).toBeDefined();
  });
});
