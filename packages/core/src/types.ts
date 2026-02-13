import type { LanguageModel } from 'ai';

// Content types supported
export type ContentType = 'novel' | 'technical-docs' | 'course' | 'screenplay' | 'research-paper' | 'marketing' | 'legal' | 'sop';

// Model roles for provider registry
export type ModelRole = 'outline' | 'planning' | 'writing' | 'editing' | 'continuity' | 'embedding';

// Provider names
export type ProviderName = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'ollama' | 'openrouter' | 'mistral' | 'azure';

// Model configuration for a specific role
export interface ModelConfig {
  provider: ProviderName;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// Provider API key configuration
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  // Azure-specific
  endpoint?: string;      // e.g., https://xxx.cognitiveservices.azure.com/
  apiVersion?: string;    // e.g., 2025-04-01-preview
  deployment?: string;    // Default deployment name
}

// Generation configuration
export interface GenerationConfig {
  contentType: ContentType;
  targetWords: number;
  chaptersCount: number;
  maxEditCycles: number;
  humanReview: boolean;
  models: Partial<Record<ModelRole, ModelConfig>>;
}

// Chapter plan in the outline
export interface ChapterPlan {
  number: number;
  title: string;
  summary: string;
  targetWords: number;
  keyEvents: string[];
  characters: string[];
}

// Full outline
export interface Outline {
  title: string;
  synopsis: string;
  themes: string[];
  targetAudience: string;
  chapters: ChapterPlan[];
  characters: CharacterProfile[];
}

// Character profile
export interface CharacterProfile {
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  description: string;
  traits: string[];
  arc: string;
}

// Chapter content after writing
export interface ChapterContent {
  number: number;
  title: string;
  content: string;
  wordCount: number;
  summary: string;
  editCount: number;
  approved: boolean;
}

// Editor's evaluation result
export interface EditResult {
  scores: {
    prose: number;
    plot: number;
    character: number;
    pacing: number;
    dialogue: number;
    overall: number;
  };
  editNotes: string[];
  approved: boolean;
  rewriteInstructions?: string;
}

// Detailed plan for current chapter
export interface DetailedChapterPlan {
  chapterNumber: number;
  title: string;
  scenes: ScenePlan[];
  pov: string;
  tone: string;
  targetWords: number;
  bridgeFromPrevious: string;
  bridgeToNext: string;
}

export interface ScenePlan {
  number: number;
  setting: string;
  characters: string[];
  objective: string;
  conflict: string;
  resolution: string;
  targetWords: number;
}

// Cost tracking
export interface CostEntry {
  step: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface CostEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  breakdown: {
    step: string;
    model: string;
    estimatedCost: number;
  }[];
  warnings: string[];
}

// Progress events yielded during generation
export type ProgressEvent =
  | { type: 'outline_complete'; outline: Outline }
  | { type: 'chapter_started'; chapter: number; title: string }
  | { type: 'chapter_written'; chapter: number; wordCount: number }
  | { type: 'edit_cycle'; chapter: number; cycle: number; approved: boolean; scores: EditResult['scores'] }
  | { type: 'chapter_complete'; chapter: number; title: string; wordCount: number }
  | { type: 'human_review_requested'; chapter: number; content: string }
  | { type: 'generation_complete'; totalWords: number; totalCost: number; totalChapters: number }
  | { type: 'cost_update'; totalCost: number; step: string }
  | { type: 'error'; message: string; recoverable: boolean }
  // BookSession events
  | { type: 'outline_generated'; outline: Outline }
  | { type: 'outline_approved' }
  | { type: 'chapter_plan_generated'; chapter: number; plan: DetailedChapterPlan }
  | { type: 'word_count_warning'; chapter: number; target: number; actual: number }
  | { type: 'expand_attempt'; chapter: number; attempt: number; currentWords: number; targetWords: number }
  | { type: 'context_trimmed'; chapter: number; droppedItems: string[] }
  | { type: 'chapter_failed'; chapter: number; error: string; canRetry: boolean }
  | { type: 'session_saved'; sessionId: string }
  | { type: 'refusal_detected'; chapter: number; attempt: number };

// Final book output
export interface Book {
  title: string;
  outline: Outline;
  chapters: ChapterContent[];
  totalWords: number;
  totalCost: number;
  metadata: {
    contentType: ContentType;
    generatedAt: string;
    models: Record<string, string>;
    threadId: string;
  };
}

// Human feedback for resume
export interface HumanFeedback {
  approved: boolean;
  notes?: string;
  editInstructions?: string;
}

