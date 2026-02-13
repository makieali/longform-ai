import { v4 as uuidv4 } from 'uuid';
import { generateText, generateObject } from 'ai';
import { ProviderRegistry } from './providers/registry.js';
import { resolvePreset } from './providers/presets.js';
import { calculateCost } from './providers/cost-table.js';
import { OutlineSchema, DetailedChapterPlanSchema } from './schemas/index.js';
import { EditResultSchema } from './schemas/content.js';
import { TokenBudget } from './context/token-budget.js';
import { MemorySessionStorage } from './session/storage.js';
import {
  buildOutlineSystemPrompt,
  buildOutlineUserPrompt,
} from './prompts/outline-prompts.js';
import {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
} from './prompts/planner-prompts.js';
import {
  buildWriterSystemPrompt,
  buildWriterUserPrompt,
  buildExpandChapterPrompt,
  buildExpandChapterSystemPrompt,
  buildAntiRefusalRetryPrompt,
} from './prompts/writer-prompts.js';
import { detectRefusal, stripRefusalContent } from './utils/refusal-detection.js';
import {
  buildEditorSystemPrompt,
  buildEditorUserPrompt,
} from './prompts/editor-prompts.js';
import {
  buildContinuitySystemPrompt,
  buildContinuityUserPrompt,
  buildSummaryExtractionPrompt,
} from './prompts/continuity-prompts.js';
import { countWords } from './graph/nodes/writer.js';
import type {
  BookSessionConfig,
  Outline,
  OutlineChanges,
  ChapterResult,
  ChapterContent,
  ChapterStatus,
  SessionProgress,
  EditCycleRecord,
  CostEntry,
  GenerationConfig,
  ModelRole,
  ModelConfig,
  ProgressEvent,
  SessionEventType,
  SessionEventHandler,
  ChapterCallback,
  SessionStorage,
  CharacterProfile,
  DetailedChapterPlan,
  Book,
} from './types.js';

interface SessionState {
  id: string;
  outline: Outline | null;
  outlineApproved: boolean;
  chapters: Map<number, ChapterContent>;
  chapterStatuses: Map<number, ChapterStatus>;
  chapterEditHistories: Map<number, EditCycleRecord[]>;
  rollingSummary: string;
  previousChapterEnding: string;
  costs: CostEntry[];
  phase: 'idle' | 'outline' | 'writing' | 'complete';
}

export class BookSession {
  private state: SessionState;
  private registry: ProviderRegistry;
  private genConfig: GenerationConfig;
  private sessionConfig: BookSessionConfig;
  private tokenBudget: TokenBudget;
  private storage: SessionStorage;
  private eventHandlers: Map<string, SessionEventHandler[]> = new Map();

  constructor(config: BookSessionConfig) {
    this.sessionConfig = config;

    // Resolve models from preset + overrides
    let models: Partial<Record<ModelRole, ModelConfig>> = {};
    if (config.preset) {
      models = resolvePreset(config.preset, config.models);
    } else if (config.models) {
      models = config.models;
    }

    this.registry = new ProviderRegistry(config.providers, models);

    this.genConfig = {
      contentType: config.contentType ?? 'novel',
      targetWords: config.wordConfig
        ? config.wordConfig.defaultWords * (config.chapters ?? 20)
        : 50000,
      chaptersCount: config.chapters ?? 20,
      maxEditCycles: config.maxEditCycles ?? 3,
      humanReview: false,
      models: {},
    };

    this.tokenBudget = new TokenBudget();
    this.storage = new MemorySessionStorage();

    this.state = {
      id: uuidv4(),
      outline: null,
      outlineApproved: false,
      chapters: new Map(),
      chapterStatuses: new Map(),
      chapterEditHistories: new Map(),
      rollingSummary: '',
      previousChapterEnding: '',
      costs: [],
      phase: 'idle',
    };
  }

  // --- Phase 1: Outline ---

  async generateOutline(): Promise<Outline> {
    this.state.phase = 'outline';
    const model = this.registry.getModel('outline');
    const modelId = this.registry.getModelId('outline');

    const { object: outline, usage } = await generateObject({
      model,
      schema: OutlineSchema,
      system: buildOutlineSystemPrompt(this.genConfig),
      prompt: buildOutlineUserPrompt(
        this.sessionConfig.title,
        this.sessionConfig.description,
        this.genConfig,
      ),
      temperature: this.registry.getModelConfig('outline').temperature,
      maxTokens: this.registry.getModelConfig('outline').maxTokens,
    });

    // Apply word config overrides to outline chapters
    if (this.sessionConfig.wordConfig) {
      const wc = this.sessionConfig.wordConfig;
      for (const ch of outline.chapters) {
        ch.targetWords = wc.chapterOverrides?.[ch.number] ?? wc.defaultWords;
      }
    }

    this.state.outline = outline;
    this.state.outlineApproved = false;
    this.addCost('outline', modelId, usage);
    this.emit({ type: 'outline_generated', outline });

    // Initialize chapter statuses
    for (const ch of outline.chapters) {
      this.state.chapterStatuses.set(ch.number, 'pending');
    }

    return outline;
  }

