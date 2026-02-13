import { embed, embedMany } from 'ai';
import type { LanguageModel } from 'ai';

export interface EmbedderConfig {
  model: LanguageModel;
  dimensions?: number;
  chunkSize?: number;
  chunkOverlap?: number;
}

export class Embedder {
  private model: LanguageModel;
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(config: EmbedderConfig) {
    this.model = config.model;
    this.chunkSize = config.chunkSize ?? 512;
    this.chunkOverlap = config.chunkOverlap ?? 50;
  }

  async embedText(text: string): Promise<number[]> {
    const { embedding } = await embed({
      model: this.model as any,
      value: text,
    });
    return embedding;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const { embeddings } = await embedMany({
      model: this.model as any,
      values: texts,
    });
    return embeddings;
  }

  chunkText(text: string): string[] {
    const words = text.split(/\s+/);
    if (words.length <= this.chunkSize) return [text];

    const chunks: string[] = [];
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + this.chunkSize, words.length);
      chunks.push(words.slice(start, end).join(' '));
      const nextStart = end - this.chunkOverlap;
      // Ensure we always advance at least 1 position to avoid infinite loops
      start = Math.max(nextStart, start + 1);
      if (end >= words.length) break;
    }

    return chunks;
  }

  async embedChunks(text: string): Promise<{ text: string; embedding: number[] }[]> {
    const chunks = this.chunkText(text);
    const embeddings = await this.embedTexts(chunks);
    return chunks.map((chunk, i) => ({ text: chunk, embedding: embeddings[i] }));
  }
}