// LongFormAI constructor config
export interface LongFormAIConfig {
  providers: Partial<Record<ProviderName, ProviderConfig>>;
  models?: Partial<Record<ModelRole, ModelConfig>>;
  preset?: 'budget' | 'balanced' | 'premium' | 'azure';
  checkpointer?: 'memory' | 'sqlite' | 'postgres';
  checkpointerConfig?: {
    connectionString?: string;
    dbPath?: string;
  };
  memory?: {
    provider: 'qdrant' | 'none';
    url?: string;
    apiKey?: string;
    collectionPrefix?: string;
  };
}

// Generate options
export interface GenerateOptions {
  title: string;
  description: string;
  contentType?: ContentType;
  targetWords?: number;
  chapters?: number;
  maxEditCycles?: number;
  humanReview?: boolean;
  threadId?: string;
}

// Character state tracking (for memory system)
export interface CharacterState {
  name: string;
  lastSeenChapter: number;
  alive: boolean;
  location: string;
  emotionalState: string;
  relationships: Record<string, string>;
  inventory: string[];
  knownInformation: string[];
}

// Timeline event (for memory system)
export interface TimelineEvent {
  chapter: number;
  timestamp: string;
  event: string;
  characters: string[];
  location: string;
  significance: 'major' | 'minor' | 'background';
}

// World state (for memory system)
export interface WorldStateUpdate {
  chapter: number;
  locations: { name: string; description: string; status: string }[];
  organizations: { name: string; status: string; changes: string }[];
  rules: { rule: string; established: number }[];
}

// Relevant context assembled by ContextRetriever
export interface RelevantContext {
  rollingSummary: string;
  relevantPassages: { text: string; chapter: number; score: number }[];
  characterStates: CharacterState[];
  recentEvents: TimelineEvent[];
  worldContext: string;
  bridgeText: string;
  totalTokens: number;
}

// --- BookSession Types ---

// Outline modification changes
export interface OutlineChanges {
  updateChapter?: { number: number; title?: string; summary?: string; targetWords?: number; keyEvents?: string[] }[];
  addChapter?: { afterChapter: number; title: string; summary: string; targetWords?: number }[];
  removeChapters?: number[];
  reorderChapters?: number[];
  splitChapter?: { chapter: number; splitAt: string }[];
  mergeChapters?: { chapters: [number, number]; newTitle: string }[];
  updateCharacter?: { name: string; changes: Partial<CharacterProfile> }[];
  addCharacter?: CharacterProfile[];
  removeCharacters?: string[];
  synopsis?: string;
  themes?: string[];
  targetAudience?: string;
}

// Per-chapter word count configuration
export interface ChapterWordConfig {
  defaultWords: number;
  chapterOverrides?: Record<number, number>;
  tolerance: number;
  minWords: number;
}

// BookSession constructor config
export interface BookSessionConfig extends LongFormAIConfig {
  title: string;
  description: string;
  contentType?: ContentType;
  chapters?: number;
  wordConfig?: ChapterWordConfig;
  maxEditCycles?: number;
  styleGuide?: string;
}

// Chapter generation result
export interface ChapterResult {
  chapter: ChapterContent;
  targetWords: number;
  meetsTarget: boolean;
  editHistory: EditCycleRecord[];
  costForChapter: number;
  generationTimeMs: number;
}

// Record of a single edit cycle
export interface EditCycleRecord {
  cycle: number;
  scores: EditResult['scores'];
  approved: boolean;
  feedback?: string;
}

// Session progress snapshot
export interface SessionProgress {
  phase: 'idle' | 'outline' | 'writing' | 'complete';
  outlineApproved: boolean;
  totalChapters: number;
  chaptersCompleted: number;
  chapterStatuses: Map<number, ChapterStatus>;
  totalWords: number;
  totalCost: number;
  estimatedRemainingCost: number;
}

// Chapter generation status
export type ChapterStatus = 'pending' | 'generating' | 'draft' | 'approved' | 'failed';

// Session event types for the event emitter
export type SessionEventType = ProgressEvent['type'];

// Event handler type
export type SessionEventHandler = (event: ProgressEvent) => void;

// Chapter callback for generateAllRemaining
export type ChapterCallback = (result: ChapterResult) => void | Promise<void>;

// Context item for TokenBudget
export interface ContextItem {
  key: string;
  content: string;
  priority: number;
  required?: boolean;
}

// Assembled context from TokenBudget
export interface AssembledContext {
  text: string;
  totalTokens: number;
  includedItems: string[];
  droppedItems: string[];
}

// Session storage interface
export interface SessionStorage {
  save(id: string, state: string): Promise<void>;
  load(id: string): Promise<string | null>;
  delete(id: string): Promise<void>;
  list(): Promise<string[]>;
}
