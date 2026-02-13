import type { MemoryProvider } from './provider.js';
import type { CharacterState, TimelineEvent, WorldStateUpdate, RelevantContext } from '../types.js';

export class NoOpMemoryProvider implements MemoryProvider {
  async initialize(): Promise<void> {}
  async storeChapter(): Promise<void> {}
  async getRelevantContext(query: string, currentChapter: number, tokenBudget = 4000): Promise<RelevantContext> {
    return {
      rollingSummary: '',
      relevantPassages: [],
      characterStates: [],
      recentEvents: [],
      worldContext: '',
      bridgeText: '',
      totalTokens: 0,
    };
  }
  async updateCharacterStates(_chapter: number, _content: string, currentStates: CharacterState[]): Promise<CharacterState[]> {
    return currentStates;
  }
  async getCharacterStates(): Promise<CharacterState[]> { return []; }
  async addTimelineEvents(): Promise<TimelineEvent[]> { return []; }
  async getTimeline(): Promise<TimelineEvent[]> { return []; }
  async updateWorldState(chapter: number): Promise<WorldStateUpdate> {
    return { chapter, locations: [], organizations: [], rules: [] };
  }
  async getWorldState(): Promise<WorldStateUpdate | null> { return null; }
  async close(): Promise<void> {}
}
