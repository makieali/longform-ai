import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText, generateObject } from 'ai';
import { BookSession } from '../book-session.js';
import { MemorySessionStorage } from '../session/storage.js';
import type { BookSessionConfig, Outline, ChapterResult, ProgressEvent } from '../types.js';
import { mockOutline, mockDetailedPlan, mockApprovedEdit } from './fixtures/mock-responses.js';

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

const baseConfig: BookSessionConfig = {
  title: 'Test Book',
  description: 'A test book for unit testing',
  contentType: 'novel',
  chapters: 3,
  providers: {
    anthropic: { apiKey: 'test-key' },
    google: { apiKey: 'test-key' },
  },
  models: {
    outline: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.7, maxTokens: 4096 },
    planning: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.7, maxTokens: 4096 },
    writing: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.8, maxTokens: 8192 },
    editing: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.3, maxTokens: 4096 },
    continuity: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 4096 },
  },
  wordConfig: {
    defaultWords: 2000,
    tolerance: 0.15,
    minWords: 500,
  },
};

// Generate a realistic chapter-length text
function generateLongText(words: number): string {
  const sentence = 'The quick brown fox jumped over the lazy dog near the old barn. ';
  const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 0).length;
  const repeats = Math.ceil(words / sentenceWords);
  return Array(repeats).fill(sentence).join('').trim();
}