  async regenerateOutline(feedback?: string): Promise<Outline> {
    this.state.outlineApproved = false;
    const model = this.registry.getModel('outline');
    const modelId = this.registry.getModelId('outline');

    let prompt = buildOutlineUserPrompt(
      this.sessionConfig.title,
      this.sessionConfig.description,
      this.genConfig,
    );

    if (feedback) {
      prompt += `\n\n**Feedback on previous outline:**\n${feedback}\n\nPlease address this feedback in the new outline.`;
    }

    const { object: outline, usage } = await generateObject({
      model,
      schema: OutlineSchema,
      system: buildOutlineSystemPrompt(this.genConfig),
      prompt,
      temperature: this.registry.getModelConfig('outline').temperature,
      maxTokens: this.registry.getModelConfig('outline').maxTokens,
    });

    if (this.sessionConfig.wordConfig) {
      const wc = this.sessionConfig.wordConfig;
      for (const ch of outline.chapters) {
        ch.targetWords = wc.chapterOverrides?.[ch.number] ?? wc.defaultWords;
      }
    }

    this.state.outline = outline;
    this.addCost('outline_regenerate', modelId, usage);
    this.emit({ type: 'outline_generated', outline });

    // Reset chapter statuses
    this.state.chapterStatuses.clear();
    for (const ch of outline.chapters) {
      this.state.chapterStatuses.set(ch.number, 'pending');
    }

    return outline;
  }

  async updateOutline(changes: OutlineChanges): Promise<Outline> {
    if (!this.state.outline) {
      throw new Error('No outline to update. Call generateOutline() first.');
    }

    const outline = { ...this.state.outline };
    outline.chapters = [...outline.chapters];
    outline.characters = [...outline.characters];

    // Apply global changes
    if (changes.synopsis !== undefined) outline.synopsis = changes.synopsis;
    if (changes.themes !== undefined) outline.themes = changes.themes;
    if (changes.targetAudience !== undefined) outline.targetAudience = changes.targetAudience;

    // Remove chapters
    if (changes.removeChapters) {
      outline.chapters = outline.chapters.filter(
        ch => !changes.removeChapters!.includes(ch.number),
      );
    }

    // Update existing chapters
    if (changes.updateChapter) {
      for (const update of changes.updateChapter) {
        const ch = outline.chapters.find(c => c.number === update.number);
        if (ch) {
          if (update.title !== undefined) ch.title = update.title;
          if (update.summary !== undefined) ch.summary = update.summary;
          if (update.targetWords !== undefined) ch.targetWords = update.targetWords;
          if (update.keyEvents !== undefined) ch.keyEvents = update.keyEvents;
        }
      }
    }

    // Add new chapters
    if (changes.addChapter) {
      for (const add of changes.addChapter) {
        const defaultWords = this.sessionConfig.wordConfig?.defaultWords ??
          Math.round(this.genConfig.targetWords / this.genConfig.chaptersCount);

        const newChapter = {
          number: 0, // Will be renumbered
          title: add.title,
          summary: add.summary,
          targetWords: add.targetWords ?? defaultWords,
          keyEvents: [],
          characters: [],
        };

        // Insert after the specified chapter
        const insertIndex = outline.chapters.findIndex(c => c.number === add.afterChapter);
        if (insertIndex !== -1) {
          outline.chapters.splice(insertIndex + 1, 0, newChapter);
        } else {
          outline.chapters.push(newChapter);
        }
      }
    }

    // Merge chapters
    if (changes.mergeChapters) {
      for (const merge of changes.mergeChapters) {
        const [num1, num2] = merge.chapters;
        const ch1 = outline.chapters.find(c => c.number === num1);
        const ch2 = outline.chapters.find(c => c.number === num2);
        if (ch1 && ch2) {
          ch1.title = merge.newTitle;
          ch1.summary = `${ch1.summary} ${ch2.summary}`;
          ch1.targetWords = ch1.targetWords + ch2.targetWords;
          ch1.keyEvents = [...ch1.keyEvents, ...ch2.keyEvents];
          ch1.characters = [...new Set([...ch1.characters, ...ch2.characters])];
          outline.chapters = outline.chapters.filter(c => c.number !== num2);
        }
      }
    }

    // Reorder chapters
    if (changes.reorderChapters) {
      const reordered = [];
      for (const num of changes.reorderChapters) {
        const ch = outline.chapters.find(c => c.number === num);
        if (ch) reordered.push(ch);
      }
      outline.chapters = reordered;
    }

    // Renumber all chapters sequentially
    outline.chapters.forEach((ch, i) => {
      ch.number = i + 1;
    });

    // Character changes
    if (changes.addCharacter) {
      outline.characters.push(...changes.addCharacter);
    }

    if (changes.removeCharacters) {
      outline.characters = outline.characters.filter(
        c => !changes.removeCharacters!.includes(c.name),
      );
    }

    if (changes.updateCharacter) {
      for (const update of changes.updateCharacter) {
        const char = outline.characters.find(c => c.name === update.name);
        if (char) {
          Object.assign(char, update.changes);
        }
      }
    }

    this.state.outline = outline;
    this.genConfig.chaptersCount = outline.chapters.length;

    // Update chapter statuses for new/removed chapters
    this.state.chapterStatuses.clear();
    for (const ch of outline.chapters) {
      const existingChapter = this.state.chapters.get(ch.number);
      this.state.chapterStatuses.set(
        ch.number,
        existingChapter ? 'approved' : 'pending',
      );
    }

    return outline;
  }

