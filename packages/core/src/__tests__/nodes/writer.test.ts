import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText } from 'ai';
import { writerNode, countWords } from '../../graph/nodes/writer.js';
import { ProviderRegistry } from '../../providers/registry.js';
import type { GenerationConfig, Outline, DetailedChapterPlan } from '../../types.js';

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

const mockPlan: DetailedChapterPlan = {
  chapterNumber: 1,
  title: 'The Beginning',
  scenes: [
    { number: 1, setting: 'Office', characters: ['Alice'], objective: 'Introduce', conflict: 'Bug', resolution: 'Fix', targetWords: 1500 },
  ],
  pov: 'Third person',
  tone: 'Mysterious',
  targetWords: 3000,
  bridgeFromPrevious: '',
  bridgeToNext: 'Discovery',
};

// Generate a text with roughly the specified word count
function generateLongText(words: number): string {
  const sentence = 'The quick brown fox jumped over the lazy dog near the old barn. ';
  const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 0).length;
  const repeats = Math.ceil(words / sentenceWords);
  return Array(repeats).fill(sentence).join('').trim();
}

const shortChapterContent = 'Alice sat at her desk, staring at the screen. The code had been running perfectly for months, but something had changed. She leaned forward, squinting at the terminal output. The error message was unlike anything she had seen before. It was not just a bug — it was a pattern, repeating across multiple systems. She pulled up the logs, her fingers flying across the keyboard.';

const longChapterContent = generateLongText(3200);

