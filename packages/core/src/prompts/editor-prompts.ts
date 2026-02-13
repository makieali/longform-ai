import type { GenerationConfig, DetailedChapterPlan, Outline } from '../types.js';

export function buildEditorSystemPrompt(config: GenerationConfig): string {
  if (config.contentType === 'novel') {
    return `You are an experienced literary editor with a sharp eye for both craft and storytelling.

Evaluate the chapter on these criteria (score 1-10 each):
1. **Prose Quality** — sentence variety, word choice, rhythm, show-don't-tell
2. **Plot Advancement** — does the chapter advance the story meaningfully?
3. **Character Development** — are characters consistent, dimensional, and growing?
4. **Pacing** — does the chapter flow well? Too fast/slow? Scene balance?
5. **Dialogue** — is it natural, distinctive per character, and purposeful?
6. **Overall Quality** — holistic assessment of the chapter

Be constructive but honest. If the chapter needs work, provide specific, actionable feedback. If it's strong, approve it and move on.

A chapter needs a minimum overall score of 7 to pass. Below 7, provide detailed rewrite instructions.`;
  }

  if (config.contentType === 'technical-docs') {
    return `You are an expert technical editor reviewing documentation quality.

Evaluate the section on these criteria (score 1-10 each):
1. **Prose Quality** — clarity, conciseness, readability
2. **Technical Accuracy** — correctness and completeness of technical content (assessed as "plot")
3. **Examples** — quality and relevance of examples (assessed as "character")
4. **Structure** — organization, headings, flow (assessed as "pacing")
5. **Completeness** — coverage of all necessary topics (assessed as "dialogue")
6. **Overall Quality** — holistic assessment

A section needs a minimum overall score of 7 to pass.`;
  }

  return `You are an expert editor reviewing long-form content quality.

Evaluate the section on these criteria (score 1-10 each):
1. **Prose Quality** — writing quality, clarity, engagement
2. **Content Quality** — accuracy, depth, relevance (assessed as "plot")
3. **Supporting Material** — examples, evidence, illustrations (assessed as "character")
4. **Flow & Structure** — organization, transitions, pacing (assessed as "pacing")
5. **Completeness** — thoroughness of coverage (assessed as "dialogue")
6. **Overall Quality** — holistic assessment

A section needs a minimum overall score of 7 to pass.`;
}

export function buildEditorUserPrompt(
  chapterContent: string,
  plan: DetailedChapterPlan,
  outline: Outline,
  editCount: number,
  maxEditCycles: number,
): string {
  let prompt = `Review the following chapter:

**Chapter ${plan.chapterNumber}: "${plan.title}"**
**Word Count:** ~${chapterContent.split(/\s+/).length} words
**Edit Cycle:** ${editCount + 1} of ${maxEditCycles}

**Chapter Plan:**
${plan.scenes.map(s => `- Scene ${s.number}: ${s.objective}`).join('\n')}

**Overall Synopsis:** ${outline.synopsis}
**Themes:** ${outline.themes.join(', ')}

---

${chapterContent}

---

Evaluate this chapter and provide:
1. Scores for each criterion (1-10)
2. Specific edit notes (what works, what doesn't)
3. Whether the chapter is approved (overall score >= 7)
`;

  if (editCount > 0) {
    prompt += `\nThis is edit cycle ${editCount + 1}. The writer has already revised based on previous feedback. Be fair — if the chapter has improved significantly, approve it.`;
  }

  if (editCount + 1 >= maxEditCycles) {
    prompt += `\nThis is the FINAL edit cycle. Unless there are critical issues, approve the chapter.`;
  }

  prompt += `\nIf not approved, provide specific rewrite instructions focusing on the weakest areas. If approved, set rewriteInstructions to an empty string.`;

  return prompt;
}
