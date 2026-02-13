import { generateObject } from 'ai';
import type { RunnableConfig } from '@langchain/core/runnables';
import { BookState } from '../../schemas/state.js';
import { OutlineSchema } from '../../schemas/outline.js';
import { ProviderRegistry } from '../../providers/registry.js';
import { calculateCost } from '../../providers/cost-table.js';
import { buildOutlineSystemPrompt, buildOutlineUserPrompt } from '../../prompts/outline-prompts.js';

export async function outlineNode(
  state: typeof BookState.State,
  config: RunnableConfig,
): Promise<Partial<typeof BookState.State>> {
  const registry = config.configurable!.registry as ProviderRegistry;
  const model = registry.getModel('outline');
  const modelId = registry.getModelId('outline');

  const { object: outline, usage } = await generateObject({
    model,
    schema: OutlineSchema,
    system: buildOutlineSystemPrompt(state.config),
    prompt: buildOutlineUserPrompt(state.title, state.description, state.config),
    temperature: registry.getModelConfig('outline').temperature,
    maxTokens: registry.getModelConfig('outline').maxTokens,
  });

  return {
    outline,
    currentPhase: 'planning',
    currentChapter: 1,
    costs: [{
      step: 'outline',
      model: modelId,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      cost: calculateCost(modelId, usage),
    }],
    pendingEvents: [{
      type: 'outline_complete',
      outline,
    }],
  };
}
