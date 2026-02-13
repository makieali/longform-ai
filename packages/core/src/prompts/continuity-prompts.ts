import type { GenerationConfig, ChapterContent, CharacterState, Outline } from '../types.js';

export function buildContinuitySystemPrompt(config: GenerationConfig): string {
  return `You are a continuity expert ensuring coherence across a long-form ${config.contentType === 'novel' ? 'narrative' : 'document'}.

Your job is to:
1. Create a concise rolling summary (max ~2000 words) capturing all essential information from the story so far
2. Track character states, relationships, and development
3. Note any continuity issues or plot threads that need resolution

The rolling summary should capture:
- Key events and their consequences
- Character positions, emotional states, and relationships
- Unresolved plot threads and setups
- World state changes (locations, time progression, etc.)
- Themes and their development

Be concise but comprehensive. This summary will be the primary context for writing future chapters, so nothing important should be lost.`;
}

export function buildContinuityUserPrompt(
  chapters: ChapterContent[],
  currentChapter: ChapterContent,
  previousSummary: string,
  outline: Outline,
  characterStates: CharacterState[],
): string {
  let prompt = `Update the rolling summary after Chapter ${currentChapter.number}: "${currentChapter.title}".\n\n`;

  if (previousSummary) {
    prompt += `**Previous Rolling Summary:**\n${previousSummary}\n\n`;
  }

  prompt += `**New Chapter Content (Chapter ${currentChapter.number}):**\n${currentChapter.content}\n\n`;

  prompt += `**Overall Outline:**\nSynopsis: ${outline.synopsis}\nRemaining chapters: ${outline.chapters.length - currentChapter.number}\n\n`;

  if (characterStates.length > 0) {
    prompt += `**Current Character States:**\n`;
    for (const cs of characterStates) {
      prompt += `- ${cs.name}: ${cs.location}, ${cs.emotionalState}, alive=${cs.alive}\n`;
    }
    prompt += '\n';
  }

  prompt += `Create an updated rolling summary that:
1. Incorporates all events from Chapter ${currentChapter.number}
2. Maintains all unresolved plot threads
3. Updates character positions and states
4. Notes any new themes or developments
5. Stays under 2000 words

Also identify any continuity issues (contradictions, forgotten plot threads, inconsistent character behavior).`;

  return prompt;
}

export function buildSummaryExtractionPrompt(chapterContent: string, chapterNumber: number): string {
  return `Provide a concise summary (2-3 paragraphs) of the following chapter content. Focus on:
- Key events and plot developments
- Character actions and emotional changes
- Setting and atmosphere changes
- Any setups or foreshadowing

Chapter ${chapterNumber}:
${chapterContent}

Write only the summary, nothing else.`;
}
