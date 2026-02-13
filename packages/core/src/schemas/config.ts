import { z } from 'zod';

export const ContentTypeSchema = z.enum([
  'novel', 'technical-docs', 'course', 'screenplay',
  'research-paper', 'marketing', 'legal', 'sop',
]);

export const ProviderNameSchema = z.enum([
  'openai', 'anthropic', 'google', 'deepseek',
  'ollama', 'openrouter', 'mistral', 'azure',
]);

export const ModelRoleSchema = z.enum([
  'outline', 'planning', 'writing', 'editing', 'continuity', 'embedding',
]);

export const ModelConfigSchema = z.object({
  provider: ProviderNameSchema,
  model: z.string(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().positive().optional().default(4096),
});

export const GenerationConfigSchema = z.object({
  contentType: ContentTypeSchema.default('novel'),
  targetWords: z.number().positive().default(50000),
  chaptersCount: z.number().int().positive().min(1).max(100).default(20),
  maxEditCycles: z.number().int().min(0).max(10).default(3),
  humanReview: z.boolean().default(false),
  models: z.record(ModelRoleSchema, ModelConfigSchema).default({}),
});
