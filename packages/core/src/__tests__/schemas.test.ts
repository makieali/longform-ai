import { describe, it, expect } from 'vitest';
import {
  GenerationConfigSchema, ModelConfigSchema, ContentTypeSchema,
  OutlineSchema, ChapterPlanSchema, CharacterProfileSchema,
  ChapterContentSchema, EditResultSchema, EditScoresSchema,
  DetailedChapterPlanSchema, ScenePlanSchema,
} from '../schemas/index.js';

describe('ModelConfigSchema', () => {
  it('should validate a complete model config', () => {
    const config = {
      provider: 'openai',
      model: 'gpt-4.1',
      temperature: 0.7,
      maxTokens: 4096,
    };
    expect(ModelConfigSchema.parse(config)).toEqual(config);
  });

  it('should apply defaults for temperature and maxTokens', () => {
    const config = { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' };
    const result = ModelConfigSchema.parse(config);
    expect(result.temperature).toBe(0.7);
    expect(result.maxTokens).toBe(4096);
  });

  it('should reject invalid provider', () => {
    expect(() => ModelConfigSchema.parse({ provider: 'invalid', model: 'test' })).toThrow();
  });

  it('should reject temperature out of range', () => {
    expect(() => ModelConfigSchema.parse({ provider: 'openai', model: 'gpt-4.1', temperature: 3 })).toThrow();
  });
});

describe('GenerationConfigSchema', () => {
  it('should apply all defaults', () => {
    const result = GenerationConfigSchema.parse({});
    expect(result.contentType).toBe('novel');
    expect(result.targetWords).toBe(50000);
    expect(result.chaptersCount).toBe(20);
    expect(result.maxEditCycles).toBe(3);
    expect(result.humanReview).toBe(false);
    expect(result.models).toEqual({});
  });

  it('should reject invalid content type', () => {
    expect(() => GenerationConfigSchema.parse({ contentType: 'poem' })).toThrow();
  });

  it('should reject too many chapters', () => {
    expect(() => GenerationConfigSchema.parse({ chaptersCount: 101 })).toThrow();
  });

  it('should accept valid full config', () => {
    const config = {
      contentType: 'technical-docs',
      targetWords: 30000,
      chaptersCount: 10,
      maxEditCycles: 2,
      humanReview: true,
      models: {
        writing: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
      },
    };
    const result = GenerationConfigSchema.parse(config);
    expect(result.contentType).toBe('technical-docs');
    expect(result.humanReview).toBe(true);
  });
});

describe('OutlineSchema', () => {
  it('should validate a complete outline', () => {
    const outline = {
      title: 'Test Book',
      synopsis: 'A story about testing software',
      themes: ['technology', 'perseverance'],
      targetAudience: 'developers',
      chapters: [{
        number: 1,
        title: 'The Beginning',
        summary: 'Our hero discovers a bug',
        targetWords: 3000,
        keyEvents: ['Bug discovered'],
        characters: ['Alice'],
      }],
      characters: [{
        name: 'Alice',
        role: 'protagonist',
        description: 'A skilled developer',
        traits: ['determined', 'clever'],
        arc: 'From junior to senior',
      }],
    };
    expect(OutlineSchema.parse(outline)).toBeTruthy();
  });

  it('should reject outline without chapters', () => {
    expect(() => OutlineSchema.parse({
      title: 'Test', synopsis: 'A test story', themes: ['test'],
      targetAudience: 'testers', chapters: [], characters: [],
    })).toThrow();
  });

  it('should reject outline with empty title', () => {
    expect(() => OutlineSchema.parse({
      title: '', synopsis: 'A test story', themes: ['test'],
      targetAudience: 'testers', chapters: [{ number: 1, title: 'Ch1', summary: 'Sum', targetWords: 1000, keyEvents: [], characters: [] }],
      characters: [],
    })).toThrow();
  });
});

describe('ChapterContentSchema', () => {
  it('should validate chapter content with defaults', () => {
    const chapter = {
      number: 1,
      title: 'Chapter 1',
      content: 'Once upon a time...',
      wordCount: 3000,
      summary: 'The beginning of the story',
    };
    const result = ChapterContentSchema.parse(chapter);
    expect(result.editCount).toBe(0);
    expect(result.approved).toBe(false);
  });

  it('should accept approved chapter', () => {
    const chapter = {
      number: 5,
      title: 'Chapter 5',
      content: 'Content here...',
      wordCount: 2500,
      summary: 'Middle of story',
      editCount: 2,
      approved: true,
    };
    const result = ChapterContentSchema.parse(chapter);
    expect(result.approved).toBe(true);
    expect(result.editCount).toBe(2);
  });
});

describe('EditResultSchema', () => {
  it('should validate a passing edit result', () => {
    const result = EditResultSchema.parse({
      scores: { prose: 8, plot: 7, character: 9, pacing: 7, dialogue: 8, overall: 8 },
      editNotes: ['Great chapter overall'],
      approved: true,
      rewriteInstructions: '',
    });
    expect(result.approved).toBe(true);
  });

  it('should validate a failing edit result with rewrite instructions', () => {
    const result = EditResultSchema.parse({
      scores: { prose: 5, plot: 4, character: 6, pacing: 3, dialogue: 5, overall: 4 },
      editNotes: ['Pacing is too slow', 'Needs more conflict'],
      approved: false,
      rewriteInstructions: 'Speed up the middle section, add tension',
    });
    expect(result.approved).toBe(false);
    expect(result.rewriteInstructions).toBeDefined();
  });

  it('should reject scores out of range', () => {
    expect(() => EditResultSchema.parse({
      scores: { prose: 11, plot: 7, character: 9, pacing: 7, dialogue: 8, overall: 8 },
      editNotes: [],
      approved: true,
    })).toThrow();
  });
});

describe('DetailedChapterPlanSchema', () => {
  it('should validate a detailed chapter plan', () => {
    const plan = {
      chapterNumber: 1,
      title: 'The Beginning',
      scenes: [{
        number: 1,
        setting: 'A dark office',
        characters: ['Alice'],
        objective: 'Establish the protagonist',
        conflict: 'The computer crashes',
        resolution: 'Alice fixes it',
        targetWords: 1500,
      }],
      pov: 'Third person limited',
      tone: 'Mysterious',
      targetWords: 3000,
      bridgeFromPrevious: '',
      bridgeToNext: 'Alice discovers something strange in the logs',
    };
    expect(DetailedChapterPlanSchema.parse(plan)).toBeTruthy();
  });
});
