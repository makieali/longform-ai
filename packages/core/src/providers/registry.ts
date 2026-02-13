import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAzure } from '@ai-sdk/azure';
import type { LanguageModel } from 'ai';
import type { ProviderName, ProviderConfig, ModelConfig, ModelRole } from '../types.js';

type ProviderFactory = (config: ProviderConfig) => (modelId: string) => LanguageModel;

const PROVIDER_FACTORIES: Record<string, ProviderFactory> = {
  openai: (config) => {
    const provider = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    return (modelId: string) => provider(modelId);
  },
  anthropic: (config) => {
    const provider = createAnthropic({ apiKey: config.apiKey, baseURL: config.baseUrl });
    return (modelId: string) => provider(modelId);
  },
  google: (config) => {
    const provider = createGoogleGenerativeAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    return (modelId: string) => provider(modelId);
  },
  azure: (config) => {
    const endpoint = config.endpoint ?? config.baseUrl ?? process.env.AZURE_OPENAI_ENDPOINT;
    const apiVersion = config.apiVersion ?? process.env.AZURE_OPENAI_API_VERSION ?? '2025-04-01-preview';

    const providerOptions: Record<string, unknown> = {
      apiKey: config.apiKey,
      apiVersion,
    };

    if (endpoint) {
      // Use baseURL directly — strip trailing slash and append openai path
      providerOptions.baseURL = `${endpoint.replace(/\/$/, '')}/openai/deployments`;
      providerOptions.useDeploymentBasedUrls = true;
    }

    const provider = createAzure(providerOptions as any);
    return (modelId: string) => provider.chat(modelId);
  },
  deepseek: (config) => {
    // DeepSeek uses OpenAI-compatible API
    const provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl ?? 'https://api.deepseek.com/v1',
    });
    return (modelId: string) => provider(modelId);
  },
  ollama: (config) => {
    // Ollama uses OpenAI-compatible API
    const provider = createOpenAI({
      apiKey: config.apiKey ?? 'ollama',
      baseURL: config.baseUrl ?? 'http://localhost:11434/v1',
    });
    return (modelId: string) => provider(modelId);
  },
  openrouter: (config) => {
    const provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl ?? 'https://openrouter.ai/api/v1',
    });
    return (modelId: string) => provider(modelId);
  },
  mistral: (config) => {
    // Mistral uses OpenAI-compatible API
    const provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl ?? 'https://api.mistral.ai/v1',
    });
    return (modelId: string) => provider(modelId);
  },
};

// Environment variable names for each provider
const ENV_KEY_MAP: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  azure: 'AZURE_OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  mistral: 'MISTRAL_API_KEY',
};

export class ProviderRegistry {
  private providerConfigs: Map<string, ProviderConfig>;
  private modelConfigs: Map<ModelRole, ModelConfig>;
  private modelFactories: Map<string, (modelId: string) => LanguageModel> = new Map();

  constructor(
    providers: Partial<Record<ProviderName, ProviderConfig>>,
    models: Partial<Record<ModelRole, ModelConfig>> = {},
  ) {
    this.providerConfigs = new Map(Object.entries(providers));
    this.modelConfigs = new Map(Object.entries(models) as [ModelRole, ModelConfig][]);
  }

  /**
   * Get an AI SDK LanguageModel for a given role.
   * Resolves model config for the role, then creates/caches the provider.
   */
  getModel(role: ModelRole): LanguageModel {
    const modelConfig = this.modelConfigs.get(role);
    if (!modelConfig) {
      throw new Error(
        `No model configured for role "${role}". ` +
        `Configure it via models.${role} or use a preset.`
      );
    }

    const { provider, model } = modelConfig;
    const factory = this.getOrCreateFactory(provider);
    return factory(model);
  }

  /**
   * Get the model ID string for a role (for cost tracking)
   */
  getModelId(role: ModelRole): string {
    const modelConfig = this.modelConfigs.get(role);
    if (!modelConfig) {
      throw new Error(`No model configured for role "${role}".`);
    }
    return modelConfig.model;
  }

  /**
   * Get the full model config for a role
   */
  getModelConfig(role: ModelRole): ModelConfig {
    const modelConfig = this.modelConfigs.get(role);
    if (!modelConfig) {
      throw new Error(`No model configured for role "${role}".`);
    }
    return modelConfig;
  }

  /**
   * Check if a role has a model configured
   */
  hasModel(role: ModelRole): boolean {
    return this.modelConfigs.has(role);
  }

  /**
   * List all configured roles
   */
  getConfiguredRoles(): ModelRole[] {
    return Array.from(this.modelConfigs.keys());
  }

  private getOrCreateFactory(provider: string): (modelId: string) => LanguageModel {
    if (this.modelFactories.has(provider)) {
      return this.modelFactories.get(provider)!;
    }

    const factoryFn = PROVIDER_FACTORIES[provider];
    if (!factoryFn) {
      throw new Error(
        `Unknown provider "${provider}". Supported: ${Object.keys(PROVIDER_FACTORIES).join(', ')}`
      );
    }

    // Resolve API key: explicit config > environment variable
    let config = this.providerConfigs.get(provider) ?? {};
    if (!config.apiKey && ENV_KEY_MAP[provider]) {
      const envKey = process.env[ENV_KEY_MAP[provider]];
      if (envKey) {
        config = { ...config, apiKey: envKey };
      }
    }

    // For providers that require API keys (not ollama)
    if (!config.apiKey && provider !== 'ollama') {
      const envVar = ENV_KEY_MAP[provider] ?? `${provider.toUpperCase()}_API_KEY`;
      throw new Error(
        `No API key found for provider "${provider}". ` +
        `Set it via providers.${provider}.apiKey or the ${envVar} environment variable.`
      );
    }

    const factory = factoryFn(config);
    this.modelFactories.set(provider, factory);
    return factory;
  }
}
