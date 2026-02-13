import type { ModelConfig, ModelRole } from '../types.js';

export type PresetName = 'budget' | 'balanced' | 'premium' | 'azure';

const BUDGET_PRESET: Record<ModelRole, ModelConfig> = {
  outline: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 8192 },
  planning: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 },
  writing: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.8, maxTokens: 8192 },
  editing: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 4096 },
  continuity: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 4096 },
  embedding: { provider: 'openai', model: 'text-embedding-3-small', temperature: 0, maxTokens: 8192 },
};

const BALANCED_PRESET: Record<ModelRole, ModelConfig> = {
  outline: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.7, maxTokens: 8192 },
  planning: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 },
  writing: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.8, maxTokens: 8192 },
  editing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.3, maxTokens: 4096 },
  continuity: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 4096 },
  embedding: { provider: 'openai', model: 'text-embedding-3-small', temperature: 0, maxTokens: 8192 },
};

const PREMIUM_PRESET: Record<ModelRole, ModelConfig> = {
  outline: { provider: 'anthropic', model: 'claude-opus-4-6', temperature: 0.7, maxTokens: 8192 },
  planning: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.7, maxTokens: 4096 },
  writing: { provider: 'anthropic', model: 'claude-opus-4-6', temperature: 0.8, maxTokens: 16384 },
  editing: { provider: 'openai', model: 'gpt-4.1', temperature: 0.3, maxTokens: 4096 },
  continuity: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.3, maxTokens: 4096 },
  embedding: { provider: 'openai', model: 'text-embedding-3-large', temperature: 0, maxTokens: 8192 },
};

// Azure preset: uses a single deployment for all roles.
// Temperature and maxTokens intentionally omitted — Azure defaults are sufficient.
// Users set the deployment name via the `model` field (defaults to env var AZURE_OPENAI_DEPLOYMENT).
const AZURE_PRESET: Record<ModelRole, ModelConfig> = {
  outline: { provider: 'azure', model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o' },
  planning: { provider: 'azure', model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o' },
  writing: { provider: 'azure', model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o' },
  editing: { provider: 'azure', model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o' },
  continuity: { provider: 'azure', model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o' },
  embedding: { provider: 'azure', model: 'text-embedding-ada-002' },
};

const PRESETS: Record<PresetName, Record<ModelRole, ModelConfig>> = {
  budget: BUDGET_PRESET,
  balanced: BALANCED_PRESET,
  premium: PREMIUM_PRESET,
  azure: AZURE_PRESET,
};

/**
 * Resolve a preset into model configs.
 * User-specified models override preset defaults.
 */
export function resolvePreset(
  preset: PresetName,
  overrides: Partial<Record<ModelRole, ModelConfig>> = {},
): Record<ModelRole, ModelConfig> {
  const base = PRESETS[preset];
  if (!base) {
    throw new Error(`Unknown preset "${preset}". Available: ${Object.keys(PRESETS).join(', ')}`);
  }
  return { ...base, ...overrides };
}

export function getPresetNames(): PresetName[] {
  return Object.keys(PRESETS) as PresetName[];
}

export function getPreset(name: PresetName): Record<ModelRole, ModelConfig> {
  return { ...PRESETS[name] };
}
