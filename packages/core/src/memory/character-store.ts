import type { CharacterState, CharacterProfile } from '../types.js';

export class CharacterStore {
  private states: Map<string, CharacterState> = new Map();

  initializeFromOutline(characters: CharacterProfile[]): void {
    for (const char of characters) {
      this.states.set(char.name, {
        name: char.name,
        lastSeenChapter: 0,
        alive: true,
        location: 'unknown',
        emotionalState: 'neutral',
        relationships: {},
        inventory: [],
        knownInformation: [],
      });
    }
  }

  updateAfterChapter(chapter: number, updates: Partial<CharacterState> & { name: string }): void {
    const existing = this.states.get(updates.name);
    if (existing) {
      this.states.set(updates.name, {
        ...existing,
        ...updates,
        lastSeenChapter: chapter,
      });
    }
  }

  getState(name: string): CharacterState | undefined {
    return this.states.get(name);
  }

  getAllStates(): CharacterState[] {
    return Array.from(this.states.values());
  }

  getAliveCharacters(): CharacterState[] {
    return this.getAllStates().filter(c => c.alive);
  }

  getCharactersAtLocation(location: string): CharacterState[] {
    return this.getAllStates().filter(c => c.location === location);
  }

  markDead(name: string, chapter: number): void {
    const state = this.states.get(name);
    if (state) {
      state.alive = false;
      state.lastSeenChapter = chapter;
    }
  }

  updateRelationship(name: string, otherName: string, relationship: string): void {
    const state = this.states.get(name);
    if (state) {
      state.relationships[otherName] = relationship;
    }
  }
}
