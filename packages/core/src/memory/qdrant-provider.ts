import { QdrantClient } from '@qdrant/js-client-rest';
import type { MemoryProvider } from './provider.js';
import type { CharacterState, TimelineEvent, WorldStateUpdate, RelevantContext } from '../types.js';
import type { Embedder } from './embedder.js';

export interface QdrantMemoryConfig {
  url: string;
  apiKey?: string;
  collectionPrefix?: string;
  embedder: Embedder;
}

export class QdrantMemoryProvider implements MemoryProvider {
  private client: QdrantClient;
  private embedder: Embedder;
  private prefix: string;
  private characterStates: Map<string, CharacterState> = new Map();
  private timeline: TimelineEvent[] = [];
  private worldState: WorldStateUpdate | null = null;

  constructor(config: QdrantMemoryConfig) {
    this.client = new QdrantClient({
      url: config.url,
      apiKey: config.apiKey,
    });
    this.embedder = config.embedder;
    this.prefix = config.collectionPrefix ?? 'longform';
  }

  private get chapterCollection() { return `${this.prefix}_chapters`; }
  private get characterCollection() { return `${this.prefix}_characters`; }

  async initialize(): Promise<void> {
    // Create collections if they don't exist
    const collections = await this.client.getCollections();
    const existing = new Set(collections.collections.map(c => c.name));

    for (const name of [this.chapterCollection, this.characterCollection]) {
      if (!existing.has(name)) {
        await this.client.createCollection(name, {
          vectors: { size: 1536, distance: 'Cosine' },
        });
      }
    }
  }

  async storeChapter(chapter: number, content: string, summary: string, metadata?: Record<string, unknown>): Promise<void> {
    const chunks = await this.embedder.embedChunks(content);

    const points = chunks.map((chunk, i) => ({
      id: chapter * 10000 + i,
      vector: chunk.embedding,
      payload: {
        chapter,
        chunkIndex: i,
        text: chunk.text,
        summary,
        ...metadata,
      },
    }));

    await this.client.upsert(this.chapterCollection, { points });
  }

  async getRelevantContext(query: string, currentChapter: number, tokenBudget = 4000): Promise<RelevantContext> {
    const queryEmbedding = await this.embedder.embedText(query);

    const results = await this.client.query(this.chapterCollection, {
      query: queryEmbedding,
      limit: 10,
      filter: {
        must: [{ key: 'chapter', range: { lt: currentChapter } }],
      },
    });

    const passages = (results.points ?? []).map((point: any) => ({
      text: point.payload?.text as string ?? '',
      chapter: point.payload?.chapter as number ?? 0,
      score: point.score ?? 0,
    }));

    // Rough token estimation (4 chars per token)
    let tokenCount = 0;
    const filteredPassages = passages.filter(p => {
      const tokens = Math.ceil(p.text.length / 4);
      if (tokenCount + tokens > tokenBudget) return false;
      tokenCount += tokens;
      return true;
    });

    return {
      rollingSummary: '',
      relevantPassages: filteredPassages,
      characterStates: Array.from(this.characterStates.values()),
      recentEvents: this.timeline.slice(-10),
      worldContext: this.worldState ? JSON.stringify(this.worldState) : '',
      bridgeText: '',
      totalTokens: tokenCount,
    };
  }

  async updateCharacterStates(chapter: number, _content: string, currentStates: CharacterState[]): Promise<CharacterState[]> {
    for (const state of currentStates) {
      this.characterStates.set(state.name, { ...state, lastSeenChapter: chapter });
    }
    return Array.from(this.characterStates.values());
  }

  async getCharacterStates(names?: string[]): Promise<CharacterState[]> {
    if (!names) return Array.from(this.characterStates.values());
    return names.map(n => this.characterStates.get(n)).filter((s): s is CharacterState => s !== undefined);
  }

  async addTimelineEvents(chapter: number, _content: string): Promise<TimelineEvent[]> {
    // In a full implementation, this would use AI to extract events
    const event: TimelineEvent = {
      chapter,
      timestamp: `Chapter ${chapter}`,
      event: `Events of chapter ${chapter}`,
      characters: [],
      location: '',
      significance: 'minor',
    };
    this.timeline.push(event);
    return [event];
  }

  async getTimeline(fromChapter?: number, toChapter?: number): Promise<TimelineEvent[]> {
    return this.timeline.filter(e => {
      if (fromChapter !== undefined && e.chapter < fromChapter) return false;
      if (toChapter !== undefined && e.chapter > toChapter) return false;
      return true;
    });
  }

  async updateWorldState(chapter: number, _content: string): Promise<WorldStateUpdate> {
    const update: WorldStateUpdate = {
      chapter,
      locations: [],
      organizations: [],
      rules: [],
    };
    this.worldState = update;
    return update;
  }

  async getWorldState(): Promise<WorldStateUpdate | null> {
    return this.worldState;
  }

  async close(): Promise<void> {
    // Qdrant client doesn't need explicit closing
  }
}
