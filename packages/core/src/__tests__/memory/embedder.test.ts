import { describe, it, expect, vi } from 'vitest';
import { Embedder } from '../../memory/embedder.js';

vi.mock('ai', () => ({
  embed: vi.fn(async () => ({ embedding: new Array(1536).fill(0.1) })),
  embedMany: vi.fn(async ({ values }: any) => ({
    embeddings: values.map(() => new Array(1536).fill(0.1)),
  })),
}));

describe('Embedder', () => {
  const mockModel = { modelId: 'text-embedding-3-small' } as any;

  it('should embed a single text', async () => {
    const embedder = new Embedder({ model: mockModel });
    const result = await embedder.embedText('hello world');
    expect(result).toHaveLength(1536);
  });

  it('should embed multiple texts', async () => {
    const embedder = new Embedder({ model: mockModel });
    const result = await embedder.embedTexts(['hello', 'world']);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1536);
  });

  it('should chunk text correctly', () => {
    const embedder = new Embedder({ model: mockModel, chunkSize: 5, chunkOverlap: 2 });
    const text = 'one two three four five six seven eight nine ten';
    const chunks = embedder.chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].split(' ')).toHaveLength(5);
  });

  it('should not chunk short text', () => {
    const embedder = new Embedder({ model: mockModel, chunkSize: 100 });
    const text = 'short text';
    const chunks = embedder.chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('should return empty array for empty input', async () => {
    const embedder = new Embedder({ model: mockModel });
    const result = await embedder.embedTexts([]);
    expect(result).toEqual([]);
  });
});