describe('BookSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a session with valid config', () => {
      const session = new BookSession(baseConfig);
      expect(session).toBeDefined();
      expect(session.getOutline()).toBeNull();
      expect(session.getProgress().phase).toBe('idle');
    });
  });

  describe('generateOutline', () => {
    it('should generate and store an outline', async () => {
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: mockOutline,
        usage: { promptTokens: 500, completionTokens: 1500 },
      } as any);

      const session = new BookSession(baseConfig);
      const outline = await session.generateOutline();

      expect(outline).toBeDefined();
      expect(outline.title).toBe(mockOutline.title);
      expect(outline.chapters).toHaveLength(3);
      expect(session.getOutline()).toEqual(outline);
      expect(session.getProgress().phase).toBe('outline');
      expect(session.getProgress().outlineApproved).toBe(false);
    });

    it('should apply wordConfig overrides to outline chapters', async () => {
      const configWithOverrides: BookSessionConfig = {
        ...baseConfig,
        wordConfig: {
          defaultWords: 2000,
          chapterOverrides: { 1: 3000, 3: 4000 },
          tolerance: 0.15,
          minWords: 500,
        },
      };

      vi.mocked(generateObject).mockResolvedValueOnce({
        object: { ...mockOutline },
        usage: { promptTokens: 500, completionTokens: 1500 },
      } as any);

      const session = new BookSession(configWithOverrides);
      const outline = await session.generateOutline();

      expect(outline.chapters[0].targetWords).toBe(3000);
      expect(outline.chapters[1].targetWords).toBe(2000);
      expect(outline.chapters[2].targetWords).toBe(4000);
    });

    it('should emit outline_generated event', async () => {
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: mockOutline,
        usage: { promptTokens: 500, completionTokens: 1500 },
      } as any);

      const session = new BookSession(baseConfig);
      const events: ProgressEvent[] = [];
      session.on('outline_generated', (e) => events.push(e));

      await session.generateOutline();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('outline_generated');
    });
  });

  describe('updateOutline', () => {
    it('should update chapter titles', async () => {
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: { ...mockOutline, chapters: mockOutline.chapters.map(c => ({ ...c })) },
        usage: { promptTokens: 500, completionTokens: 1500 },
      } as any);

      const session = new BookSession(baseConfig);
      await session.generateOutline();

      const updated = await session.updateOutline({
        updateChapter: [{ number: 1, title: 'New Title for Chapter 1' }],
      });

      expect(updated.chapters[0].title).toBe('New Title for Chapter 1');
    });

    it('should add a new chapter', async () => {
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: { ...mockOutline, chapters: mockOutline.chapters.map(c => ({ ...c })) },
        usage: { promptTokens: 500, completionTokens: 1500 },
      } as any);

      const session = new BookSession(baseConfig);
      await session.generateOutline();

      const updated = await session.updateOutline({
        addChapter: [{ afterChapter: 1, title: 'Interlude', summary: 'A brief interlude' }],
      });

      expect(updated.chapters).toHaveLength(4);
      expect(updated.chapters[1].title).toBe('Interlude');
      // Chapters should be renumbered
      expect(updated.chapters[0].number).toBe(1);
      expect(updated.chapters[1].number).toBe(2);
      expect(updated.chapters[2].number).toBe(3);
      expect(updated.chapters[3].number).toBe(4);
    });

    it('should remove chapters', async () => {
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: { ...mockOutline, chapters: mockOutline.chapters.map(c => ({ ...c })) },
        usage: { promptTokens: 500, completionTokens: 1500 },
      } as any);

      const session = new BookSession(baseConfig);
      await session.generateOutline();

      const updated = await session.updateOutline({
        removeChapters: [2],
      });

      expect(updated.chapters).toHaveLength(2);
      expect(updated.chapters[0].number).toBe(1);
      expect(updated.chapters[1].number).toBe(2);
    });

    it('should update synopsis and themes', async () => {
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: { ...mockOutline, chapters: mockOutline.chapters.map(c => ({ ...c })) },
        usage: { promptTokens: 500, completionTokens: 1500 },
      } as any);

      const session = new BookSession(baseConfig);
      await session.generateOutline();

      const updated = await session.updateOutline({
        synopsis: 'New synopsis',
        themes: ['love', 'adventure'],
      });

      expect(updated.synopsis).toBe('New synopsis');
      expect(updated.themes).toEqual(['love', 'adventure']);
    });

    it('should throw if no outline exists', async () => {
      const session = new BookSession(baseConfig);
      await expect(session.updateOutline({ synopsis: 'test' })).rejects.toThrow(
        'No outline to update',
      );
    });
  });

  describe('approveOutline', () => {
    it('should mark outline as approved', async () => {
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: mockOutline,
        usage: { promptTokens: 500, completionTokens: 1500 },
      } as any);

      const session = new BookSession(baseConfig);
      await session.generateOutline();
      await session.approveOutline();

      expect(session.getProgress().outlineApproved).toBe(true);
      expect(session.getProgress().phase).toBe('writing');
    });

    it('should throw if no outline to approve', async () => {
      const session = new BookSession(baseConfig);
      await expect(session.approveOutline()).rejects.toThrow('No outline to approve');
    });
  });

  describe('generateChapter', () => {
    const longText = generateLongText(2200);

    function setupFullChapterMocks() {
      // generateObject calls: planning, editing
      vi.mocked(generateObject)
        // Outline
        .mockResolvedValueOnce({
          object: mockOutline,
          usage: { promptTokens: 500, completionTokens: 1500 },
        } as any)
        // Planning
        .mockResolvedValueOnce({
          object: mockDetailedPlan,
          usage: { promptTokens: 800, completionTokens: 600 },
        } as any)
        // Editing
        .mockResolvedValueOnce({
          object: mockApprovedEdit,
          usage: { promptTokens: 2000, completionTokens: 400 },
        } as any);

      // generateText calls: writing, summary, continuity
      vi.mocked(generateText)
        // Writing
        .mockResolvedValueOnce({
          text: longText,
          usage: { promptTokens: 2000, completionTokens: 3000 },
        } as any)
        // Summary extraction
        .mockResolvedValueOnce({
          text: 'Chapter summary...',
          usage: { promptTokens: 500, completionTokens: 200 },
        } as any)
        // Continuity update
        .mockResolvedValueOnce({
          text: 'Rolling summary updated.',
          usage: { promptTokens: 1000, completionTokens: 300 },
        } as any);
    }

    it('should throw if outline not approved', async () => {
      const session = new BookSession(baseConfig);
      await expect(session.generateChapter(1)).rejects.toThrow('Outline must be approved');
    });

    it('should generate a chapter with full pipeline', async () => {
      setupFullChapterMocks();

      const session = new BookSession(baseConfig);
      await session.generateOutline();
      await session.approveOutline();
      const result = await session.generateChapter(1);

      expect(result).toBeDefined();
      expect(result.chapter.number).toBe(1);
      expect(result.chapter.content).toBe(longText);
      expect(result.editHistory).toHaveLength(1);
      expect(result.editHistory[0].approved).toBe(true);
      expect(result.costForChapter).toBeGreaterThan(0);
      expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should mark chapter status as approved after generation', async () => {
      setupFullChapterMocks();

      const session = new BookSession(baseConfig);
      await session.generateOutline();
      await session.approveOutline();
      await session.generateChapter(1);

      expect(session.getChapterStatus(1)).toBe('approved');
    });

    it('should track progress correctly', async () => {
      setupFullChapterMocks();

      const session = new BookSession(baseConfig);
      await session.generateOutline();
      await session.approveOutline();
      await session.generateChapter(1);

      const progress = session.getProgress();
      expect(progress.chaptersCompleted).toBe(1);
      expect(progress.totalChapters).toBe(3);
      expect(progress.totalWords).toBeGreaterThan(0);
      expect(progress.totalCost).toBeGreaterThan(0);
    });

    it('should handle chapter generation failure gracefully', async () => {
      vi.mocked(generateObject)
        .mockResolvedValueOnce({
          object: mockOutline,
          usage: { promptTokens: 500, completionTokens: 1500 },
        } as any)
        // Planning fails
        .mockRejectedValueOnce(new Error('API Error'));

      const session = new BookSession(baseConfig);
      await session.generateOutline();
      await session.approveOutline();

      const events: ProgressEvent[] = [];
      session.on('chapter_failed', (e) => events.push(e));

      await expect(session.generateChapter(1)).rejects.toThrow('API Error');
      expect(session.getChapterStatus(1)).toBe('failed');
      expect(events).toHaveLength(1);
    });
  });

  describe('rewriteChapter', () => {
    const longText = generateLongText(2200);

    it('should rewrite a chapter with feedback', async () => {
      // Setup: outline + first chapter generation
      vi.mocked(generateObject)
        // Outline
        .mockResolvedValueOnce({
          object: mockOutline,
          usage: { promptTokens: 500, completionTokens: 1500 },
        } as any)
        // First chapter: planning
        .mockResolvedValueOnce({
          object: mockDetailedPlan,
          usage: { promptTokens: 800, completionTokens: 600 },
        } as any)
        // First chapter: editing
        .mockResolvedValueOnce({
          object: mockApprovedEdit,
          usage: { promptTokens: 2000, completionTokens: 400 },
        } as any)
        // Rewrite: planning
        .mockResolvedValueOnce({
          object: mockDetailedPlan,
          usage: { promptTokens: 800, completionTokens: 600 },
        } as any)
        // Rewrite: editing
        .mockResolvedValueOnce({
          object: mockApprovedEdit,
          usage: { promptTokens: 2000, completionTokens: 400 },
        } as any);

      vi.mocked(generateText)
        // First: writing, summary, continuity
        .mockResolvedValueOnce({ text: longText, usage: { promptTokens: 2000, completionTokens: 3000 } } as any)
        .mockResolvedValueOnce({ text: 'Summary', usage: { promptTokens: 500, completionTokens: 200 } } as any)
        .mockResolvedValueOnce({ text: 'Rolling summary', usage: { promptTokens: 1000, completionTokens: 300 } } as any)
        // Rewrite: writing, summary, continuity
        .mockResolvedValueOnce({ text: longText + ' More content added.', usage: { promptTokens: 2000, completionTokens: 3500 } } as any)
        .mockResolvedValueOnce({ text: 'Updated summary', usage: { promptTokens: 500, completionTokens: 200 } } as any)
        .mockResolvedValueOnce({ text: 'Updated rolling summary', usage: { promptTokens: 1000, completionTokens: 300 } } as any);

      const session = new BookSession(baseConfig);
      await session.generateOutline();
      await session.approveOutline();
      await session.generateChapter(1);

      const result = await session.rewriteChapter(1, 'Add more dialogue');
      expect(result).toBeDefined();
      expect(result.chapter.number).toBe(1);
      expect(session.getChapterStatus(1)).toBe('approved');
    });
  });

  describe('generateAllRemaining', () => {
    const longText = generateLongText(2200);

    it('should generate all pending chapters', async () => {
      // Outline mock
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: mockOutline,
        usage: { promptTokens: 500, completionTokens: 1500 },
      } as any);

      // For each of 3 chapters: planning + editing
      for (let i = 0; i < 3; i++) {
        vi.mocked(generateObject)
          .mockResolvedValueOnce({
            object: { ...mockDetailedPlan, chapterNumber: i + 1 },
            usage: { promptTokens: 800, completionTokens: 600 },
          } as any)
          .mockResolvedValueOnce({
            object: mockApprovedEdit,
            usage: { promptTokens: 2000, completionTokens: 400 },
          } as any);

        vi.mocked(generateText)
          .mockResolvedValueOnce({ text: longText, usage: { promptTokens: 2000, completionTokens: 3000 } } as any)
          .mockResolvedValueOnce({ text: 'Summary', usage: { promptTokens: 500, completionTokens: 200 } } as any)
          .mockResolvedValueOnce({ text: 'Rolling summary', usage: { promptTokens: 1000, completionTokens: 300 } } as any);
      }

      const session = new BookSession(baseConfig);
      await session.generateOutline();
      await session.approveOutline();

      const results: ChapterResult[] = [];
      for await (const result of session.generateAllRemaining()) {
        results.push(result);
      }

      expect(results).toHaveLength(3);
      expect(session.getProgress().chaptersCompleted).toBe(3);
      expect(session.getProgress().phase).toBe('complete');
    });
  });

  describe('save and restore', () => {
    it('should save and restore session state', async () => {
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: mockOutline,
        usage: { promptTokens: 500, completionTokens: 1500 },
      } as any);

      const storage = new MemorySessionStorage();
      const session = new BookSession(baseConfig);
      await session.generateOutline();
      await session.approveOutline();

      const sessionId = await session.save(storage);
      expect(sessionId).toBeDefined();

      const restored = await BookSession.restore(sessionId, baseConfig, storage);
      expect(restored.getOutline()).toBeDefined();
      expect(restored.getOutline()!.title).toBe(mockOutline.title);
      expect(restored.getProgress().outlineApproved).toBe(true);
    });

    it('should throw when restoring non-existent session', async () => {
      const storage = new MemorySessionStorage();
      await expect(BookSession.restore('non-existent', baseConfig, storage)).rejects.toThrow(
        'Session non-existent not found',
      );
    });
  });

  describe('export', () => {
    const longText = generateLongText(2200);

    it('should export a book with completed chapters', async () => {
      vi.mocked(generateObject)
        .mockResolvedValueOnce({ object: mockOutline, usage: { promptTokens: 500, completionTokens: 1500 } } as any)
        .mockResolvedValueOnce({ object: mockDetailedPlan, usage: { promptTokens: 800, completionTokens: 600 } } as any)
        .mockResolvedValueOnce({ object: mockApprovedEdit, usage: { promptTokens: 2000, completionTokens: 400 } } as any);

      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: longText, usage: { promptTokens: 2000, completionTokens: 3000 } } as any)
        .mockResolvedValueOnce({ text: 'Summary', usage: { promptTokens: 500, completionTokens: 200 } } as any)
        .mockResolvedValueOnce({ text: 'Rolling summary', usage: { promptTokens: 1000, completionTokens: 300 } } as any);

      const session = new BookSession(baseConfig);
      await session.generateOutline();
      await session.approveOutline();
      await session.generateChapter(1);

      const book = session.export();
      expect(book.title).toBe(mockOutline.title);
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].number).toBe(1);
      expect(book.totalWords).toBeGreaterThan(0);
      expect(book.metadata.contentType).toBe('novel');
    });

    it('should throw if no outline exists', () => {
      const session = new BookSession(baseConfig);
      expect(() => session.export()).toThrow('No outline available');
    });
  });

  describe('events', () => {
    it('should emit events to registered handlers', async () => {
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: mockOutline,
        usage: { promptTokens: 500, completionTokens: 1500 },
      } as any);

      const session = new BookSession(baseConfig);
      const events: ProgressEvent[] = [];
      session.on('outline_generated', (e) => events.push(e));
      session.on('outline_approved', (e) => events.push(e));

      await session.generateOutline();
      await session.approveOutline();

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('outline_generated');
      expect(events[1].type).toBe('outline_approved');
    });
  });

  describe('getProgress', () => {
    it('should return correct initial progress', () => {
      const session = new BookSession(baseConfig);
      const progress = session.getProgress();

      expect(progress.phase).toBe('idle');
      expect(progress.outlineApproved).toBe(false);
      expect(progress.totalChapters).toBe(0);
      expect(progress.chaptersCompleted).toBe(0);
      expect(progress.totalWords).toBe(0);
      expect(progress.totalCost).toBe(0);
    });

    it('should estimate remaining cost', async () => {
      const longText = generateLongText(2200);

      vi.mocked(generateObject)
        .mockResolvedValueOnce({ object: mockOutline, usage: { promptTokens: 500, completionTokens: 1500 } } as any)
        .mockResolvedValueOnce({ object: mockDetailedPlan, usage: { promptTokens: 800, completionTokens: 600 } } as any)
        .mockResolvedValueOnce({ object: mockApprovedEdit, usage: { promptTokens: 2000, completionTokens: 400 } } as any);

      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: longText, usage: { promptTokens: 2000, completionTokens: 3000 } } as any)
        .mockResolvedValueOnce({ text: 'Summary', usage: { promptTokens: 500, completionTokens: 200 } } as any)
        .mockResolvedValueOnce({ text: 'Rolling summary', usage: { promptTokens: 1000, completionTokens: 300 } } as any);

      const session = new BookSession(baseConfig);
      await session.generateOutline();
      await session.approveOutline();
      await session.generateChapter(1);

      const progress = session.getProgress();
      expect(progress.estimatedRemainingCost).toBeGreaterThanOrEqual(0);
    });
  });
});
