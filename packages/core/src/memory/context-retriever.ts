import type { RelevantContext, CharacterState, TimelineEvent } from '../types.js';

export interface ContextRetrieverConfig {
  maxTokenBudget?: number;
  summaryWeight?: number;
  passageWeight?: number;
  characterWeight?: number;
}

export class ContextRetriever {
  private maxTokenBudget: number;

  constructor(config?: ContextRetrieverConfig) {
    this.maxTokenBudget = config?.maxTokenBudget ?? 8000;
  }

  buildContext(
    rollingSummary: string,
    passages: { text: string; chapter: number; score: number }[],
    characterStates: CharacterState[],
    recentEvents: TimelineEvent[],
    bridgeText: string,
  ): RelevantContext {
    let tokenCount = 0;
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    // Priority 1: Rolling summary (most important)
    const summaryTokens = estimateTokens(rollingSummary);
    tokenCount += summaryTokens;

    // Priority 2: Bridge text
    const bridgeTokens = estimateTokens(bridgeText);
    tokenCount += bridgeTokens;

    // Priority 3: Character states
    const charText = characterStates.map(c =>
      `${c.name}: ${c.location}, ${c.emotionalState}, alive=${c.alive}`
    ).join('\n');
    const charTokens = estimateTokens(charText);
    tokenCount += charTokens;

    // Priority 4: Recent events
    const eventsText = recentEvents.map(e => `Ch${e.chapter}: ${e.event}`).join('\n');
    const eventsTokens = estimateTokens(eventsText);
    tokenCount += eventsTokens;

    // Priority 5: Relevant passages (fill remaining budget)
    const remainingBudget = this.maxTokenBudget - tokenCount;
    const filteredPassages: typeof passages = [];
    let passageTokens = 0;
    for (const p of passages) {
      const pTokens = estimateTokens(p.text);
      if (passageTokens + pTokens > remainingBudget) break;
      filteredPassages.push(p);
      passageTokens += pTokens;
    }
    tokenCount += passageTokens;

    return {
      rollingSummary,
      relevantPassages: filteredPassages,
      characterStates,
      recentEvents,
      worldContext: '',
      bridgeText,
      totalTokens: tokenCount,
    };
  }

  getMaxTokenBudget(): number { return this.maxTokenBudget; }
}