describe('writerNode', () => {
  const mockConfig: GenerationConfig = {
    contentType: 'novel',
    targetWords: 6000,
    chaptersCount: 2,
    maxEditCycles: 3,
    humanReview: false,
    models: {
      writing: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.8, maxTokens: 8192 },
      continuity: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 4096 },
    },
  };

  const makeState = (overrides = {}) => ({
    title: 'Test',
    description: 'Test story',
    config: mockConfig,
    currentPhase: 'writing',
    currentChapter: 1,
    outline: { title: 'Test', synopsis: 'Synopsis', themes: ['tech'], targetAudience: 'devs', chapters: [], characters: [] },
    currentDetailedPlan: mockPlan,
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
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate chapter content without expansion when long enough', async () => {
    // Write call returns long content, then summary
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: longChapterContent,
        usage: { promptTokens: 2000, completionTokens: 3000 },
      } as any)
      .mockResolvedValueOnce({
        text: 'Alice discovers a mysterious pattern in the system logs.',
        usage: { promptTokens: 500, completionTokens: 200 },
      } as any);

    const registry = new ProviderRegistry(
      { anthropic: { apiKey: 'test' }, google: { apiKey: 'test' } },
      mockConfig.models as any,
    );

    const result = await writerNode(makeState(), {
      configurable: { registry },
    } as any);

    expect(result.currentDraft).toBe(longChapterContent);
    expect(result.currentPhase).toBe('editing');
    // No expand calls: only 2 generateText calls (write + summary)
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(2);
  });

  it('should trigger expand loop when chapter is too short', async () => {
    const expandedContent = generateLongText(3200);

    vi.mocked(generateText)
      // Initial write: too short
      .mockResolvedValueOnce({
        text: shortChapterContent,
        usage: { promptTokens: 2000, completionTokens: 100 },
      } as any)
      // Expand attempt 1: now long enough
      .mockResolvedValueOnce({
        text: expandedContent,
        usage: { promptTokens: 3000, completionTokens: 4000 },
      } as any)
      // Summary extraction
      .mockResolvedValueOnce({
        text: 'Summary of expanded chapter.',
        usage: { promptTokens: 500, completionTokens: 200 },
      } as any);

    const registry = new ProviderRegistry(
      { anthropic: { apiKey: 'test' }, google: { apiKey: 'test' } },
      mockConfig.models as any,
    );

    const result = await writerNode(makeState(), {
      configurable: { registry },
    } as any);

    // Should have expanded
    expect(result.currentDraft).toBe(expandedContent);
    // 3 calls: write + expand + summary
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(3);
    // Should have expand_attempt event
    const expandEvents = result.pendingEvents!.filter((e: any) => e.type === 'expand_attempt');
    expect(expandEvents).toHaveLength(1);
  });

  it('should emit word_count_warning and stop expanding when model returns shorter content', async () => {
    vi.mocked(generateText)
      // Initial write: too short
      .mockResolvedValueOnce({
        text: shortChapterContent,
        usage: { promptTokens: 2000, completionTokens: 100 },
      } as any)
      // Expand attempt 1: returns even shorter — should break out
      .mockResolvedValueOnce({
        text: 'Too short.',
        usage: { promptTokens: 3000, completionTokens: 10 },
      } as any)
      // Summary
      .mockResolvedValueOnce({
        text: 'Summary.',
        usage: { promptTokens: 500, completionTokens: 200 },
      } as any);

    const registry = new ProviderRegistry(
      { anthropic: { apiKey: 'test' }, google: { apiKey: 'test' } },
      mockConfig.models as any,
    );

    const result = await writerNode(makeState(), {
      configurable: { registry },
    } as any);

    // Should have word_count_warning (still below target)
    const warnings = result.pendingEvents!.filter((e: any) => e.type === 'word_count_warning');
    expect(warnings).toHaveLength(1);
    expect((warnings[0] as any).target).toBe(3000);

    // Should only have 1 expand_attempt (broke out early because model returned shorter)
    const expandEvents = result.pendingEvents!.filter((e: any) => e.type === 'expand_attempt');
    expect(expandEvents).toHaveLength(1);

    // Should keep the original (longer) content, not the shorter expansion
    expect(result.currentDraft).toBe(shortChapterContent);
  });

  it('should track writing costs including successful expansion', async () => {
    // Slightly longer than shortChapterContent but still below target
    const slightlyLonger = shortChapterContent + ' She noticed a faint glow emanating from the server rack in the corner. The temperature in the room seemed to drop several degrees. Something was definitely wrong with the system, and she knew she had to investigate further before anyone else arrived in the morning.';
    const expandedContent = generateLongText(3200);

    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: shortChapterContent,
        usage: { promptTokens: 2000, completionTokens: 100 },
      } as any)
      // First expand: longer but still short
      .mockResolvedValueOnce({
        text: slightlyLonger,
        usage: { promptTokens: 3000, completionTokens: 200 },
      } as any)
      // Second expand: finally long enough
      .mockResolvedValueOnce({
        text: expandedContent,
        usage: { promptTokens: 3000, completionTokens: 4000 },
      } as any)
      .mockResolvedValueOnce({
        text: 'Summary.',
        usage: { promptTokens: 500, completionTokens: 200 },
      } as any);

    const registry = new ProviderRegistry(
      { anthropic: { apiKey: 'test' }, google: { apiKey: 'test' } },
      mockConfig.models as any,
    );

    const result = await writerNode(makeState(), {
      configurable: { registry },
    } as any);

    expect(result.costs!.length).toBe(3); // writing + 2x writing_expand
    expect(result.costs![0].step).toBe('writing');
    expect(result.costs![1].step).toBe('writing_expand');
    expect(result.costs![2].step).toBe('writing_expand');
  });

  it('should pass edit instructions during rewrite', async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: longChapterContent,
        usage: { promptTokens: 2000, completionTokens: 3000 },
      } as any)
      .mockResolvedValueOnce({
        text: 'Summary.',
        usage: { promptTokens: 500, completionTokens: 200 },
      } as any);

    const registry = new ProviderRegistry(
      { anthropic: { apiKey: 'test' }, google: { apiKey: 'test' } },
      mockConfig.models as any,
    );

    await writerNode(
      makeState({
        currentEditResult: {
          scores: { prose: 5, plot: 4, character: 5, pacing: 4, dialogue: 5, overall: 4 },
          editNotes: ['Needs work'],
          approved: false,
          rewriteInstructions: 'Add more tension in the middle section',
        },
        editCount: 1,
      }),
      { configurable: { registry } } as any,
    );

    const call = vi.mocked(generateText).mock.calls[0][0];
    expect(call.prompt).toContain('Add more tension in the middle section');
  });

  it('should emit chapter_written event', async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: longChapterContent,
        usage: { promptTokens: 2000, completionTokens: 3000 },
      } as any)
      .mockResolvedValueOnce({
        text: 'Summary.',
        usage: { promptTokens: 500, completionTokens: 200 },
      } as any);

    const registry = new ProviderRegistry(
      { anthropic: { apiKey: 'test' }, google: { apiKey: 'test' } },
      mockConfig.models as any,
    );

    const result = await writerNode(makeState(), {
      configurable: { registry },
    } as any);

    const written = result.pendingEvents!.filter((e: any) => e.type === 'chapter_written');
    expect(written).toHaveLength(1);
  });

  it('should set maxTokens to at least target * 1.5', async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: longChapterContent,
        usage: { promptTokens: 2000, completionTokens: 3000 },
      } as any)
      .mockResolvedValueOnce({
        text: 'Summary.',
        usage: { promptTokens: 500, completionTokens: 200 },
      } as any);

    const registry = new ProviderRegistry(
      { anthropic: { apiKey: 'test' }, google: { apiKey: 'test' } },
      mockConfig.models as any,
    );

    await writerNode(makeState(), {
      configurable: { registry },
    } as any);

    const call = vi.mocked(generateText).mock.calls[0][0];
    // mockPlan.targetWords = 3000, so maxTokens should be at least 4500 (3000 * 1.5)
    expect(call.maxTokens).toBeGreaterThanOrEqual(4500);
  });

  it('should retry when model returns a refusal', async () => {
    const refusalText = `I'm sorry — I can't produce a full, 3000-word novel chapter in one response.

However, I *can* provide a detailed summary, or I can write shorter excerpts.

If you'd like, I can break the chapter into multiple parts.

Tell me how you'd like to proceed.`;

    vi.mocked(generateText)
      // First attempt: refusal
      .mockResolvedValueOnce({
        text: refusalText,
        usage: { promptTokens: 2000, completionTokens: 100 },
      } as any)
      // Second attempt (retry): actual content
      .mockResolvedValueOnce({
        text: longChapterContent,
        usage: { promptTokens: 2000, completionTokens: 3000 },
      } as any)
      // Summary
      .mockResolvedValueOnce({
        text: 'Summary.',
        usage: { promptTokens: 500, completionTokens: 200 },
      } as any);

    const registry = new ProviderRegistry(
      { anthropic: { apiKey: 'test' }, google: { apiKey: 'test' } },
      mockConfig.models as any,
    );

    const result = await writerNode(makeState(), {
      configurable: { registry },
    } as any);

    // Should have used the non-refusal content
    expect(result.currentDraft).toBe(longChapterContent);
    // 3 calls: refusal + retry + summary
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(3);
    // Should have costs for both the refusal and retry
    expect(result.costs!.length).toBe(2);
    expect(result.costs![0].step).toBe('writing');
    expect(result.costs![1].step).toBe('writing_refusal_retry');
  });

  it('should discard short refusal fragments and return empty when all retries fail', async () => {
    const refusalWithShortContent = `I'm sorry — I can't produce a full chapter in one response.

However, I *can* provide shorter excerpts.

If you'd like, I can break the chapter into parts.

Tell me how you'd like to proceed.

The laboratory hummed with the low drone of servers.`;

    vi.mocked(generateText)
      // All attempts return refusals (initial + 3 retries + 3 expand attempts)
      .mockResolvedValue({
        text: refusalWithShortContent,
        usage: { promptTokens: 2000, completionTokens: 200 },
      } as any);

    const registry = new ProviderRegistry(
      { anthropic: { apiKey: 'test' }, google: { apiKey: 'test' } },
      mockConfig.models as any,
    );

    const result = await writerNode(makeState(), {
      configurable: { registry },
    } as any);

    // Short cleaned text (< 100 words) should be discarded (Fix 1).
    // Since all expand attempts also return refusals, the draft stays empty.
    expect(result.currentDraft).not.toMatch(/^I'm sorry/);
    expect(result.currentDraft).not.toContain('can\'t produce');
  });

  it('should keep substantial cleaned text when all retries are refusals', async () => {
    // Cleaned content is 100+ words — should be kept
    const longStoryContent = Array(25).fill('The wind howled through the canyon walls as Dr. Mira Kessler pressed forward.').join(' ');
    const refusalWithLongContent = `I'm sorry — I can't produce a full chapter in one response.

However, I *can* provide shorter excerpts.

If you'd like, I can break the chapter into parts.

${longStoryContent}`;

    vi.mocked(generateText)
      .mockResolvedValue({
        text: refusalWithLongContent,
        usage: { promptTokens: 2000, completionTokens: 200 },
      } as any);

    const registry = new ProviderRegistry(
      { anthropic: { apiKey: 'test' }, google: { apiKey: 'test' } },
      mockConfig.models as any,
    );

    const result = await writerNode(makeState(), {
      configurable: { registry },
    } as any);

    // Substantial cleaned text (100+ words) should be kept
    expect(result.currentDraft).toContain('Dr. Mira Kessler');
    expect(result.currentDraft).not.toMatch(/^I'm sorry/);
  });
});

describe('countWords', () => {
  it('should count words correctly', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('  hello   world  ')).toBe(2);
    expect(countWords('')).toBe(0);
    expect(countWords('one')).toBe(1);
  });
});
