import { v4 as uuidv4 } from 'uuid';
import { Command } from '@langchain/langgraph';
import { ProviderRegistry } from './providers/registry.js';
import { resolvePreset } from './providers/presets.js';
import { createBookGraph } from './graph/book-graph.js';
import { estimateCost } from './cost/estimator.js';
import { GenerationConfigSchema } from './schemas/config.js';
import { NoOpMemoryProvider } from './memory/noop-provider.js';
import type { MemoryProvider } from './memory/provider.js';
import { BookSession } from './book-session.js';
import type {
  LongFormAIConfig,
  GenerateOptions,
  BookSessionConfig,
  Book,
  CostEstimate,
  ProgressEvent,
  HumanFeedback,
  GenerationConfig,
  ModelRole,
  ModelConfig,
} from './types.js';

export class LongFormAI {
  private registry: ProviderRegistry;
  private config: LongFormAIConfig;
  private memoryProvider: MemoryProvider;
  private compiledGraph: ReturnType<typeof createBookGraph> | null = null;

  constructor(config: LongFormAIConfig) {
    this.config = config;

    // Resolve model configurations: preset + explicit overrides
    let models: Partial<Record<ModelRole, ModelConfig>> = {};
    if (config.preset) {
      models = resolvePreset(config.preset, config.models);
    } else if (config.models) {
      models = config.models;
    }

    this.registry = new ProviderRegistry(config.providers, models);

    // Initialize memory provider (default to NoOp)
    this.memoryProvider = new NoOpMemoryProvider();
  }

  /**
   * Create an interactive BookSession for step-by-step generation with full control.
   */
  createSession(config: Omit<BookSessionConfig, keyof LongFormAIConfig>): BookSession {
    return new BookSession({
      ...this.config,
      ...config,
    });
  }

  /**
   * Estimate the cost of a generation before running it.
   */
  async estimate(options: GenerateOptions): Promise<CostEstimate> {
    const genConfig = this.buildGenerationConfig(options);
    return estimateCost(genConfig);
  }

  /**
   * Generate long-form content. Returns an async generator yielding progress events.
   * The final return value is the complete Book.
   */
  async *generate(options: GenerateOptions): AsyncGenerator<ProgressEvent, Book, undefined> {
    const genConfig = this.buildGenerationConfig(options);
    const threadId = options.threadId ?? uuidv4();
    const graph = this.getGraph();

    const initialState = {
      title: options.title,
      description: options.description,
      config: genConfig,
    };

    const config = {
      configurable: {
        registry: this.registry,
        memoryProvider: this.memoryProvider,
        thread_id: threadId,
      },
    };

    // Calculate recursion limit: outline + chapters × (plan + write + edit + rewrite cycles + continuity)
    const nodesPerChapter = 2 + 2 * (genConfig.maxEditCycles + 1); // planner + continuity + (writer+editor) × (1 + maxEditCycles)
    const recursionLimit = 1 + genConfig.chaptersCount * nodesPerChapter + 50; // +50 safety margin

    try {
      // Stream the graph execution
      const stream = await graph.stream(initialState, {
        ...config,
        streamMode: 'values',
        recursionLimit,
      });

      let finalState: any = null;

      for await (const state of stream) {
        finalState = state;

        // Emit pending events
        if (state.pendingEvents && state.pendingEvents.length > 0) {
          for (const event of state.pendingEvents) {
            yield event as ProgressEvent;
          }
        }

        // Emit cost updates
        if (state.costs && state.costs.length > 0) {
          const totalCost = state.costs.reduce((sum: number, c: any) => sum + c.cost, 0);
          yield {
            type: 'cost_update',
            totalCost,
            step: state.currentPhase ?? 'unknown',
          } as ProgressEvent;
        }
      }

      if (!finalState) {
        throw new Error('Generation produced no output');
      }

      // Build the final Book object
      const book: Book = {
        title: finalState.title,
        outline: finalState.outline,
        chapters: finalState.chapters,
        totalWords: finalState.chapters.reduce((sum: number, ch: any) => sum + ch.wordCount, 0),
        totalCost: finalState.costs.reduce((sum: number, c: any) => sum + c.cost, 0),
        metadata: {
          contentType: genConfig.contentType,
          generatedAt: new Date().toISOString(),
          models: Object.fromEntries(
            this.registry.getConfiguredRoles().map(role => [
              role,
              this.registry.getModelId(role),
            ]),
          ),
          threadId,
        },
      };

      yield {
        type: 'generation_complete',
        totalWords: book.totalWords,
        totalCost: book.totalCost,
        totalChapters: book.chapters.length,
      } as ProgressEvent;

      return book;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield {
        type: 'error',
        message,
        recoverable: false,
      } as ProgressEvent;
      throw error;
    }
  }

