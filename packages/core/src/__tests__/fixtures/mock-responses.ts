import type { Outline, DetailedChapterPlan, EditResult, ChapterContent } from '../../types.js';

export const mockOutline: Outline = {
  title: 'The Code That Changed Everything',
  synopsis: 'A software developer discovers a mysterious pattern in legacy code.',
  themes: ['technology', 'ethics', 'perseverance'],
  targetAudience: 'adult fiction readers',
  chapters: [
    { number: 1, title: 'The Discovery', summary: 'Alice finds a pattern.', targetWords: 3000, keyEvents: ['Pattern found'], characters: ['Alice'] },
    { number: 2, title: 'Down the Rabbit Hole', summary: 'Alice investigates deeper.', targetWords: 3000, keyEvents: ['Hidden system'], characters: ['Alice', 'Bob'] },
    { number: 3, title: 'The Truth', summary: 'The truth is revealed.', targetWords: 3000, keyEvents: ['Truth revealed'], characters: ['Alice', 'Bob', 'Director'] },
  ],
  characters: [
    { name: 'Alice', role: 'protagonist', description: 'A developer', traits: ['analytical', 'determined'], arc: 'Rule-follower to whistleblower' },
    { name: 'Bob', role: 'supporting', description: 'Colleague', traits: ['loyal'], arc: 'Bystander to ally' },
    { name: 'Director', role: 'antagonist', description: 'Company director', traits: ['calculating'], arc: 'Leader to villain' },
  ],
};

export const mockDetailedPlan: DetailedChapterPlan = {
  chapterNumber: 1,
  title: 'The Discovery',
  scenes: [
    { number: 1, setting: 'Office at night', characters: ['Alice'], objective: 'Establish Alice and the discovery', conflict: 'Strange code pattern', resolution: 'Alice decides to investigate', targetWords: 1500 },
    { number: 2, setting: 'Server room', characters: ['Alice'], objective: 'Deeper investigation', conflict: 'Access issues', resolution: 'Alice finds more clues', targetWords: 1500 },
  ],
  pov: 'Third person limited (Alice)',
  tone: 'Mysterious, suspenseful',
  targetWords: 3000,
  bridgeFromPrevious: '',
  bridgeToNext: 'Alice decides to tell Bob about her findings',
};

export const mockApprovedEdit: EditResult = {
  scores: { prose: 8, plot: 8, character: 7, pacing: 8, dialogue: 7, overall: 8 },
  editNotes: ['Strong atmosphere', 'Good pacing in the discovery scene', 'Alice is well-established'],
  approved: true,
};

export const mockRejectedEdit: EditResult = {
  scores: { prose: 5, plot: 6, character: 4, pacing: 5, dialogue: 5, overall: 5 },
  editNotes: ['Pacing drags in the middle', 'Need more internal conflict', 'Alice feels passive'],
  approved: false,
  rewriteInstructions: 'Add more internal monologue showing Alice wrestling with the decision to investigate. Speed up the middle section.',
};

export const mockChapterContent: ChapterContent = {
  number: 1,
  title: 'The Discovery',
  content: 'Alice sat at her desk, the glow of three monitors casting blue light across her face...',
  wordCount: 3000,
  summary: 'Alice discovers a suspicious code pattern during a late-night review.',
  editCount: 1,
  approved: true,
};

export function createMockGenerateText() {
  let callCount = 0;
  return async (opts: any) => {
    callCount++;
    const prompt = opts.prompt || opts.system || '';

    if (opts.output) {
      if (prompt.includes('outline') || prompt.includes('Create a detailed outline')) {
        return { experimental_output: mockOutline, text: JSON.stringify(mockOutline), usage: { promptTokens: 500, completionTokens: 1500 } };
      }
      if (prompt.includes('writing plan') || prompt.includes('Break this chapter')) {
        return { experimental_output: mockDetailedPlan, text: JSON.stringify(mockDetailedPlan), usage: { promptTokens: 800, completionTokens: 600 } };
      }
      if (prompt.includes('Review') || prompt.includes('Evaluate')) {
        return { experimental_output: mockApprovedEdit, text: JSON.stringify(mockApprovedEdit), usage: { promptTokens: 2000, completionTokens: 400 } };
      }
    }

    if (prompt.includes('Write Chapter') || prompt.includes('Write the complete')) {
      return { text: mockChapterContent.content, usage: { promptTokens: 1500, completionTokens: 2000 } };
    }
    if (prompt.includes('summary') || prompt.includes('Provide a concise')) {
      return { text: mockChapterContent.summary, usage: { promptTokens: 500, completionTokens: 100 } };
    }
    if (prompt.includes('rolling summary') || prompt.includes('Update the rolling')) {
      return { text: 'Rolling summary of story so far.', usage: { promptTokens: 1000, completionTokens: 300 } };
    }

    return { text: 'Generated content', usage: { promptTokens: 100, completionTokens: 100 } };
  };
}
