import type { CharacterState, TimelineEvent, WorldStateUpdate, RelevantContext } from '../types.js';

export interface MemoryProvider {
  initialize(): Promise<void>;
  storeChapter(chapter: number, content: string, summary: string, metadata?: Record<string, unknown>): Promise<void>;
  getRelevantContext(query: string, currentChapter: number, tokenBudget?: number): Promise<RelevantContext>;
  updateCharacterStates(chapter: number, content: string, currentStates: CharacterState[]): Promise<CharacterState[]>;
  getCharacterStates(names?: string[]): Promise<CharacterState[]>;
  addTimelineEvents(chapter: number, content: string): Promise<TimelineEvent[]>;
  getTimeline(fromChapter?: number, toChapter?: number): Promise<TimelineEvent[]>;
  updateWorldState(chapter: number, content: string): Promise<WorldStateUpdate>;
  getWorldState(): Promise<WorldStateUpdate | null>;
  close(): Promise<void>;
}
