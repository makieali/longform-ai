import type { BookState } from '../schemas/state.js';

type BookStateType = typeof BookState.State;

/**
 * Routes from editor node: either back to writer (rewrite) or to continuity (approved).
 * Also handles maxEditCycles — force-approve after max cycles.
 */
export function editorRouter(state: BookStateType): 'writer' | 'continuity' {
  const editResult = state.currentEditResult;

  // If approved, proceed to continuity
  if (editResult?.approved) {
    return 'continuity';
  }

  // If we've exceeded max edit cycles, force proceed
  if (state.editCount >= state.config.maxEditCycles) {
    return 'continuity';
  }

  // Otherwise, send back for rewriting
  return 'writer';
}

/**
 * Routes from continuity node: either to planner (next chapter) or END.
 */
export function chapterRouter(state: BookStateType): 'planner' | '__end__' {
  if (state.currentPhase === 'complete') {
    return '__end__';
  }

  if (state.currentChapter <= state.outline!.chapters.length) {
    return 'planner';
  }

  return '__end__';
}
