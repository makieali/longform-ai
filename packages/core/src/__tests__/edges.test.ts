import { describe, it, expect } from 'vitest';
import { editorRouter, chapterRouter } from '../graph/edges.js';

const makeBaseState = (overrides = {}) => ({
  title: 'Test',
  description: 'Test',
  config: {
    contentType: 'novel' as const,
    targetWords: 10000,
    chaptersCount: 3,
    maxEditCycles: 3,
    humanReview: false,
    models: {},
  },
  currentPhase: 'editing',
  currentChapter: 1,
  outline: {
    title: 'Test',
    synopsis: 'Test',
    themes: ['test'],
    targetAudience: 'testers',
    chapters: [
      { number: 1, title: 'Ch1', summary: 'S', targetWords: 3000, keyEvents: [], characters: [] },
      { number: 2, title: 'Ch2', summary: 'S', targetWords: 3000, keyEvents: [], characters: [] },
      { number: 3, title: 'Ch3', summary: 'S', targetWords: 3000, keyEvents: [], characters: [] },
    ],
    characters: [],
  },
  currentDetailedPlan: null,
  currentDraft: '',
  currentEditResult: null,
  editCount: 0,
  chapters: [],
  rollingSummary: '',
  characterStates: [],
  costs: [],
  totalWordsWritten: 0,
  previousChapterEnding: '',
  humanFeedback: null,
  pendingEvents: [],
  ...overrides,
});

describe('editorRouter', () => {
  it('should route to continuity when approved', () => {
    const state = makeBaseState({
      currentEditResult: {
        scores: { prose: 8, plot: 8, character: 7, pacing: 8, dialogue: 7, overall: 8 },
        editNotes: [],
        approved: true,
      },
      editCount: 1,
    });
    expect(editorRouter(state as any)).toBe('continuity');
  });

  it('should route to writer when not approved and under max cycles', () => {
    const state = makeBaseState({
      currentEditResult: {
        scores: { prose: 5, plot: 5, character: 5, pacing: 5, dialogue: 5, overall: 5 },
        editNotes: [],
        approved: false,
      },
      editCount: 1,
    });
    expect(editorRouter(state as any)).toBe('writer');
  });

  it('should force to continuity when max edit cycles reached', () => {
    const state = makeBaseState({
      currentEditResult: {
        scores: { prose: 5, plot: 5, character: 5, pacing: 5, dialogue: 5, overall: 5 },
        editNotes: [],
        approved: false,
      },
      editCount: 3, // equals maxEditCycles
    });
    expect(editorRouter(state as any)).toBe('continuity');
  });

  it('should route to writer when no edit result and under max', () => {
    const state = makeBaseState({ currentEditResult: null, editCount: 0 });
    expect(editorRouter(state as any)).toBe('writer');
  });
});

describe('chapterRouter', () => {
  it('should route to planner for next chapter', () => {
    const state = makeBaseState({ currentChapter: 2, currentPhase: 'planning' });
    expect(chapterRouter(state as any)).toBe('planner');
  });

  it('should route to __end__ when all chapters complete', () => {
    const state = makeBaseState({ currentChapter: 4, currentPhase: 'complete' });
    expect(chapterRouter(state as any)).toBe('__end__');
  });

  it('should route to __end__ when currentPhase is complete', () => {
    const state = makeBaseState({ currentChapter: 3, currentPhase: 'complete' });
    expect(chapterRouter(state as any)).toBe('__end__');
  });

  it('should route to planner for middle chapter', () => {
    const state = makeBaseState({ currentChapter: 2, currentPhase: 'planning' });
    expect(chapterRouter(state as any)).toBe('planner');
  });
});
