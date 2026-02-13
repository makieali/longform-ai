import { describe, it, expect } from 'vitest';
import { CharacterStore } from '../../memory/character-store.js';
import type { CharacterProfile } from '../../types.js';

describe('CharacterStore', () => {
  const characters: CharacterProfile[] = [
    { name: 'Alice', role: 'protagonist', description: 'A developer', traits: ['smart'], arc: 'Growth' },
    { name: 'Bob', role: 'supporting', description: 'A colleague', traits: ['loyal'], arc: 'Support' },
  ];

  it('should initialize from outline characters', () => {
    const store = new CharacterStore();
    store.initializeFromOutline(characters);
    const states = store.getAllStates();
    expect(states).toHaveLength(2);
    expect(states[0].name).toBe('Alice');
    expect(states[0].alive).toBe(true);
    expect(states[0].location).toBe('unknown');
  });

  it('should update character after chapter', () => {
    const store = new CharacterStore();
    store.initializeFromOutline(characters);
    store.updateAfterChapter(1, { name: 'Alice', location: 'office', emotionalState: 'excited' });
    const state = store.getState('Alice');
    expect(state?.location).toBe('office');
    expect(state?.emotionalState).toBe('excited');
    expect(state?.lastSeenChapter).toBe(1);
  });

  it('should track character death', () => {
    const store = new CharacterStore();
    store.initializeFromOutline(characters);
    store.markDead('Bob', 5);
    expect(store.getState('Bob')?.alive).toBe(false);
    expect(store.getAliveCharacters()).toHaveLength(1);
  });

  it('should track relationships', () => {
    const store = new CharacterStore();
    store.initializeFromOutline(characters);
    store.updateRelationship('Alice', 'Bob', 'close friends');
    expect(store.getState('Alice')?.relationships['Bob']).toBe('close friends');
  });

  it('should find characters at location', () => {
    const store = new CharacterStore();
    store.initializeFromOutline(characters);
    store.updateAfterChapter(1, { name: 'Alice', location: 'office' });
    store.updateAfterChapter(1, { name: 'Bob', location: 'office' });
    const atOffice = store.getCharactersAtLocation('office');
    expect(atOffice).toHaveLength(2);
  });
});
