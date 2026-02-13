import { describe, it, expect } from 'vitest';
import { TokenBudget } from '../context/token-budget.js';
import type { ContextItem, DetailedChapterPlan } from '../types.js';

describe('TokenBudget', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens as chars / 4', () => {
      const budget = new TokenBudget();
      expect(budget.estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 → ceil = 3
      expect(budget.estimateTokens('')).toBe(0);
      expect(budget.estimateTokens('a'.repeat(100))).toBe(25);
    });
  });

  describe('buildContext', () => {
    it('should include required items first', () => {
      const budget = new TokenBudget();
      const items: ContextItem[] = [
        { key: 'optional', content: 'optional content', priority: 50 },
        { key: 'required', content: 'required content', priority: 100, required: true },
      ];

      const result = budget.buildContext(items, 1000);
      expect(result.includedItems).toContain('required');
      expect(result.includedItems).toContain('optional');
      expect(result.droppedItems).toHaveLength(0);
    });

    it('should drop low-priority items when budget is exceeded', () => {
      const budget = new TokenBudget();
      const items: ContextItem[] = [
        { key: 'high', content: 'a'.repeat(400), priority: 100 }, // ~100 tokens
        { key: 'medium', content: 'b'.repeat(400), priority: 50 }, // ~100 tokens
        { key: 'low', content: 'c'.repeat(400), priority: 10 },   // ~100 tokens
      ];

      // Budget for ~150 tokens — should fit high + medium but not low
      const result = budget.buildContext(items, 200);
      expect(result.includedItems).toContain('high');
      expect(result.includedItems).toContain('medium');
      expect(result.droppedItems).toContain('low');
    });

    it('should always include required items even when budget is tight', () => {
      const budget = new TokenBudget();
      const items: ContextItem[] = [
        { key: 'required', content: 'a'.repeat(200), priority: 100, required: true },
        { key: 'optional', content: 'b'.repeat(200), priority: 50 },
      ];

      const result = budget.buildContext(items, 60);
      expect(result.includedItems).toContain('required');
      expect(result.droppedItems).toContain('optional');
    });

    it('should return empty result for empty items', () => {
      const budget = new TokenBudget();
      const result = budget.buildContext([], 1000);
      expect(result.text).toBe('');
      expect(result.totalTokens).toBe(0);
      expect(result.includedItems).toHaveLength(0);
      expect(result.droppedItems).toHaveLength(0);
    });
  });

  describe('assembleWriterContext', () => {
    const mockPlan: DetailedChapterPlan = {
      chapterNumber: 1,
      title: 'The Beginning',
      scenes: [
        { number: 1, setting: 'Office', characters: ['Alice'], objective: 'Intro', conflict: 'Bug', resolution: 'Fix', targetWords: 1000 },
      ],
      pov: 'Third person',
      tone: 'Mysterious',
      targetWords: 2000,
      bridgeFromPrevious: '',
      bridgeToNext: '',
    };

    it('should assemble context with all items when budget allows', () => {
      const budget = new TokenBudget(128000);
      const result = budget.assembleWriterContext(
        mockPlan,
        'Story so far...',
        'End of previous chapter...',
        'Memory context...',
        1000,
      );

      expect(result.includedItems).toContain('chapter_plan');
      expect(result.includedItems).toContain('rolling_summary');
      expect(result.includedItems).toContain('previous_chapter_ending');
      expect(result.includedItems).toContain('memory_context');
      expect(result.droppedItems).toHaveLength(0);
    });

    it('should drop lower-priority items when budget is tight', () => {
      // Total budget = 800 - 200 = 600 tokens available
      // chapter_plan (required): ~100 tokens
      // previous_chapter_ending (p80): ~50 tokens - fits in ~450 remaining
      // rolling_summary (p60): ~75 tokens - fits in ~400 remaining
      // memory_context (p40): ~500 tokens - too big for ~325 remaining
      const budget = new TokenBudget(800);
      const result = budget.assembleWriterContext(
        mockPlan,
        'x'.repeat(300),    // rolling summary: ~75 tokens
        'y'.repeat(200),    // previous ending: ~50 tokens
        'z'.repeat(2000),   // memory context: ~500 tokens
        200,
      );

      expect(result.includedItems).toContain('chapter_plan');
      // Memory context (lowest priority, largest) should be dropped
      expect(result.droppedItems).toContain('memory_context');
    });

    it('should handle empty optional fields', () => {
      const budget = new TokenBudget();
      const result = budget.assembleWriterContext(
        mockPlan,
        '', // no summary
        '', // no ending
        '', // no memory
        500,
      );

      expect(result.includedItems).toContain('chapter_plan');
      expect(result.includedItems).toHaveLength(1);
    });
  });
});
