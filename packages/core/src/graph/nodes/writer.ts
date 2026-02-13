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
import { detectRefusal, stripRefusalContent } from '../../utils/refusal-detection.js';
import { buildSummaryExtractionPrompt } from '../../prompts/continuity-prompts.js';
import type { MemoryProvider } from '../../memory/provider.js';
import type { CostEntry } from '../../types.js';

export function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Strips meta-commentary preamble that expand models sometimes prepend.
 * E.g., "Below is the expanded chapter. It is approximately 2100+ words..."
 */
function stripExpandPreamble(text: string): string {
  const lines = text.split('\n');
  let startIdx = 0;

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    if (!line) { startIdx = i + 1; continue; }
    if (/^(?:Below is|Here is|Here's|The following is|I've expanded|This is the|The expanded)/i.test(line)) {
      startIdx = i + 1;
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      startIdx = i + 1;
      continue;
    }
    break;
  }

  if (startIdx > 0) {
    return lines.slice(startIdx).join('\n').trim();
  }
  return text;
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

  // If all attempts were refusals, only use cleaned text if substantial.
  // Short fragments (< 100 words) are residual refusal text that the
  // expand loop would weave into meta-fiction. Discard them.
  if (!finalContent) {
    finalContent = bestCleanedWordCount >= 100 ? bestCleanedContent : '';
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

    let rawText: string;
    let expandUsage: { promptTokens: number; completionTokens: number };

    // When content is very short (< 50 words), generate from scratch using
    // the full writer prompt with plan context instead of the expand prompt.
    if (wordCount < 50) {
      const result = await generateText({
        model,
        system: buildWriterSystemPrompt(state.config),
        prompt: basePrompt + memoryContext,
        temperature: registry.getModelConfig('writing').temperature,
        maxTokens: expandMaxTokens,
      });
      rawText = result.text;
      expandUsage = result.usage;
    } else {
      const result = await generateText({
        model,
        system: buildExpandChapterSystemPrompt(),
        prompt: buildExpandChapterPrompt(finalContent, wordCount, plan.targetWords),
        maxTokens: expandMaxTokens,
      });
      rawText = result.text;
      expandUsage = result.usage;
    }

    // Check for refusal — reject entirely instead of using cleaned text
    const expandRefusal = detectRefusal(rawText);
    if (expandRefusal.isRefusal) {
      const cleanedCheck = detectRefusal(expandRefusal.cleanedText);
      if (cleanedCheck.isRefusal || countWords(expandRefusal.cleanedText) < 100) {
        // Refusal with no salvageable content — skip this attempt
        costs.push({
          step: 'writing_expand_refusal',
          model: modelId,
          inputTokens: expandUsage.promptTokens,
          outputTokens: expandUsage.completionTokens,
          cost: calculateCost(modelId, expandUsage),
        });
        continue;
      }
      // Cleaned text is substantial and clean — use it
      const cleanedWordCount = countWords(expandRefusal.cleanedText);
      if (cleanedWordCount > wordCount) {
        finalContent = expandRefusal.cleanedText;
        wordCount = cleanedWordCount;
      }
      costs.push({
        step: 'writing_expand',
        model: modelId,
        inputTokens: expandUsage.promptTokens,
        outputTokens: expandUsage.completionTokens,
        cost: calculateCost(modelId, expandUsage),
      });
      continue;
    }

    // Strip expand preamble (e.g., "Below is the expanded chapter...")
    const stripped = stripExpandPreamble(rawText);

    // Only accept expansion if it's actually longer
    const expandedWordCount = countWords(stripped);
    if (expandedWordCount > wordCount) {
      finalContent = stripped;
      wordCount = expandedWordCount;
    } else {
      // Model returned shorter content — stop expanding, keep best version
      break;
    }

    costs.push({
      step: wordCount < 50 ? 'writing_fresh_generate' : 'writing_expand',
      model: modelId,
      inputTokens: expandUsage.promptTokens,
      outputTokens: expandUsage.completionTokens,
      cost: calculateCost(modelId, expandUsage),
    });
  }

  // Full-text refusal scan — catch any raw refusal blocks mid-chapter
  finalContent = stripRefusalContent(finalContent);
  wordCount = countWords(finalContent);

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
