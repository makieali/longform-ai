import type { GenerationConfig, Outline, ChapterPlan, ContentType } from '../types.js';

export function buildPlannerSystemPrompt(config: GenerationConfig): string {
  const isNarrative = ['novel', 'screenplay'].includes(config.contentType);

  if (isNarrative) {
    return `You are a meticulous story planner who transforms chapter outlines into detailed scene-by-scene blueprints.

Your job is to take a chapter summary and expand it into a comprehensive writing plan that includes:
- Detailed scene breakdowns with settings, characters, objectives, conflicts, and resolutions
- Point of view and tone guidance
- Word count targets per scene
- Transition text to bridge from the previous chapter
- Setup for the next chapter

Your plans should give a writer everything they need to produce a compelling chapter without ambiguity. Be specific about emotional beats, character interactions, and narrative tension.`;
  }

  return `You are a meticulous content planner who transforms section outlines into detailed writing blueprints.

Your job is to take a section summary and expand it into a comprehensive writing plan that includes:
- Detailed subsection breakdowns with topics, examples, and key points
- Tone and depth guidance
- Word count targets per subsection
- Transition text to connect from the previous section
- Setup for the next section

Your plans should give a writer everything they need to produce a comprehensive section without ambiguity. Be specific about examples, explanations, and supporting evidence needed.`;
}

export function buildPlannerUserPrompt(
  chapterPlan: ChapterPlan,
  outline: Outline,
  rollingSummary: string,
  config: GenerationConfig,
): string {
  const isFirst = chapterPlan.number === 1;
  const isLast = chapterPlan.number === outline.chapters.length;
  const prevChapter = !isFirst ? outline.chapters[chapterPlan.number - 2] : null;
  const nextChapter = !isLast ? outline.chapters[chapterPlan.number] : null;

  let prompt = `Create a detailed writing plan for the following chapter:

**Chapter ${chapterPlan.number}: ${chapterPlan.title}**
**Summary:** ${chapterPlan.summary}
**Target Words:** ${chapterPlan.targetWords}
**Key Events:** ${chapterPlan.keyEvents.join(', ')}
**Characters:** ${chapterPlan.characters.join(', ')}

**Full Outline Synopsis:** ${outline.synopsis}
**Themes:** ${outline.themes.join(', ')}
`;

  if (rollingSummary) {
    prompt += `\n**Story So Far (Rolling Summary):**\n${rollingSummary}\n`;
  }

  if (prevChapter) {
    prompt += `\n**Previous Chapter (${prevChapter.number}: ${prevChapter.title}):** ${prevChapter.summary}\n`;
  }

  if (nextChapter) {
    prompt += `\n**Next Chapter (${nextChapter.number}: ${nextChapter.title}):** ${nextChapter.summary}\n`;
  }

  if (isFirst) {
    prompt += `\nThis is the FIRST chapter — establish the world, introduce key characters, and hook the reader.`;
  } else if (isLast) {
    prompt += `\nThis is the FINAL chapter — resolve all major plot threads and provide a satisfying conclusion.`;
  }

  prompt += `\n\nBreak this chapter into detailed scenes. Each scene needs a specific setting, characters present, clear objective, conflict/tension, and resolution. Provide specific word count targets that sum to approximately ${chapterPlan.targetWords} words.`;

  return prompt;
}
