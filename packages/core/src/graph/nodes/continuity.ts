import { generateText } from 'ai';
import type { RunnableConfig } from '@langchain/core/runnables';
import { interrupt } from '@langchain/langgraph';
import { BookState } from '../../schemas/state.js';
import { ProviderRegistry } from '../../providers/registry.js';
import { calculateCost } from '../../providers/cost-table.js';
import { buildContinuitySystemPrompt, buildContinuityUserPrompt } from '../../prompts/continuity-prompts.js';
import type { ChapterContent, CharacterState } from '../../types.js';
import type { MemoryProvider } from '../../memory/provider.js';

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

export async function continuityNode(
  state: typeof BookState.State,
  config: RunnableConfig,
): Promise<Partial<typeof BookState.State>> {
  const registry = config.configurable!.registry as ProviderRegistry;
  const memoryProvider = config.configurable?.memoryProvider as MemoryProvider | undefined;
  const model = registry.getModel('continuity');
  const modelId = registry.getModelId('continuity');

  // Build the completed chapter
  const completedChapter: ChapterContent = {
    number: state.currentChapter,
    title: state.currentDetailedPlan!.title,
    content: state.currentDraft,
    wordCount: countWords(state.currentDraft),
    summary: '', // Will be updated from rolling summary
    editCount: state.editCount,
    approved: true,
  };

  // Generate updated rolling summary
  const { text: generatedSummary, usage } = await generateText({
    model,
    system: buildContinuitySystemPrompt(state.config),
    prompt: buildContinuityUserPrompt(
      state.chapters,
      completedChapter,
      state.rollingSummary,
      state.outline!,
      state.characterStates,
    ),
    temperature: registry.getModelConfig('continuity').temperature,
    maxTokens: registry.getModelConfig('continuity').maxTokens,
  });

  // Enforce rolling summary length
  const maxSummaryWords = 2000;
  let newSummary = generatedSummary;
  if (countWords(newSummary) > maxSummaryWords) {
    try {
      const { text: condensed } = await generateText({
        model,
        prompt: `Condense this summary to under ${maxSummaryWords} words while preserving all plot-critical information:\n\n${newSummary}`,
        maxTokens: Math.floor(maxSummaryWords * 1.3),
      });
      newSummary = condensed;
    } catch {
      // If condensation fails, truncate by sentences
      const sentences = newSummary.split(/(?<=[.!?])\s+/);
      let truncated = '';
      for (const sentence of sentences) {
        if (countWords(truncated + sentence) > maxSummaryWords) break;
        truncated += (truncated ? ' ' : '') + sentence;
      }
      newSummary = truncated;
    }
  }

  // Extract last ~2000 chars for chapter ending bridge
  const previousChapterEnding = state.currentDraft.slice(-2000);

  // Update chapter summary from rolling context
  completedChapter.summary = newSummary.slice(0, 500);

  // Store in memory system if available
  let updatedCharacterStates: CharacterState[] = state.characterStates;
  if (memoryProvider) {
    try {
      await memoryProvider.storeChapter(
        state.currentChapter,
        state.currentDraft,
        completedChapter.summary,
        { title: completedChapter.title },
      );
      updatedCharacterStates = await memoryProvider.updateCharacterStates(
        state.currentChapter,
        state.currentDraft,
        state.characterStates,
      );
      await memoryProvider.addTimelineEvents(state.currentChapter, state.currentDraft);
      await memoryProvider.updateWorldState(state.currentChapter, state.currentDraft);
    } catch {
      // Memory storage failure is non-fatal
    }
  }

  // Handle human-in-the-loop review
  if (state.config.humanReview) {
    const feedback = interrupt({
      chapter: state.currentChapter,
      title: completedChapter.title,
      wordCount: completedChapter.wordCount,
      message: `Chapter ${state.currentChapter}: "${completedChapter.title}" is ready for review (${completedChapter.wordCount} words)`,
    });

    // If human provides feedback, it comes through Command({ resume: feedback })
    if (feedback && typeof feedback === 'object') {
      const humanFeedback = feedback as { approved?: boolean; notes?: string; editInstructions?: string };
      if (humanFeedback.approved === false) {
        // Human rejected — go back to writing
        return {
          currentPhase: 'writing',
          characterStates: updatedCharacterStates,
          humanFeedback: {
            approved: false,
            notes: humanFeedback.notes,
            editInstructions: humanFeedback.editInstructions,
          },
          currentEditResult: {
            scores: { prose: 5, plot: 5, character: 5, pacing: 5, dialogue: 5, overall: 5 },
            editNotes: [humanFeedback.notes ?? 'Human reviewer requested changes'],
            approved: false,
            rewriteInstructions: humanFeedback.editInstructions ?? humanFeedback.notes,
          },
          costs: [{
            step: 'continuity',
            model: modelId,
            inputTokens: usage.promptTokens,
            outputTokens: usage.completionTokens,
            cost: calculateCost(modelId, usage),
          }],
        };
      }
    }
  }

  const nextChapter = state.currentChapter + 1;

  return {
    chapters: [completedChapter],
    rollingSummary: newSummary,
    previousChapterEnding,
    currentChapter: nextChapter,
    currentPhase: nextChapter <= state.outline!.chapters.length ? 'planning' : 'complete',
    totalWordsWritten: completedChapter.wordCount,
    characterStates: updatedCharacterStates,
    humanFeedback: null,
    costs: [{
      step: 'continuity',
      model: modelId,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      cost: calculateCost(modelId, usage),
    }],
    pendingEvents: [{
      type: 'chapter_complete',
      chapter: state.currentChapter,
      title: completedChapter.title,
      wordCount: completedChapter.wordCount,
    }],
  };
}
