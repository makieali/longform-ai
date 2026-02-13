import { generateObject } from 'ai';
import type { RunnableConfig } from '@langchain/core/runnables';
import { BookState } from '../../schemas/state.js';
import { DetailedChapterPlanSchema } from '../../schemas/outline.js';
import { ProviderRegistry } from '../../providers/registry.js';
import { calculateCost } from '../../providers/cost-table.js';
import { buildPlannerSystemPrompt, buildPlannerUserPrompt } from '../../prompts/planner-prompts.js';
import type { MemoryProvider } from '../../memory/provider.js';

export async function plannerNode(
  state: typeof BookState.State,
  config: RunnableConfig,
): Promise<Partial<typeof BookState.State>> {
  const registry = config.configurable!.registry as ProviderRegistry;
  const memoryProvider = config.configurable?.memoryProvider as MemoryProvider | undefined;
  const model = registry.getModel('planning');
  const modelId = registry.getModelId('planning');

  const chapterPlan = state.outline!.chapters[state.currentChapter - 1];

  // Gather memory context if available
  let memoryContext = '';
  if (memoryProvider) {
    try {
      const context = await memoryProvider.getRelevantContext(
        chapterPlan.summary,
        state.currentChapter,
      );
      if (context.characterStates.length > 0) {
        memoryContext += '\n\n## Character States\n';
        for (const cs of context.characterStates) {
          memoryContext += `- ${cs.name}: ${cs.location}, ${cs.emotionalState}, alive=${cs.alive}\n`;
        }
      }
      if (context.recentEvents.length > 0) {
        memoryContext += '\n\n## Recent Events\n';
        for (const evt of context.recentEvents) {
          memoryContext += `- Ch${evt.chapter}: ${evt.event}\n`;
        }
      }
    } catch {
      // Memory retrieval failure is non-fatal
    }
  }

  const basePrompt = buildPlannerUserPrompt(
    chapterPlan,
    state.outline!,
    state.rollingSummary,
    state.config,
  );

  const { object: detailedPlan, usage } = await generateObject({
    model,
    schema: DetailedChapterPlanSchema,
    system: buildPlannerSystemPrompt(state.config),
    prompt: basePrompt + memoryContext,
    temperature: registry.getModelConfig('planning').temperature,
    maxTokens: registry.getModelConfig('planning').maxTokens,
  });

  return {
    currentDetailedPlan: detailedPlan,
    currentPhase: 'writing',
    editCount: 0,
    currentEditResult: null,
    costs: [{
      step: 'planning',
      model: modelId,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      cost: calculateCost(modelId, usage),
    }],
    pendingEvents: [{
      type: 'chapter_started',
      chapter: state.currentChapter,
      title: chapterPlan.title,
    }],
  };
}
