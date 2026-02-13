import { Annotation } from '@langchain/langgraph';
import type {
  Outline, ChapterContent, DetailedChapterPlan,
  CostEntry, GenerationConfig, EditResult, CharacterState,
} from '../types.js';

export const BookState = Annotation.Root({
  // Input fields
  title: Annotation<string>,
  description: Annotation<string>,
  config: Annotation<GenerationConfig>,

  // Pipeline state
  currentPhase: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'idle',
  }),
  currentChapter: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  // Outline
  outline: Annotation<Outline | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Current chapter work-in-progress
  currentDetailedPlan: Annotation<DetailedChapterPlan | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  currentDraft: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  currentEditResult: Annotation<EditResult | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  editCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  // Completed chapters (append reducer)
  chapters: Annotation<ChapterContent[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Rolling summary for continuity
  rollingSummary: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // Character states
  characterStates: Annotation<CharacterState[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // Cost tracking (append reducer)
  costs: Annotation<CostEntry[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Total words (accumulate)
  totalWordsWritten: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),

  // Last N words of previous chapter for bridging
  previousChapterEnding: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // Human feedback
  humanFeedback: Annotation<{ approved: boolean; notes?: string; editInstructions?: string } | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Progress events for streaming
  pendingEvents: Annotation<Array<{ type: string; [key: string]: unknown }>>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

export type BookStateType = typeof BookState.State;
