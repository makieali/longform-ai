import { describe, it, expect } from 'vitest';
import { NoOpMemoryProvider } from '../../memory/noop-provider.js';

describe('NoOpMemoryProvider', () => {
  it('should initialize without error', async () => {
    const provider = new NoOpMemoryProvider();
    await expect(provider.initialize()).resolves.not.toThrow();
  });

  it('should return empty context', async () => {
    const provider = new NoOpMemoryProvider();
    const context = await provider.getRelevantContext('test query', 1);
    expect(context.rollingSummary).toBe('');
    expect(context.relevantPassages).toEqual([]);
    expect(context.characterStates).toEqual([]);
    expect(context.totalTokens).toBe(0);
  });

  it('should return current states unchanged', async () => {
    const provider = new NoOpMemoryProvider();
    const states = [{ name: 'Alice', lastSeenChapter: 1, alive: true, location: 'office', emotionalState: 'calm', relationships: {}, inventory: [], knownInformation: [] }];
    const result = await provider.updateCharacterStates(1, 'content', states);
    expect(result).toEqual(states);
  });

  it('should close without error', async () => {
    const provider = new NoOpMemoryProvider();
    await expect(provider.close()).resolves.not.toThrow();
  });
});
