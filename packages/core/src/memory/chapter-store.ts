import type { Embedder } from './embedder.js';

export interface ChapterStoreConfig {
  embedder: Embedder;
}

export interface StoredChunk {
  chapter: number;
  chunkIndex: number;
  text: string;
  embedding: number[];
  summary: string;
}

export class ChapterStore {
  private embedder: Embedder;
  private chunks: StoredChunk[] = [];

  constructor(config: ChapterStoreConfig) {
    this.embedder = config.embedder;
  }

  async storeChapter(chapter: number, content: string, summary: string): Promise<void> {
    const embedded = await this.embedder.embedChunks(content);
    for (let i = 0; i < embedded.length; i++) {
      this.chunks.push({
        chapter,
        chunkIndex: i,
        text: embedded[i].text,
        embedding: embedded[i].embedding,
        summary,
      });
    }
  }

  async findRelevant(query: string, limit = 5, beforeChapter?: number): Promise<{ text: string; chapter: number; score: number }[]> {
    const queryEmb = await this.embedder.embedText(query);
    const candidates = beforeChapter
      ? this.chunks.filter(c => c.chapter < beforeChapter)
      : this.chunks;

    const scored = candidates.map(chunk => ({
      text: chunk.text,
      chapter: chunk.chapter,
      score: cosineSimilarity(queryEmb, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  getChunkCount(): number { return this.chunks.length; }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}
