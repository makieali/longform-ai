import { z } from 'zod';

export const ChapterContentSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  content: z.string().min(1),
  wordCount: z.number().nonnegative(),
  summary: z.string(),
  editCount: z.number().int().nonnegative().default(0),
  approved: z.boolean().default(false),
});

export const EditScoresSchema = z.object({
  prose: z.number().min(1).max(10),
  plot: z.number().min(1).max(10),
  character: z.number().min(1).max(10),
  pacing: z.number().min(1).max(10),
  dialogue: z.number().min(1).max(10),
  overall: z.number().min(1).max(10),
});

export const EditResultSchema = z.object({
  scores: EditScoresSchema,
  editNotes: z.array(z.string()),
  approved: z.boolean(),
  rewriteInstructions: z.string(),
});
