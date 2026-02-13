import { generateText, Output } from 'ai';
import type { RunnableConfig } from '@langchain/core/runnables';
import { BookState } from '../../schemas/state.js';
import { ProviderRegistry } from '../../providers/registry.js';
import { calculateCost } from '../../providers/cost-table.js';
import {
  buildWriterSystemPrompt,
  buildWriterUserPrompt,
  buildExpandChapterPrompt,
  buildExpandChapterSystemPrompt,
  buildAntiRefusalRetryPrompt,
} from '../../prompts/writer-prompts.js';
import { detectRefusal } from '../../utils/refusal-detection.js';
import { buildSummaryExtractionPrompt } from '../../prompts/continuity-prompts.js';
import type { MemoryProvider } from '../../memory/provider.js';
import type { CostEntry } from '../../types.js';

export function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

export async function writerNode(
  state: typeof BookState.State,
  config: RunnableConfig,
): Promise<Partial<typeof BookState.State>> {
  const registry = config.configurable!.registry as ProviderRegistry;
  const memoryProvider = config.configurable?.memoryProvider as MemoryProvider | undefined;
  const model = registry.getModel('writing');
  const modelId = registry.getModelId('writing');
  const plan = state.currentDetailedPlan!;

  // Build edit instructions if this is a rewrite
  const editInstructions = state.currentEditResult?.approved === false
    ? state.currentEditResult.rewriteInstructions
    : undefined;

  // Gather memory context if available
  let memoryContext = '';
  if (memoryProvider) {
    try {
      const context = await memoryProvider.getRelevantContext(
        plan.title,
        state.currentChapter,
      );
      if (context.relevantPassages.length > 0) {
        memoryContext += '\n\n## Relevant Previous Passages\n';
        for (const p of context.relevantPassages.slice(0, 3)) {
          memoryContext += `[Chapter ${p.chapter}]: ${p.text}\n\n`;
        }
      }
      if (context.characterStates.length > 0) {
        memoryContext += '\n\n## Current Character States\n';
        for (const cs of context.characterStates) {
          memoryContext += `- ${cs.name}: at ${cs.location}, feeling ${cs.emotionalState}\n`;
        }
      }
    } catch {
      // Memory retrieval failure is non-fatal
    }
  }

  const basePrompt = buildWriterUserPrompt(
    plan,
    state.rollingSummary,
    state.previousChapterEnding,
    state.config,
    editInstructions,
  );

  // Set maxTokens to at least target * 1.5 (tokens ≈ 1.3x words, with buffer)
  const configuredMaxTokens = registry.getModelConfig('writing').maxTokens ?? 4096;
  const minTokensForTarget = Math.ceil(plan.targetWords * 1.5);
  const maxTokens = Math.max(configuredMaxTokens, minTokensForTarget);

  // Generate with refusal detection and retry
  let finalContent = '';
  let bestCleanedContent = '';
  let bestCleanedWordCount = 0;
  const costs: CostEntry[] = [];
  const maxRefusalRetries = 3;

  for (let attempt = 0; attempt <= maxRefusalRetries; attempt++) {
    const prompt = attempt === 0
      ? basePrompt + memoryContext
      : buildAntiRefusalRetryPrompt(basePrompt + memoryContext, attempt);

    const { text, usage: attemptUsage } = await generateText({
      model,
      system: buildWriterSystemPrompt(state.config),
      prompt,
      temperature: registry.getModelConfig('writing').temperature,
      maxTokens,
    });

    costs.push({
      step: attempt === 0 ? 'writing' : 'writing_refusal_retry',
      model: modelId,
      inputTokens: attemptUsage.promptTokens,
      outputTokens: attemptUsage.completionTokens,
      cost: calculateCost(modelId, attemptUsage),
    });

    const refusal = detectRefusal(text);
    if (!refusal.isRefusal) {
      finalContent = text;
      break;
    }

    // Track the best cleaned version only if it's genuinely clean
    const cleanedRefusal = detectRefusal(refusal.cleanedText);
    if (!cleanedRefusal.isRefusal) {
      const cleanedWordCount = countWords(refusal.cleanedText);
      if (cleanedWordCount > bestCleanedWordCount) {
        bestCleanedContent = refusal.cleanedText;
        bestCleanedWordCount = cleanedWordCount;
      }
    }
  }

  // If all attempts were refusals, use the best cleaned text
  if (!finalContent) {
    finalContent = bestCleanedContent;
  }

  let wordCount = countWords(finalContent);
  const pendingEvents: Array<{ type: string; [key: string]: unknown }> = [{
    type: 'chapter_written',
    chapter: state.currentChapter,
    wordCount,
  }];

  // Expand loop: if chapter is too short, expand up to 3 times
  const tolerance = 0.15;
  const minAcceptable = Math.floor(plan.targetWords * (1 - tolerance));
  let expandAttempts = 0;

  while (wordCount < minAcceptable && expandAttempts < 3) {
    expandAttempts++;

    pendingEvents.push({
      type: 'expand_attempt',
      chapter: state.currentChapter,
      attempt: expandAttempts,
      currentWords: wordCount,
      targetWords: plan.targetWords,
    });

    const deficit = plan.targetWords - wordCount;
    const expandMaxTokens = Math.max(deficit * 2, 4096);

    const { text: rawExpanded, usage: expandUsage } = await generateText({
      model,
      system: buildExpandChapterSystemPrompt(),
      prompt: buildExpandChapterPrompt(finalContent, wordCount, plan.targetWords),
      maxTokens: expandMaxTokens,
    });

    // Strip refusal preamble if present
    const expandRefusal = detectRefusal(rawExpanded);
    const expanded = expandRefusal.isRefusal ? expandRefusal.cleanedText : rawExpanded;

    // Only accept expansion if it's actually longer
    const expandedWordCount = countWords(expanded);
    if (expandedWordCount > wordCount) {
      finalContent = expanded;
      wordCount = expandedWordCount;
    } else {
      // Model returned shorter content — stop expanding, keep best version
      break;
    }

    costs.push({
      step: 'writing_expand',
      model: modelId,
      inputTokens: expandUsage.promptTokens,
      outputTokens: expandUsage.completionTokens,
      cost: calculateCost(modelId, expandUsage),
    });
  }

  // Flag if still below minimum after expansion
  if (wordCount < minAcceptable) {
    pendingEvents.push({
      type: 'word_count_warning',
      chapter: state.currentChapter,
      target: plan.targetWords,
      actual: wordCount,
    });
  }

  // Generate a quick summary of what was written
  let summary = '';
  try {
    const continuityModel = registry.hasModel('continuity')
      ? registry.getModel('continuity')
      : model;
    const { text: summaryText } = await generateText({
      model: continuityModel,
      prompt: buildSummaryExtractionPrompt(finalContent, state.currentChapter),
      maxTokens: 1024,
    });
    summary = summaryText;
  } catch {
    // If summary generation fails, use first 500 chars as fallback
    summary = finalContent.slice(0, 500) + '...';
  }

  return {
    currentDraft: finalContent,
    currentPhase: 'editing',
    costs,
    pendingEvents,
  };
}
