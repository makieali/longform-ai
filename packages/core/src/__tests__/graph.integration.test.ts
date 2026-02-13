import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText, generateObject } from 'ai';
import { createBookGraph } from '../graph/book-graph.js';
import type { Outline, DetailedChapterPlan, EditResult } from '../types.js';
import { ProviderRegistry } from '../providers/registry.js';

// Mock all AI SDK modules
vi.mock('ai', () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
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

const mockOutline: Outline = {
  title: 'Test Story',
  synopsis: 'A short test story',
  themes: ['technology'],
  targetAudience: 'developers',
  chapters: [
    { number: 1, title: 'Chapter 1', summary: 'Beginning', targetWords: 1000, keyEvents: ['Start'], characters: ['Alice'] },
    { number: 2, title: 'Chapter 2', summary: 'End', targetWords: 1000, keyEvents: ['End'], characters: ['Alice'] },
  ],
  characters: [
    { name: 'Alice', role: 'protagonist', description: 'A developer', traits: ['smart'], arc: 'Growth' },
  ],
};

const mockPlan: DetailedChapterPlan = {
  chapterNumber: 1,
  title: 'Chapter 1',
  scenes: [{ number: 1, setting: 'Office', characters: ['Alice'], objective: 'Intro', conflict: 'Bug', resolution: 'Fix', targetWords: 1000 }],
  pov: 'Third person',
  tone: 'Professional',
  targetWords: 1000,
  bridgeFromPrevious: '',
  bridgeToNext: 'Next chapter setup',
};

const mockApprovedEdit: EditResult = {
  scores: { prose: 8, plot: 8, character: 7, pacing: 8, dialogue: 7, overall: 8 },
  editNotes: ['Good work'],
  approved: true,
};

describe('Graph Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    let objectCallCount = 0;

    // generateObject handles structured output (outline, planner, editor)
    vi.mocked(generateObject).mockImplementation(async (opts: any) => {
      objectCallCount++;
      const prompt = (opts.prompt || '') + ' ' + (opts.system || '');

      // Distinguish by schema shape (most reliable) or prompt content
      const schemaShape = opts.schema?._def?.shape?.() || opts.schema?.shape;
      const hasScenes = schemaShape?.scenes !== undefined;
      const hasChapters = schemaShape?.chapters !== undefined;
      const hasEditNotes = schemaShape?.editNotes !== undefined;

      if (hasScenes) {
        // DetailedChapterPlanSchema — planner node
        return {
          object: { ...mockPlan, chapterNumber: objectCallCount <= 3 ? 1 : 2 },
          usage: { promptTokens: 800, completionTokens: 600 },
        } as any;
      }

      if (hasEditNotes) {
        // EditResultSchema — editor node
        return {
          object: mockApprovedEdit,
          usage: { promptTokens: 2000, completionTokens: 400 },
        } as any;
      }

      if (hasChapters) {
        // OutlineSchema — outline node
        return {
          object: mockOutline,
          usage: { promptTokens: 500, completionTokens: 1500 },
        } as any;
      }

      // Fallback: use prompt content matching
      if (prompt.includes('outline') || prompt.includes('Outline')) {
        return {
          object: mockOutline,
          usage: { promptTokens: 500, completionTokens: 1500 },
        } as any;
      }

      if (prompt.includes('writing plan') || prompt.includes('Break this chapter')) {
        return {
          object: { ...mockPlan, chapterNumber: objectCallCount <= 3 ? 1 : 2 },
          usage: { promptTokens: 800, completionTokens: 600 },
        } as any;
      }

      if (prompt.includes('Review') || prompt.includes('Evaluate')) {
        return {
          object: mockApprovedEdit,
          usage: { promptTokens: 2000, completionTokens: 400 },
        } as any;
      }

      // Default fallback
      return {
        object: mockOutline,
        usage: { promptTokens: 100, completionTokens: 100 },
      } as any;
    });

    // generateText handles plain text calls (writing, continuity, summary extraction)
    vi.mocked(generateText).mockImplementation(async (opts: any) => {
      const prompt = opts.prompt || '';

      if (prompt.includes('Write Chapter') || prompt.includes('Write the complete')) {
        return {
          text: 'Alice walked into the office. The screens glowed in the dim light. She sat down and began to work on the mysterious bug that had plagued the system for weeks. Her fingers danced across the keyboard as she traced the error through layers of code.',
          usage: { promptTokens: 1500, completionTokens: 2000 },
        } as any;
      }

      if (prompt.includes('summary') || prompt.includes('Summary') || prompt.includes('Provide a concise summary')) {
        return {
          text: 'Alice investigated the mysterious system bug at the office.',
          usage: { promptTokens: 500, completionTokens: 100 },
        } as any;
      }

      if (prompt.includes('rolling summary') || prompt.includes('Rolling Summary') || prompt.includes('Update the rolling')) {
        return {
          text: 'Chapter 1: Alice discovered a mysterious bug in the system. She is investigating further.',
          usage: { promptTokens: 1000, completionTokens: 300 },
        } as any;
      }

      // Default fallback
      return {
        text: 'Generated content',
        usage: { promptTokens: 100, completionTokens: 100 },
      } as any;
    });
  });

  it('should create a compiled graph', () => {
    const graph = createBookGraph();
    expect(graph).toBeDefined();
    // The compiled graph should have an invoke method
    expect(typeof graph.invoke).toBe('function');
  });

  it('should run a 2-chapter generation end-to-end', async () => {
    const graph = createBookGraph();

    const registry = new ProviderRegistry(
      { openai: { apiKey: 'test' }, google: { apiKey: 'test' } },
      {
        outline: { provider: 'openai', model: 'gpt-4.1', temperature: 0.7, maxTokens: 8192 },
        planning: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 },
        writing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.8, maxTokens: 8192 },
        editing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.3, maxTokens: 4096 },
        continuity: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 4096 },
      },
    );

    const result = await graph.invoke(
      {
        title: 'Test Story',
        description: 'A story about testing',
        config: {
          contentType: 'novel',
          targetWords: 2000,
          chaptersCount: 2,
          maxEditCycles: 1,
          humanReview: false,
          models: {},
        },
      },
      {
        configurable: {
          registry,
          thread_id: 'test-thread-1',
        },
      },
    );

    // Should have completed with chapters
    expect(result.chapters.length).toBeGreaterThanOrEqual(1);
    expect(result.outline).toBeDefined();
    expect(result.outline.title).toBe('Test Story');
    expect(result.costs.length).toBeGreaterThan(0);
  }, 30000);
});