  async approveOutline(): Promise<void> {
    if (!this.state.outline) {
      throw new Error('No outline to approve. Call generateOutline() first.');
    }
    this.state.outlineApproved = true;
    this.state.phase = 'writing';
    this.emit({ type: 'outline_approved' } as ProgressEvent);
  }

  // --- Phase 2: Chapter Generation ---

  async generateChapter(chapterNumber?: number): Promise<ChapterResult> {
    if (!this.state.outlineApproved) {
      throw new Error('Outline must be approved before generating chapters. Call approveOutline() first.');
    }

    const outline = this.state.outline!;
    const targetChapter = chapterNumber ?? this.getNextPendingChapter();

    if (targetChapter === null) {
      throw new Error('No pending chapters to generate.');
    }

    const chapterPlan = outline.chapters.find(c => c.number === targetChapter);
    if (!chapterPlan) {
      throw new Error(`Chapter ${targetChapter} not found in outline.`);
    }

    this.state.chapterStatuses.set(targetChapter, 'generating');
    const startTime = Date.now();
    const chapterCosts: CostEntry[] = [];
    const editHistory: EditCycleRecord[] = [];

    try {
      // Step 1: Generate detailed plan
      const detailedPlan = await this.generateDetailedPlan(targetChapter, chapterCosts);
      this.emit({
        type: 'chapter_plan_generated',
        chapter: targetChapter,
        plan: detailedPlan,
      } as ProgressEvent);

      // Step 2: Write the chapter
      let draft = await this.writeChapter(detailedPlan, chapterCosts);

      this.emit({
        type: 'chapter_written',
        chapter: targetChapter,
        wordCount: countWords(draft),
      } as ProgressEvent);

      // Step 3: Expand loop if too short (pass plan for fresh generation if empty)
      draft = await this.expandIfNeeded(targetChapter, draft, chapterPlan.targetWords, chapterCosts, 3, detailedPlan);

      // Step 3b: Full-text refusal scan — catch any raw refusal blocks mid-chapter
      draft = stripRefusalContent(draft);

      // Step 4: Edit cycles
      let editCount = 0;
      const maxEditCycles = this.sessionConfig.maxEditCycles ?? 3;
      let approved = false;

      while (editCount < maxEditCycles) {
        const editResult = await this.editChapter(draft, detailedPlan, editCount, maxEditCycles, chapterCosts);

        editHistory.push({
          cycle: editCount + 1,
          scores: editResult.scores,
          approved: editResult.approved,
          feedback: editResult.rewriteInstructions || undefined,
        });

        this.emit({
          type: 'edit_cycle',
          chapter: targetChapter,
          cycle: editCount + 1,
          approved: editResult.approved,
          scores: editResult.scores,
        } as ProgressEvent);

        if (editResult.approved) {
          approved = true;
          break;
        }

        // Rewrite based on editor feedback, passing existing draft as reference
        draft = await this.rewriteFromFeedback(
          detailedPlan,
          editResult.rewriteInstructions ?? '',
          chapterCosts,
          draft,
        );
        draft = await this.expandIfNeeded(targetChapter, draft, chapterPlan.targetWords, chapterCosts, 3, detailedPlan);
        editCount++;
      }

      // If not approved after all cycles, approve anyway
      if (!approved) {
        approved = true;
      }

      // Step 5: Generate summary
      const summary = await this.generateChapterSummary(draft, targetChapter, chapterCosts);

      // Step 6: Update continuity
      const chapter: ChapterContent = {
        number: targetChapter,
        title: chapterPlan.title,
        content: draft,
        wordCount: countWords(draft),
        summary,
        editCount: editHistory.length,
        approved,
      };

      await this.updateContinuity(chapter, chapterCosts);

      // Store completed chapter
      this.state.chapters.set(targetChapter, chapter);
      this.state.chapterStatuses.set(targetChapter, 'approved');

      const wordCount = countWords(draft);
      const meetsTarget = this.checkWordTarget(wordCount, chapterPlan.targetWords);

      if (!meetsTarget) {
        this.emit({
          type: 'word_count_warning',
          chapter: targetChapter,
          target: chapterPlan.targetWords,
          actual: wordCount,
        } as ProgressEvent);
      }

      this.emit({
        type: 'chapter_complete',
        chapter: targetChapter,
        title: chapterPlan.title,
        wordCount,
      } as ProgressEvent);

      // Check if all chapters are done
      if (this.state.chapters.size === outline.chapters.length) {
        this.state.phase = 'complete';
      }

      const costForChapter = chapterCosts.reduce((sum, c) => sum + c.cost, 0);

      return {
        chapter,
        targetWords: chapterPlan.targetWords,
        meetsTarget,
        editHistory,
        costForChapter,
        generationTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.state.chapterStatuses.set(targetChapter, 'failed');
      const message = error instanceof Error ? error.message : String(error);
      this.emit({
        type: 'chapter_failed',
        chapter: targetChapter,
        error: message,
        canRetry: true,
      } as ProgressEvent);
      throw error;
    }
  }

  async rewriteChapter(chapter: number, feedback: string): Promise<ChapterResult> {
    if (!this.state.outlineApproved) {
      throw new Error('Outline must be approved first.');
    }

    const outline = this.state.outline!;
    const chapterPlan = outline.chapters.find(c => c.number === chapter);
    if (!chapterPlan) {
      throw new Error(`Chapter ${chapter} not found in outline.`);
    }

    this.state.chapterStatuses.set(chapter, 'generating');
    const startTime = Date.now();
    const chapterCosts: CostEntry[] = [];
    const editHistory: EditCycleRecord[] = [];

    try {
      // Generate a new detailed plan
      const detailedPlan = await this.generateDetailedPlan(chapter, chapterCosts);

      // Rewrite with feedback
      let draft = await this.rewriteFromFeedback(detailedPlan, feedback, chapterCosts);
      draft = await this.expandIfNeeded(chapter, draft, chapterPlan.targetWords, chapterCosts);

      // One edit cycle
      const editResult = await this.editChapter(draft, detailedPlan, 0, 1, chapterCosts);
      editHistory.push({
        cycle: 1,
        scores: editResult.scores,
        approved: editResult.approved,
        feedback: editResult.rewriteInstructions || undefined,
      });

      const summary = await this.generateChapterSummary(draft, chapter, chapterCosts);

      const chapterContent: ChapterContent = {
        number: chapter,
        title: chapterPlan.title,
        content: draft,
        wordCount: countWords(draft),
        summary,
        editCount: 1,
        approved: true,
      };

      await this.updateContinuity(chapterContent, chapterCosts);
      this.state.chapters.set(chapter, chapterContent);
      this.state.chapterStatuses.set(chapter, 'approved');

      const wordCount = countWords(draft);
      const costForChapter = chapterCosts.reduce((sum, c) => sum + c.cost, 0);

      return {
        chapter: chapterContent,
        targetWords: chapterPlan.targetWords,
        meetsTarget: this.checkWordTarget(wordCount, chapterPlan.targetWords),
        editHistory,
        costForChapter,
        generationTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.state.chapterStatuses.set(chapter, 'failed');
      throw error;
    }
  }

  async expandChapter(chapter: number, targetWords?: number): Promise<ChapterResult> {
    const existing = this.state.chapters.get(chapter);
    if (!existing) {
      throw new Error(`Chapter ${chapter} has not been generated yet.`);
    }

    const outline = this.state.outline!;
    const chapterPlan = outline.chapters.find(c => c.number === chapter);
    const target = targetWords ?? chapterPlan?.targetWords ?? 2000;

    const startTime = Date.now();
    const chapterCosts: CostEntry[] = [];

    this.state.chapterStatuses.set(chapter, 'generating');

    const expanded = await this.expandIfNeeded(chapter, existing.content, target, chapterCosts, 3);

    const summary = await this.generateChapterSummary(expanded, chapter, chapterCosts);

    const updatedChapter: ChapterContent = {
      ...existing,
      content: expanded,
      wordCount: countWords(expanded),
      summary,
    };

    this.state.chapters.set(chapter, updatedChapter);
    this.state.chapterStatuses.set(chapter, 'approved');

    const costForChapter = chapterCosts.reduce((sum, c) => sum + c.cost, 0);

    return {
      chapter: updatedChapter,
      targetWords: target,
      meetsTarget: this.checkWordTarget(updatedChapter.wordCount, target),
      editHistory: [],
      costForChapter,
      generationTimeMs: Date.now() - startTime,
    };
  }

  async *generateAllRemaining(options?: {
    onChapter?: ChapterCallback;
  }): AsyncGenerator<ChapterResult> {
    if (!this.state.outlineApproved) {
      throw new Error('Outline must be approved first.');
    }

    const outline = this.state.outline!;

    for (const ch of outline.chapters) {
      if (this.state.chapterStatuses.get(ch.number) === 'approved') {
        continue;
      }
      if (this.state.chapterStatuses.get(ch.number) === 'failed') {
        continue;
      }

      try {
        const result = await this.generateChapter(ch.number);
        if (options?.onChapter) {
          await options.onChapter(result);
        }
        yield result;
      } catch (error) {
        // Mark as failed, continue with next
        this.state.chapterStatuses.set(ch.number, 'failed');
        const message = error instanceof Error ? error.message : String(error);
        this.emit({
          type: 'chapter_failed',
          chapter: ch.number,
          error: message,
          canRetry: true,
        } as ProgressEvent);
      }
    }

    // Check if all chapters are done or failed
    const allDone = outline.chapters.every(
      ch => {
        const status = this.state.chapterStatuses.get(ch.number);
        return status === 'approved' || status === 'failed';
      },
    );
    if (allDone) {
      this.state.phase = 'complete';
    }
  }

  // --- Inspection ---

  getOutline(): Outline | null {
    return this.state.outline;
  }

  getChapter(n: number): ChapterContent | null {
    return this.state.chapters.get(n) ?? null;
  }

  getProgress(): SessionProgress {
    const outline = this.state.outline;
    const totalChapters = outline?.chapters.length ?? 0;
    let chaptersCompleted = 0;
    let totalWords = 0;

    for (const ch of this.state.chapters.values()) {
      chaptersCompleted++;
      totalWords += ch.wordCount;
    }

    const totalCost = this.state.costs.reduce((sum, c) => sum + c.cost, 0);

    // Rough estimate: cost per chapter × remaining chapters
    const avgCostPerChapter = chaptersCompleted > 0
      ? totalCost / chaptersCompleted
      : 0;
    const remaining = totalChapters - chaptersCompleted;
    const estimatedRemainingCost = avgCostPerChapter * remaining;

    return {
      phase: this.state.phase,
      outlineApproved: this.state.outlineApproved,
      totalChapters,
      chaptersCompleted,
      chapterStatuses: new Map(this.state.chapterStatuses),
      totalWords,
      totalCost,
      estimatedRemainingCost,
    };
  }

  getChapterStatus(n: number): ChapterStatus {
    return this.state.chapterStatuses.get(n) ?? 'pending';
  }

  // --- Persistence ---

  async save(storage?: SessionStorage): Promise<string> {
    const store = storage ?? this.storage;
    const serializable = {
      id: this.state.id,
      outline: this.state.outline,
      outlineApproved: this.state.outlineApproved,
      chapters: Array.from(this.state.chapters.entries()),
      chapterStatuses: Array.from(this.state.chapterStatuses.entries()),
      chapterEditHistories: Array.from(this.state.chapterEditHistories.entries()),
      rollingSummary: this.state.rollingSummary,
      previousChapterEnding: this.state.previousChapterEnding,
      costs: this.state.costs,
      phase: this.state.phase,
      config: this.sessionConfig,
    };

    await store.save(this.state.id, JSON.stringify(serializable));
    this.emit({ type: 'session_saved', sessionId: this.state.id } as ProgressEvent);
    return this.state.id;
  }

  static async restore(
    id: string,
    config: BookSessionConfig,
    storage?: SessionStorage,
  ): Promise<BookSession> {
    const store = storage ?? new MemorySessionStorage();
    const data = await store.load(id);
    if (!data) {
      throw new Error(`Session ${id} not found.`);
    }

    const parsed = JSON.parse(data);
    const session = new BookSession(config);

    session.state.id = parsed.id;
    session.state.outline = parsed.outline;
    session.state.outlineApproved = parsed.outlineApproved;
    session.state.chapters = new Map(parsed.chapters);
    session.state.chapterStatuses = new Map(parsed.chapterStatuses);
    session.state.chapterEditHistories = new Map(parsed.chapterEditHistories);
    session.state.rollingSummary = parsed.rollingSummary;
    session.state.previousChapterEnding = parsed.previousChapterEnding;
    session.state.costs = parsed.costs;
    session.state.phase = parsed.phase;

    return session;
  }

  // --- Events ---

  on(event: SessionEventType, handler: SessionEventHandler): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  // --- Export ---

  export(): Book {
    const outline = this.state.outline;
    if (!outline) {
      throw new Error('No outline available.');
    }

    // Collect completed chapters in order
    const chapters: ChapterContent[] = [];
    for (const ch of outline.chapters) {
      const content = this.state.chapters.get(ch.number);
      if (content) {
        chapters.push(content);
      }
    }

    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
    const totalCost = this.state.costs.reduce((sum, c) => sum + c.cost, 0);

    return {
      title: outline.title,
      outline,
      chapters,
      totalWords,
      totalCost,
      metadata: {
        contentType: this.genConfig.contentType,
        generatedAt: new Date().toISOString(),
        models: Object.fromEntries(
          this.registry.getConfiguredRoles().map(role => [
            role,
            this.registry.getModelId(role),
          ]),
        ),
        threadId: this.state.id,
      },
    };
  }

  // --- Private helpers ---

  private async generateDetailedPlan(
    chapterNumber: number,
    costs: CostEntry[],
  ): Promise<DetailedChapterPlan> {
    const outline = this.state.outline!;
    const chapterPlan = outline.chapters.find(c => c.number === chapterNumber)!;
    const model = this.registry.getModel('planning');
    const modelId = this.registry.getModelId('planning');

    const { object: detailedPlan, usage } = await generateObject({
      model,
      schema: DetailedChapterPlanSchema,
      system: buildPlannerSystemPrompt(this.genConfig),
      prompt: buildPlannerUserPrompt(
        chapterPlan,
        outline,
        this.state.rollingSummary,
        this.genConfig,
      ),
      temperature: this.registry.getModelConfig('planning').temperature,
      maxTokens: this.registry.getModelConfig('planning').maxTokens,
    });

    this.addCostEntry(costs, 'planning', modelId, usage);
    return detailedPlan;
  }

  private async writeChapter(
    plan: DetailedChapterPlan,
    costs: CostEntry[],
  ): Promise<string> {
    const model = this.registry.getModel('writing');
    const modelId = this.registry.getModelId('writing');

    const basePrompt = buildWriterUserPrompt(
      plan,
      this.state.rollingSummary,
      this.state.previousChapterEnding,
      this.genConfig,
    );

    // Ensure maxTokens is sufficient for target word count
    const configuredMaxTokens = this.registry.getModelConfig('writing').maxTokens ?? 4096;
    const minTokensForTarget = Math.ceil(plan.targetWords * 1.5);
    const maxTokens = Math.max(configuredMaxTokens, minTokensForTarget);

    const maxRefusalRetries = 3;
    let bestText = '';
    let bestWordCount = 0;

    for (let attempt = 0; attempt <= maxRefusalRetries; attempt++) {
      const prompt = attempt === 0
        ? basePrompt
        : buildAntiRefusalRetryPrompt(basePrompt, attempt);

      const { text, usage } = await generateText({
        model,
        system: buildWriterSystemPrompt(this.genConfig),
        prompt,
        temperature: this.registry.getModelConfig('writing').temperature,
        maxTokens,
      });

      this.addCostEntry(costs, attempt === 0 ? 'writing' : 'writing_refusal_retry', modelId, usage);

      const refusal = detectRefusal(text);

      if (!refusal.isRefusal) {
        // No refusal detected — use this text
        return text;
      }

      // Refusal detected — emit event and try to salvage
      this.emit({
        type: 'refusal_detected',
        chapter: plan.chapterNumber,
        attempt: attempt + 1,
      } as ProgressEvent);

      // Keep the cleaned version only if it looks genuinely clean
      // (i.e., the cleaned text itself doesn't contain refusal fragments)
      const cleanedRefusal = detectRefusal(refusal.cleanedText);
      if (!cleanedRefusal.isRefusal) {
        const cleanedWordCount = countWords(refusal.cleanedText);
        if (cleanedWordCount > bestWordCount) {
          bestText = refusal.cleanedText;
          bestWordCount = cleanedWordCount;
        }
      }
    }

    // All attempts resulted in refusals.
    // Only return cleaned text if it's substantial (100+ words).
    // Short fragments are almost always residual refusal text that the
    // expand loop would weave into meta-fiction about characters reading
    // AI error messages. Return empty so expand generates from scratch.
    return bestWordCount >= 100 ? bestText : '';
  }

  private async rewriteFromFeedback(
    plan: DetailedChapterPlan,
    feedback: string,
    costs: CostEntry[],
    existingDraft?: string,
  ): Promise<string> {
    const model = this.registry.getModel('writing');
    const modelId = this.registry.getModelId('writing');

    let prompt = buildWriterUserPrompt(
      plan,
      this.state.rollingSummary,
      this.state.previousChapterEnding,
      this.genConfig,
      feedback,
    );

    // Include existing draft as reference so the model doesn't start from scratch
    if (existingDraft && countWords(existingDraft) > 100) {
      prompt += `\n\n**PREVIOUS DRAFT FOR REFERENCE (improve this, don't summarize it):**\n${existingDraft}`;
    }

    const configuredMaxTokens = this.registry.getModelConfig('writing').maxTokens ?? 4096;
    const minTokensForTarget = Math.ceil(plan.targetWords * 1.5);
    const maxTokens = Math.max(configuredMaxTokens, minTokensForTarget);

    const { text, usage } = await generateText({
      model,
      system: buildWriterSystemPrompt(this.genConfig),
      prompt,
      temperature: this.registry.getModelConfig('writing').temperature,
      maxTokens,
    });

    this.addCostEntry(costs, 'writing_rewrite', modelId, usage);

    // Check for refusal
    const refusal = detectRefusal(text);
    const finalText = refusal.isRefusal ? refusal.cleanedText : text;

    // Only accept rewrite if it's at least as long as original
    if (existingDraft && countWords(finalText) < countWords(existingDraft) * 0.5) {
      return existingDraft; // Keep the better version
    }
    return finalText;
  }

  private async expandIfNeeded(
    chapterNumber: number,
    content: string,
    targetWords: number,
    costs: CostEntry[],
    maxAttempts: number = 3,
    plan?: DetailedChapterPlan,
  ): Promise<string> {
    const tolerance = this.sessionConfig.wordConfig?.tolerance ?? 0.15;
    const minAcceptable = Math.floor(targetWords * (1 - tolerance));

    let current = content;
    let wordCount = countWords(current);
    let attempts = 0;

    while (wordCount < minAcceptable && attempts < maxAttempts) {
      attempts++;

      this.emit({
        type: 'expand_attempt',
        chapter: chapterNumber,
        attempt: attempts,
        currentWords: wordCount,
        targetWords,
      } as ProgressEvent);

      const model = this.registry.getModel('writing');
      const modelId = this.registry.getModelId('writing');
      const deficit = targetWords - wordCount;
      const expandMaxTokens = Math.max(deficit * 2, 4096);

      let rawText: string;
      let usage: { promptTokens: number; completionTokens: number };

      // When content is very short (< 50 words), the "expand" approach fails
      // because there's nothing meaningful to expand. Instead, generate the
      // chapter from scratch using the full writer prompt with plan context.
      if (wordCount < 50 && plan) {
        const result = await generateText({
          model,
          system: buildWriterSystemPrompt(this.genConfig),
          prompt: buildWriterUserPrompt(
            plan,
            this.state.rollingSummary,
            this.state.previousChapterEnding,
            this.genConfig,
          ),
          temperature: this.registry.getModelConfig('writing').temperature,
          maxTokens: expandMaxTokens,
        });
        rawText = result.text;
        usage = result.usage;
        this.addCostEntry(costs, 'writing_fresh_generate', modelId, usage);
      } else {
        const result = await generateText({
          model,
          system: buildExpandChapterSystemPrompt(),
          prompt: buildExpandChapterPrompt(current, wordCount, targetWords),
          maxTokens: expandMaxTokens,
        });
        rawText = result.text;
        usage = result.usage;
        this.addCostEntry(costs, 'writing_expand', modelId, usage);
      }

      // Check for refusal
      const refusal = detectRefusal(rawText);
      if (refusal.isRefusal) {
        // If the cleaned text is also a refusal or very short, skip this attempt entirely.
        // Do NOT accept refusal text as "expanded" content — it would pollute the chapter.
        const cleanedCheck = detectRefusal(refusal.cleanedText);
        if (cleanedCheck.isRefusal || countWords(refusal.cleanedText) < 100) {
          continue; // Try again (next attempt)
        }
        // Cleaned text is substantial and clean — use it
        const cleanedWordCount = countWords(refusal.cleanedText);
        if (cleanedWordCount > wordCount) {
          current = refusal.cleanedText;
          wordCount = cleanedWordCount;
        }
        continue;
      }

      // Also strip any expand preamble (e.g., "Below is the expanded chapter...")
      const stripped = this.stripExpandPreamble(rawText);

      // Only accept if it's actually longer
      const expandedWordCount = countWords(stripped);
      if (expandedWordCount > wordCount) {
        current = stripped;
        wordCount = expandedWordCount;
      } else {
        // Model returned shorter content — stop expanding, keep best version
        break;
      }
    }

    return current;
  }

  private async editChapter(
    draft: string,
    plan: DetailedChapterPlan,
    editCount: number,
    maxCycles: number,
    costs: CostEntry[],
  ) {
    const model = this.registry.getModel('editing');
    const modelId = this.registry.getModelId('editing');

    const { object: editResult, usage } = await generateObject({
      model,
      schema: EditResultSchema,
      system: buildEditorSystemPrompt(this.genConfig),
      prompt: buildEditorUserPrompt(
        draft,
        plan,
        this.state.outline!,
        editCount,
        maxCycles,
      ),
      temperature: this.registry.getModelConfig('editing').temperature,
      maxTokens: this.registry.getModelConfig('editing').maxTokens,
    });

    this.addCostEntry(costs, 'editing', modelId, usage);
    return editResult;
  }

  private async generateChapterSummary(
    content: string,
    chapterNumber: number,
    costs: CostEntry[],
  ): Promise<string> {
    try {
      const model = this.registry.hasModel('continuity')
        ? this.registry.getModel('continuity')
        : this.registry.getModel('writing');
      const modelId = this.registry.hasModel('continuity')
        ? this.registry.getModelId('continuity')
        : this.registry.getModelId('writing');

      const { text, usage } = await generateText({
        model,
        prompt: buildSummaryExtractionPrompt(content, chapterNumber),
        maxTokens: 1024,
      });

      this.addCostEntry(costs, 'summary', modelId, usage);
      return text;
    } catch {
      return content.slice(0, 500) + '...';
    }
  }

  private async updateContinuity(
    chapter: ChapterContent,
    costs: CostEntry[],
  ): Promise<void> {
    if (!this.registry.hasModel('continuity')) return;

    try {
      const model = this.registry.getModel('continuity');
      const modelId = this.registry.getModelId('continuity');

      const allChapters = Array.from(this.state.chapters.values()).sort(
        (a, b) => a.number - b.number,
      );

      const { text: newSummary, usage } = await generateText({
        model,
        system: buildContinuitySystemPrompt(this.genConfig),
        prompt: buildContinuityUserPrompt(
          allChapters,
          chapter,
          this.state.rollingSummary,
          this.state.outline!,
          [],
        ),
        temperature: this.registry.getModelConfig('continuity').temperature,
        maxTokens: this.registry.getModelConfig('continuity').maxTokens,
      });

      // Enforce rolling summary length
      const maxSummaryWords = 2000;
      if (countWords(newSummary) > maxSummaryWords) {
        try {
          const { text: condensed, usage: condensedUsage } = await generateText({
            model,
            prompt: `Condense this summary to under ${maxSummaryWords} words while preserving all plot-critical information:\n\n${newSummary}`,
            maxTokens: Math.floor(maxSummaryWords * 1.3),
          });
          this.state.rollingSummary = condensed;
          this.addCostEntry(costs, 'continuity_condense', modelId, condensedUsage);
        } catch {
          this.state.rollingSummary = newSummary;
        }
      } else {
        this.state.rollingSummary = newSummary;
      }

      this.state.previousChapterEnding = chapter.content.slice(-2000);
      this.addCostEntry(costs, 'continuity', modelId, usage);
    } catch {
      // Continuity update failure is non-fatal
      this.state.previousChapterEnding = chapter.content.slice(-2000);
    }
  }

  private getNextPendingChapter(): number | null {
    if (!this.state.outline) return null;

    for (const ch of this.state.outline.chapters) {
      const status = this.state.chapterStatuses.get(ch.number);
      if (status === 'pending' || status === 'failed') {
        return ch.number;
      }
    }
    return null;
  }

  /**
   * Strips meta-commentary preamble that expand models sometimes prepend.
   * E.g., "Below is the expanded chapter. It is approximately 2100+ words..."
   */
  private stripExpandPreamble(text: string): string {
    const lines = text.split('\n');
    let startIdx = 0;

    // Skip leading lines that look like meta-commentary about the expansion
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].trim();
      if (!line) { startIdx = i + 1; continue; }
      if (/^(?:Below is|Here is|Here's|The following is|I've expanded|This is the|The expanded)/i.test(line)) {
        startIdx = i + 1;
        continue;
      }
      if (/^-{3,}$/.test(line)) {
        startIdx = i + 1;
        continue;
      }
      break;
    }

    if (startIdx > 0) {
      return lines.slice(startIdx).join('\n').trim();
    }
    return text;
  }

  private checkWordTarget(wordCount: number, targetWords: number): boolean {
    const tolerance = this.sessionConfig.wordConfig?.tolerance ?? 0.15;
    const minWords = this.sessionConfig.wordConfig?.minWords ?? 500;
    const minAcceptable = Math.max(
      Math.floor(targetWords * (1 - tolerance)),
      minWords,
    );
    return wordCount >= minAcceptable;
  }

  private addCost(
    step: string,
    modelId: string,
    usage: { promptTokens: number; completionTokens: number },
  ): void {
    this.state.costs.push({
      step,
      model: modelId,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      cost: calculateCost(modelId, usage),
    });
  }

  private addCostEntry(
    costs: CostEntry[],
    step: string,
    modelId: string,
    usage: { promptTokens: number; completionTokens: number },
  ): void {
    const entry: CostEntry = {
      step,
      model: modelId,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      cost: calculateCost(modelId, usage),
    };
    costs.push(entry);
    this.state.costs.push(entry);
  }

  private emit(event: ProgressEvent): void {
    const handlers = this.eventHandlers.get(event.type) ?? [];
    for (const handler of handlers) {
      handler(event);
    }
  }
}
