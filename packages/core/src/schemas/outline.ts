import { z } from 'zod';

export const CharacterProfileSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['protagonist', 'antagonist', 'supporting', 'minor']),
  description: z.string().min(1),
  traits: z.array(z.string()).min(1),
  arc: z.string(),
});

export const ChapterPlanSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(1),
  targetWords: z.number().positive(),
  keyEvents: z.array(z.string()),
  characters: z.array(z.string()),
});

export const OutlineSchema = z.object({
  title: z.string().min(1),
  synopsis: z.string().min(10),
  themes: z.array(z.string()).min(1),
  targetAudience: z.string().min(1),
  chapters: z.array(ChapterPlanSchema).min(1),
  characters: z.array(CharacterProfileSchema),
});

export const ScenePlanSchema = z.object({
  number: z.number().int().positive(),
  setting: z.string().min(1),
  characters: z.array(z.string()).min(1),
  objective: z.string().min(1),
  conflict: z.string(),
  resolution: z.string(),
  targetWords: z.number().positive(),
});

export const DetailedChapterPlanSchema = z.object({
  chapterNumber: z.number().int().positive(),
  title: z.string().min(1),
  scenes: z.array(ScenePlanSchema).min(1),
  pov: z.string(),
  tone: z.string(),
  targetWords: z.number().positive(),
  bridgeFromPrevious: z.string(),
  bridgeToNext: z.string(),
});