  /**
   * Resume a previously interrupted generation (e.g., after human review).
   */
  async *resume(threadId: string, feedback?: HumanFeedback): AsyncGenerator<ProgressEvent, Book, undefined> {
    const graph = this.getGraph();

    const config = {
      configurable: {
        registry: this.registry,
        memoryProvider: this.memoryProvider,
        thread_id: threadId,
      },
    };

    try {
      // Resume with feedback via Command
      const input = feedback
        ? new Command({ resume: feedback })
        : new Command({ resume: { approved: true } });

      const stream = await graph.stream(input, {
        ...config,
        streamMode: 'values',
        recursionLimit: 500,
      });

      let finalState: any = null;

      for await (const state of stream) {
        finalState = state;

        if (state.pendingEvents && state.pendingEvents.length > 0) {
          for (const event of state.pendingEvents) {
            yield event as ProgressEvent;
          }
        }
      }

      if (!finalState) {
        throw new Error('Resume produced no output');
      }

      const book: Book = {
        title: finalState.title,
        outline: finalState.outline,
        chapters: finalState.chapters,
        totalWords: finalState.chapters.reduce((sum: number, ch: any) => sum + ch.wordCount, 0),
        totalCost: finalState.costs.reduce((sum: number, c: any) => sum + c.cost, 0),
        metadata: {
          contentType: finalState.config.contentType,
          generatedAt: new Date().toISOString(),
          models: Object.fromEntries(
            this.registry.getConfiguredRoles().map(role => [
              role,
              this.registry.getModelId(role),
            ]),
          ),
          threadId,
        },
      };

      yield {
        type: 'generation_complete',
        totalWords: book.totalWords,
        totalCost: book.totalCost,
        totalChapters: book.chapters.length,
      } as ProgressEvent;

      return book;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield {
        type: 'error',
        message,
        recoverable: false,
      } as ProgressEvent;
      throw error;
    }
  }

  /**
   * Get the current state of a generation thread.
   */
  async getState(threadId: string) {
    const graph = this.getGraph();
    const state = await graph.getState({
      configurable: { thread_id: threadId },
    });
    return state.values;
  }

  private getGraph() {
    if (!this.compiledGraph) {
      this.compiledGraph = createBookGraph({
        checkpointer: {
          type: this.config.checkpointer ?? 'memory',
          connectionString: this.config.checkpointerConfig?.connectionString,
          dbPath: this.config.checkpointerConfig?.dbPath,
        },
        memoryProvider: this.memoryProvider,
      });
    }
    return this.compiledGraph;
  }

  private buildGenerationConfig(options: GenerateOptions): GenerationConfig {
    const raw = {
      contentType: options.contentType ?? 'novel',
      targetWords: options.targetWords ?? 50000,
      chaptersCount: options.chapters ?? 20,
      maxEditCycles: options.maxEditCycles ?? 3,
      humanReview: options.humanReview ?? false,
      models: {},
    };
    return GenerationConfigSchema.parse(raw);
  }
}
