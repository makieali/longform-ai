import { describe, it, expect } from 'vitest';
import { ContextRetriever } from '../../memory/context-retriever.js';
import type { CharacterState, TimelineEvent } from '../../types.js';

describe('ContextRetriever', () => {
  const chars: CharacterState[] = [
    { name: 'Alice', lastSeenChapter: 1, alive: true, location: 'office', emotionalState: 'determined', relationships: {}, inventory: [], knownInformation: [] },
  ];
  const events: TimelineEvent[] = [
    { chapter: 1, timestamp: 'Ch1', event: 'Bug discovered', characters: ['Alice'], location: 'office', significance: 'major' },
  ];
  const passages = [
    { text: 'Alice found the bug.', chapter: 1, score: 0.9 },
    { text: 'She traced it to the server.', chapter: 1, score: 0.8 },
  ];

  it('should assemble context within token budget', () => {
    const retriever = new ContextRetriever({ maxTokenBudget: 8000 });
    const result = retriever.buildContext('Summary of story', passages, chars, events, 'Bridge text');
    expect(result.rollingSummary).toBe('Summary of story');
    expect(result.bridgeText).toBe('Bridge text');
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.totalTokens).toBeLessThanOrEqual(8000);
  });

  it('should prioritize summary over passages when budget is tight', () => {
    const retriever = new ContextRetriever({ maxTokenBudget: 50 });
    const longPassages = [{ text: 'x'.repeat(1000), chapter: 1, score: 0.9 }];
    const result = retriever.buildContext('Summary', longPassages, [], [], '');
    // Summary should always be included, long passages may be excluded
    expect(result.rollingSummary).toBe('Summary');
  });

  it('should handle empty inputs', () => {
    const retriever = new ContextRetriever();
    const result = retriever.buildContext('', [], [], [], '');
    expect(result.totalTokens).toBe(0);
    expect(result.relevantPassages).toEqual([]);
  });

  it('should filter passages to fit budget', () => {
    const retriever = new ContextRetriever({ maxTokenBudget: 100 });
    const manyPassages = Array.from({ length: 20 }, (_, i) => ({
      text: `Passage ${i} with some content about the story`,
      chapter: 1,
      score: 0.9 - i * 0.01,
    }));
    const result = retriever.buildContext('Short summary', manyPassages, [], [], '');
    expect(result.relevantPassages.length).toBeLessThan(20);
  });

  it('should return configured max token budget', () => {
    const retriever = new ContextRetriever({ maxTokenBudget: 5000 });
    expect(retriever.getMaxTokenBudget()).toBe(5000);
  });
});
