import type { ContextItem, AssembledContext } from '../types.js';
import type { DetailedChapterPlan } from '../types.js';

export class TokenBudget {
  constructor(private maxInputTokens: number = 128000) {}

  /**
   * Estimate tokens for a string (fast heuristic: chars / 4)
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Build context that fits within budget, prioritizing higher-priority items.
   * Items with `required: true` are always included.
   * Items are sorted by priority (higher = more important) and included until budget is exhausted.
   */
  buildContext(items: ContextItem[], budget: number): AssembledContext {
    // Sort by priority descending
    const sorted = [...items].sort((a, b) => b.priority - a.priority);

    const included: string[] = [];
    const dropped: string[] = [];
    const parts: string[] = [];
    let totalTokens = 0;

    // First pass: include required items
    for (const item of sorted) {
      if (item.required) {
        const tokens = this.estimateTokens(item.content);
        parts.push(item.content);
        included.push(item.key);
        totalTokens += tokens;
      }
    }

    // Second pass: include optional items by priority
    for (const item of sorted) {
      if (item.required) continue;

      const tokens = this.estimateTokens(item.content);
      if (totalTokens + tokens <= budget) {
        parts.push(item.content);
        included.push(item.key);
        totalTokens += tokens;
      } else {
        dropped.push(item.key);
      }
    }

    return {
      text: parts.join('\n\n'),
      totalTokens,
      includedItems: included,
      droppedItems: dropped,
    };
  }

  /**
   * Assemble writer context with priority-based inclusion.
   * Priority order:
   *   1. System prompt (required)
   *   2. Current chapter plan (required)
   *   3. Previous chapter ending (high priority)
   *   4. Rolling summary (medium priority)
   *   5. Memory context (low priority)
   */
  assembleWriterContext(
    plan: DetailedChapterPlan,
    rollingSummary: string,
    previousChapterEnding: string,
    memoryContext: string,
    systemPromptTokens: number,
  ): AssembledContext {
    const availableBudget = this.maxInputTokens - systemPromptTokens;

    const planText = this.formatPlanForContext(plan);

    const items: ContextItem[] = [
      {
        key: 'chapter_plan',
        content: planText,
        priority: 100,
        required: true,
      },
    ];

    if (previousChapterEnding) {
      items.push({
        key: 'previous_chapter_ending',
        content: `**End of Previous Chapter (for continuity):**\n...${previousChapterEnding}`,
        priority: 80,
      });
    }

    if (rollingSummary) {
      items.push({
        key: 'rolling_summary',
        content: `**Story So Far:**\n${rollingSummary}`,
        priority: 60,
      });
    }

    if (memoryContext) {
      items.push({
        key: 'memory_context',
        content: memoryContext,
        priority: 40,
      });
    }

    return this.buildContext(items, availableBudget);
  }

  private formatPlanForContext(plan: DetailedChapterPlan): string {
    let text = `Write Chapter ${plan.chapterNumber}: "${plan.title}"\n\n**Detailed Plan:**\n`;

    for (const scene of plan.scenes) {
      text += `\nScene ${scene.number}: ${scene.setting}\n`;
      text += `- Characters: ${scene.characters.join(', ')}\n`;
      text += `- Objective: ${scene.objective}\n`;
      text += `- Conflict: ${scene.conflict}\n`;
      text += `- Resolution: ${scene.resolution}\n`;
      text += `- Target: ~${scene.targetWords} words\n`;
    }

    text += `\n**POV:** ${plan.pov}`;
    text += `\n**Tone:** ${plan.tone}`;

    if (plan.bridgeFromPrevious) {
      text += `\n\n**Bridge from Previous:** ${plan.bridgeFromPrevious}`;
    }

    return text;
  }
}
