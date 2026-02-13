import { StateGraph, START, END } from '@langchain/langgraph';
import { BookState } from '../schemas/state.js';
import { outlineNode } from './nodes/outline.js';
import { plannerNode } from './nodes/planner.js';
import { writerNode } from './nodes/writer.js';
import { editorNode } from './nodes/editor.js';
import { continuityNode } from './nodes/continuity.js';
import { editorRouter, chapterRouter } from './edges.js';
import { createCheckpointer } from './checkpointer.js';
import type { CheckpointerConfig } from './checkpointer.js';
import type { MemoryProvider } from '../memory/provider.js';

export interface BookGraphConfig {
  checkpointer?: CheckpointerConfig;
  memoryProvider?: MemoryProvider;
}

export function createBookGraph(config?: BookGraphConfig | CheckpointerConfig) {
  // Support both old and new config formats for backwards compatibility
  let checkpointerConfig: CheckpointerConfig | undefined;
  let memoryProvider: MemoryProvider | undefined;

  if (config && 'checkpointer' in config) {
    checkpointerConfig = (config as BookGraphConfig).checkpointer;
    memoryProvider = (config as BookGraphConfig).memoryProvider;
  } else {
    checkpointerConfig = config as CheckpointerConfig | undefined;
  }

  const checkpointer = createCheckpointer(checkpointerConfig);

  const graph = new StateGraph(BookState)
    .addNode('generate_outline', outlineNode)
    .addNode('planner', plannerNode)
    .addNode('writer', writerNode)
    .addNode('editor', editorNode)
    .addNode('continuity', continuityNode)
    .addEdge(START, 'generate_outline')
    .addEdge('generate_outline', 'planner')
    .addEdge('planner', 'writer')
    .addEdge('writer', 'editor')
    .addConditionalEdges('editor', editorRouter, {
      writer: 'writer',
      continuity: 'continuity',
    })
    .addConditionalEdges('continuity', chapterRouter, {
      planner: 'planner',
      __end__: END,
    });

  return graph.compile({ checkpointer });
}
