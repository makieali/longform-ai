import { generateObject } from 'ai';
import type { RunnableConfig } from '@langchain/core/runnables';
import { BookState } from '../../schemas/state.js';
import { EditResultSchema } from '../../schemas/content.js';
import { ProviderRegistry } from '../../providers/registry.js';
import { calculateCost } from '../../providers/cost-table.js';
import { buildEditorSystemPrompt, buildEditorUserPrompt } from '../../prompts/editor-prompts.js';

export async function editorNode(
  state: typeof BookState.State,
  config: RunnableConfig,
): Promise<Partial<typeof BookState.State>> {
  const registry = config.configurable!.registry as ProviderRegistry;
  const model = registry.getModel('editing');
  const modelId = registry.getModelId('editing');
  const plan = state.currentDetailedPlan!;

  const { object: editResult, usage } = await generateObject({
    model,
    schema: EditResultSchema,
    system: buildEditorSystemPrompt(state.config),
    prompt: buildEditorUserPrompt(
      state.currentDraft,
      plan,
      state.outline!,
      state.editCount,
      state.config.maxEditCycles,
    ),
    temperature: registry.getModelConfig('editing').temperature,
    maxTokens: registry.getModelConfig('editing').maxTokens,
  });

  const newEditCount = state.editCount + 1;

  return {
    currentEditResult: editResult,
    editCount: newEditCount,
    currentPhase: editResult.approved ? 'continuity' : 'writing',
    costs: [{
      step: 'editing',
      model: modelId,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      cost: calculateCost(modelId, usage),
    }],
    pendingEvents: [{
      type: 'edit_cycle',
      chapter: state.currentChapter,
      cycle: newEditCount,
      approved: editResult.approved,
      scores: editResult.scores,
    }],
  };
}
