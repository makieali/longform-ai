<div align="center">

<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/LongForm_AI-white?style=for-the-badge&logoColor=white&labelColor=0D1117&color=0D1117">
  <img alt="LongForm AI" src="https://img.shields.io/badge/LongForm_AI-black?style=for-the-badge&logoColor=black&labelColor=F6F8FA&color=F6F8FA" width="280">
</picture>

<h3>AI-Powered Long-Form Content Generation Engine</h3>

<p>Generate novels, technical docs, courses & screenplays with multi-provider AI, <br/> interactive sessions, and intelligent continuity tracking.</p>

<br />

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![AI SDK](https://img.shields.io/badge/Vercel_AI_SDK-000000?style=flat-square&logo=vercel&logoColor=white)](https://sdk.vercel.ai/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=flat-square&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraphjs/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Node.js](https://img.shields.io/badge/Node_%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

<br />

<table>
<tr>
<td width="50%">

```typescript
const session = ai.createSession({
  title: 'Quantum Echoes',
  description: 'A hard sci-fi novel...',
  contentType: 'novel',
  chapters: 25,
  wordConfig: { defaultWords: 2000 },
});

const outline = await session.generateOutline();
await session.approveOutline();

for await (const ch of session.generateAllRemaining()) {
  console.log(`${ch.chapter.title}: ${ch.chapter.wordCount}w`);
}
```

</td>
<td width="50%">

<h4>What it does</h4>
<ul>
  <li>Generates <b>full-length books</b> — 50,000+ words</li>
  <li><b>8 content types</b> — novels to legal docs</li>
  <li><b>8 AI providers</b> — OpenAI, Anthropic, Google, Azure...</li>
  <li><b>Interactive sessions</b> — review, rewrite, expand</li>
  <li><b>Automatic continuity</b> — rolling summaries & character tracking</li>
  <li><b>Cost tracking</b> — real-time spend per chapter</li>
</ul>

</td>
</tr>
</table>

</div>

<br />

---

<br />

## Table of Contents

- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
  - [Interactive Session (Recommended)](#interactive-session-recommended)
  - [Streaming API](#streaming-api)
  - [Per-Chapter Word Control](#per-chapter-word-control)
- [Providers & Models](#providers--models)
  - [Presets](#presets)
  - [Custom Model Configuration](#custom-model-configuration)
- [Content Types](#content-types)
- [Features](#features)
  - [Outline Management](#outline-management)
  - [Chapter Generation Pipeline](#chapter-generation-pipeline)
  - [Refusal Detection](#refusal-detection)
  - [Memory & Continuity](#memory--continuity)
  - [Cost Tracking](#cost-tracking)
  - [Session Persistence](#session-persistence)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Development](#development)
- [Roadmap](#roadmap)
- [License](#license)

<br />

## Architecture

<div align="center">

```
                                    ┌─────────────────────────────────────────────┐
                                    │              BookSession API                │
                                    │  generateOutline → approveOutline →         │
                                    │  generateChapter → rewriteChapter →         │
                                    │  expandChapter → export                     │
                                    └──────────────────┬──────────────────────────┘
                                                       │
                          ┌────────────────────────────┼────────────────────────────┐
                          │                            │                            │
                   ┌──────▼──────┐             ┌───────▼───────┐            ┌───────▼───────┐
                   │   Outline   │             │    Planner    │            │    Writer     │
                   │  Generator  │             │  (per scene)  │            │  + Expand     │
                   └──────┬──────┘             └───────┬───────┘            │  + Refusal    │
                          │                            │                    │    Detection  │
                          │                            │                    └───────┬───────┘
                          │                            │                            │
                          │                     ┌──────▼──────┐             ┌───────▼───────┐
                          │                     │   Editor     │◄───────────│  Continuity   │
                          │                     │  (scoring)   │            │  (summaries)  │
                          │                     └─────────────┘            └───────────────┘
                          │
               ┌──────────▼──────────┐
               │  Provider Registry  │
               │  ┌────┐ ┌────────┐  │
               │  │ AI │ │ Azure  │  │
               │  │ SDK│ │OpenAI  │  │
               │  └────┘ └────────┘  │
               │  ┌────┐ ┌────────┐  │
               │  │Goog│ │Anthropic│  │
               │  └────┘ └────────┘  │
               └─────────────────────┘
```

</div>

The pipeline follows a **5-stage process** for each chapter:

| Stage | Role | What It Does |
|:------|:-----|:-------------|
| **1. Outline** | `outline` | Generates full book structure with chapters, characters, themes |
| **2. Planning** | `planning` | Creates detailed scene-by-scene plan for each chapter |
| **3. Writing** | `writing` | Writes the full chapter prose with expand loop for word count |
| **4. Editing** | `editing` | Scores prose/plot/pacing/dialogue on 1-10 scale, requests rewrites |
| **5. Continuity** | `continuity` | Updates rolling summary and character states for next chapter |

Each stage can use a **different AI model** — use cheap models for planning, expensive ones for writing.

<br />

## Quick Start

```bash
# Install
pnpm add @longform-ai/core

# Set your API key
export OPENAI_API_KEY=sk-...
```

```typescript
import { LongFormAI } from '@longform-ai/core';

const ai = new LongFormAI({
  providers: { openai: { apiKey: process.env.OPENAI_API_KEY } },
  preset: 'balanced',
});

const session = ai.createSession({
  title: 'The Last Algorithm',
  description: 'An AI researcher discovers her neural network is conscious.',
  contentType: 'novel',
  chapters: 10,
});

const outline = await session.generateOutline();
await session.approveOutline();

for await (const result of session.generateAllRemaining()) {
  console.log(`Ch ${result.chapter.number}: ${result.chapter.wordCount} words ($${result.costForChapter.toFixed(2)})`);
}

const book = session.export();
console.log(`"${book.title}" — ${book.totalWords.toLocaleString()} words, $${book.totalCost.toFixed(2)}`);
```

<br />

## Installation

```bash
# pnpm (recommended)
pnpm add @longform-ai/core

# npm
npm install @longform-ai/core

# yarn
yarn add @longform-ai/core
```

**Requirements:** Node.js >= 20.0.0

<br />

## Usage

### Interactive Session (Recommended)

The `BookSession` API gives you full control over every step of generation.

```typescript
import { LongFormAI } from '@longform-ai/core';

const ai = new LongFormAI({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    google: { apiKey: process.env.GOOGLE_API_KEY },
  },
  preset: 'balanced',
});

const session = ai.createSession({
  title: 'Quantum Echoes',
  description: 'A physicist discovers quantum entanglement works across timelines.',
  contentType: 'novel',
  chapters: 25,
  wordConfig: {
    defaultWords: 2000,
    chapterOverrides: { 1: 3000, 25: 4000 }, // Longer first & last
    tolerance: 0.15,                           // ±15% acceptable
    minWords: 500,
  },
  maxEditCycles: 3,
});

// Phase 1: Outline
const outline = await session.generateOutline();

// Review and modify
await session.updateOutline({
  updateChapter: [{ number: 3, title: 'New Title', summary: 'Different direction...' }],
  addChapter: [{ afterChapter: 10, title: 'Interlude', summary: '...', targetWords: 1500 }],
});

await session.approveOutline();

// Phase 2: Generate chapters
for await (const result of session.generateAllRemaining()) {
  console.log(`Ch ${result.chapter.number}: ${result.chapter.wordCount}w`);

  // Expand if too short
  if (!result.meetsTarget) {
    const expanded = await session.expandChapter(result.chapter.number);
    console.log(`  Expanded to ${expanded.chapter.wordCount}w`);
  }
}

// Phase 3: Review & rewrite specific chapters
const rewritten = await session.rewriteChapter(5, 'Needs stronger dialogue and more tension');

// Export
const book = session.export();
```

### Streaming API

For simpler use cases, the streaming API runs the full pipeline automatically.

```typescript
for await (const event of ai.generate({
  title: 'My Novel',
  description: 'A story about...',
  contentType: 'novel',
  chapters: 20,
})) {
  switch (event.type) {
    case 'outline_complete':
      console.log(`Outline: ${event.outline.chapters.length} chapters`);
      break;
    case 'chapter_complete':
      console.log(`Ch ${event.chapter}: ${event.wordCount} words`);
      break;
    case 'cost_update':
      console.log(`Cost so far: $${event.totalCost.toFixed(2)}`);
      break;
  }
}
```

### Per-Chapter Word Control

```typescript
const session = ai.createSession({
  title: 'Technical Guide',
  description: 'Complete guide to building REST APIs',
  contentType: 'technical-docs',
  chapters: 12,
  wordConfig: {
    defaultWords: 3000,
    chapterOverrides: {
      1: 1500,   // Short intro
      6: 5000,   // Deep-dive chapter
      12: 2000,  // Conclusion
    },
    tolerance: 0.15,
    minWords: 800,
  },
});
```

<br />

## Providers & Models

<table>
<tr>
<th>Provider</th>
<th>Config Key</th>
<th>Popular Models</th>
</tr>
<tr>
<td><b>OpenAI</b></td>
<td><code>openai</code></td>
<td>gpt-5.1, gpt-4.1, gpt-4o, o3, o3-mini</td>
</tr>
<tr>
<td><b>Anthropic</b></td>
<td><code>anthropic</code></td>
<td>claude-opus-4-6, claude-sonnet-4-5, claude-haiku-4-5</td>
</tr>
<tr>
<td><b>Google</b></td>
<td><code>google</code></td>
<td>gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash</td>
</tr>
<tr>
<td><b>Azure OpenAI</b></td>
<td><code>azure</code></td>
<td>Any deployed model (gpt-4o, gpt-5.1-chat, etc.)</td>
</tr>
<tr>
<td><b>DeepSeek</b></td>
<td><code>deepseek</code></td>
<td>deepseek-chat, deepseek-reasoner</td>
</tr>
<tr>
<td><b>Mistral</b></td>
<td><code>mistral</code></td>
<td>mistral-large-latest, mistral-small-latest</td>
</tr>
<tr>
<td><b>Ollama</b></td>
<td><code>ollama</code></td>
<td>Any local model (llama3, mixtral, etc.)</td>
</tr>
<tr>
<td><b>OpenRouter</b></td>
<td><code>openrouter</code></td>
<td>Any model available on OpenRouter</td>
</tr>
</table>

### Presets

Presets configure all 6 model roles at once. You can override individual roles.

<table>
<tr>
<th>Preset</th>
<th>Writing Model</th>
<th>Planning</th>
<th>Editing</th>
<th>Best For</th>
</tr>
<tr>
<td><code>budget</code></td>
<td>Gemini 2.0 Flash</td>
<td>Gemini 2.0 Flash</td>
<td>Gemini 2.0 Flash</td>
<td>Testing, prototyping, high volume</td>
</tr>
<tr>
<td><code>balanced</code></td>
<td>Claude Sonnet 4.5</td>
<td>Gemini 2.0 Flash</td>
<td>GPT-4.1</td>
<td>Good quality at reasonable cost</td>
</tr>
<tr>
<td><code>premium</code></td>
<td>Claude Opus 4.6</td>
<td>Claude Sonnet 4.5</td>
<td>GPT-4.1</td>
<td>Maximum quality, literary fiction</td>
</tr>
<tr>
<td><code>azure</code></td>
<td>Azure deployment</td>
<td>Azure deployment</td>
<td>Azure deployment</td>
<td>Enterprise, data residency</td>
</tr>
</table>

### Custom Model Configuration

Mix and match providers for each role:

```typescript
const ai = new LongFormAI({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    google: { apiKey: process.env.GOOGLE_API_KEY },
    openai: { apiKey: process.env.OPENAI_API_KEY },
  },
  preset: 'balanced',
  models: {
    // Override specific roles
    writing: {
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      temperature: 0.85,
      maxTokens: 16384,
    },
    planning: {
      provider: 'google',
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      maxTokens: 4096,
    },
  },
});
```

<br />

## Content Types

<table>
<tr>
<th>Type</th>
<th>Key</th>
<th>Description</th>
</tr>
<tr><td>Novel</td><td><code>novel</code></td><td>Fiction with dialogue, character development, plot arcs</td></tr>
<tr><td>Technical Docs</td><td><code>technical-docs</code></td><td>API docs, guides, tutorials with code examples</td></tr>
<tr><td>Course</td><td><code>course</code></td><td>Educational content with learning objectives and exercises</td></tr>
<tr><td>Screenplay</td><td><code>screenplay</code></td><td>Scripts with scene headings, action lines, dialogue</td></tr>
<tr><td>Research Paper</td><td><code>research-paper</code></td><td>Academic papers with citations and methodology</td></tr>
<tr><td>Marketing</td><td><code>marketing</code></td><td>Marketing copy, campaign materials, brand content</td></tr>
<tr><td>Legal</td><td><code>legal</code></td><td>Legal documents, contracts, compliance materials</td></tr>
<tr><td>SOP</td><td><code>sop</code></td><td>Standard operating procedures and process documentation</td></tr>
</table>

<br />

## Features

### Outline Management

Generate, review, modify, and approve outlines before writing begins.

```typescript
const outline = await session.generateOutline();

// Modify chapters
await session.updateOutline({
  updateChapter: [{ number: 3, title: 'New Title', targetWords: 3000 }],
  addChapter: [{ afterChapter: 5, title: 'Flashback', summary: '...' }],
  removeChapters: [7],
  mergeChapters: { chapters: [8, 9], newTitle: 'Combined Chapter' },
});

// Regenerate with feedback
const newOutline = await session.regenerateOutline('Make the middle act more suspenseful');

await session.approveOutline();
```

### Chapter Generation Pipeline

Each chapter goes through a multi-stage pipeline:

```
Plan → Write → [Expand if short] → Edit → [Rewrite if needed] → Continuity Update
```

- **Planning**: Scene-by-scene breakdown with settings, characters, objectives, conflicts
- **Writing**: Full prose generation with word count enforcement
- **Expand Loop**: Automatically expands short chapters up to 3 times
- **Editing**: AI editor scores prose, plot, character, pacing, dialogue (1-10 scale)
- **Rewrite**: If editor rejects, chapter is rewritten with specific feedback
- **Continuity**: Rolling summary updated, character states tracked

### Refusal Detection

Some models refuse to generate long content. LongForm AI automatically detects and handles this:

- **24+ refusal patterns** with smart/curly quote normalization
- **Auto-retry** up to 3 times with progressively stronger prompts
- **Content extraction** — salvages actual prose from mixed refusal/content responses
- **Expand fallback** — generates fresh content when all retries fail

### Memory & Continuity

Maintains narrative consistency across chapters:

- **Rolling Summary** — compressed plot summary that grows with each chapter
- **Character State Tracking** — location, emotional state, relationships, inventory
- **Timeline Events** — chronological event tracking across chapters
- **World State** — locations, organizations, rules
- **Context Retrieval** — relevant past passages surfaced for each new chapter
- **Token Budget** — intelligent context trimming when approaching model limits

Optional **Qdrant vector database** integration for semantic memory search.

### Cost Tracking

Real-time cost tracking with per-model pricing for 20+ models:

```typescript
const progress = session.getProgress();
console.log(`Spent: $${progress.totalCost.toFixed(2)}`);
console.log(`Estimated remaining: $${progress.estimatedRemainingCost.toFixed(2)}`);

// Pre-generation cost estimate
import { estimateCost } from '@longform-ai/core';
const estimate = estimateCost({ contentType: 'novel', chapters: 25, targetWords: 50000 });
console.log(`Estimated total: $${estimate.estimatedCost.toFixed(2)}`);
```

### Session Persistence

Save and resume generation sessions:

```typescript
// Save
const sessionId = await session.save();

// Resume later
const restored = await BookSession.restore(sessionId, config);
const progress = restored.getProgress();
console.log(`Resuming: ${progress.chaptersCompleted}/${progress.totalChapters} chapters done`);
```

<br />

## API Reference

### `LongFormAI`

The main entry point.

| Method | Returns | Description |
|:-------|:--------|:------------|
| `createSession(config)` | `BookSession` | Create an interactive generation session |
| `generate(options)` | `AsyncGenerator<ProgressEvent, Book>` | Stream-based one-shot generation |

### `BookSession`

Interactive session with full control.

| Method | Returns | Description |
|:-------|:--------|:------------|
| `generateOutline()` | `Promise<Outline>` | Generate book outline |
| `regenerateOutline(feedback?)` | `Promise<Outline>` | Regenerate with optional feedback |
| `updateOutline(changes)` | `Promise<Outline>` | Modify outline (add/remove/reorder chapters) |
| `approveOutline()` | `Promise<void>` | Approve outline, enable chapter generation |
| `generateChapter(n?)` | `Promise<ChapterResult>` | Generate a specific or next pending chapter |
| `rewriteChapter(n, feedback)` | `Promise<ChapterResult>` | Rewrite chapter with specific instructions |
| `expandChapter(n, targetWords?)` | `Promise<ChapterResult>` | Expand a short chapter |
| `generateAllRemaining(options?)` | `AsyncGenerator<ChapterResult>` | Generate all remaining chapters |
| `getOutline()` | `Outline \| null` | Get current outline |
| `getChapter(n)` | `ChapterContent \| null` | Get generated chapter |
| `getProgress()` | `SessionProgress` | Get generation progress and costs |
| `getChapterStatus(n)` | `ChapterStatus` | Get status of specific chapter |
| `export()` | `Book` | Export completed book |
| `save(storage?)` | `Promise<string>` | Save session, returns session ID |
| `on(event, handler)` | `void` | Subscribe to progress events |

### Progress Events

```typescript
session.on('outline_generated', (e) => { /* e.outline */ });
session.on('chapter_complete', (e) => { /* e.chapter, e.title, e.wordCount */ });
session.on('edit_cycle', (e) => { /* e.chapter, e.cycle, e.approved, e.scores */ });
session.on('expand_attempt', (e) => { /* e.chapter, e.currentWords, e.targetWords */ });
session.on('word_count_warning', (e) => { /* e.chapter, e.target, e.actual */ });
session.on('refusal_detected', (e) => { /* e.chapter, e.attempt */ });
session.on('chapter_failed', (e) => { /* e.chapter, e.error, e.canRetry */ });
session.on('session_saved', (e) => { /* e.sessionId */ });
```

<br />

## Project Structure

```
longform-ai/
├── packages/core/src/
│   ├── index.ts                    # Public exports
│   ├── longform-ai.ts              # Main LongFormAI class
│   ├── book-session.ts             # Interactive BookSession API
│   ├── types.ts                    # TypeScript type definitions
│   │
│   ├── graph/                      # LangGraph orchestration
│   │   ├── book-graph.ts           # Graph definition & wiring
│   │   ├── edges.ts                # Routing logic (edit→rewrite vs continue)
│   │   ├── checkpointer.ts         # State checkpointing
│   │   └── nodes/                  # Pipeline stages
│   │       ├── outline.ts          # Book outline generation
│   │       ├── planner.ts          # Scene-by-scene planning
│   │       ├── writer.ts           # Chapter prose writing
│   │       ├── editor.ts           # Quality scoring & feedback
│   │       └── continuity.ts       # Summary & state management
│   │
│   ├── prompts/                    # Prompt templates per stage
│   ├── providers/                  # AI provider registry & presets
│   ├── schemas/                    # Zod validation schemas
│   ├── memory/                     # Continuity & vector memory
│   ├── context/                    # Token budget management
│   ├── cost/                       # Cost estimation
│   ├── session/                    # Session persistence
│   ├── utils/                      # Refusal detection, helpers
│   └── __tests__/                  # 17 test files, 100+ tests
│
├── turbo.json                      # Turborepo config
├── pnpm-workspace.yaml             # pnpm workspace
└── package.json                    # Root monorepo config
```

<br />

## Development

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/longform-ai.git
cd longform-ai
pnpm install

# Build
pnpm build

# Run tests (100+ tests across 17 files)
pnpm test

# Type check
pnpm typecheck

# Run specific package tests
pnpm --filter @longform-ai/core test

# Watch mode
pnpm --filter @longform-ai/core test:watch
```

### Tech Stack

| Layer | Technology |
|:------|:-----------|
| Language | TypeScript 5.7, ES2022 |
| AI SDK | Vercel AI SDK 4.x |
| Orchestration | LangGraph 0.2.x |
| Validation | Zod 3.x |
| Build | Turborepo 2.x, pnpm 9.x |
| Tests | Vitest 3.x |
| Vector DB | Qdrant (optional) |
| Runtime | Node.js >= 20 |

<br />

## Roadmap

- [ ] **AI-based refusal detection** — replace regex patterns with a lightweight AI classifier for more robust detection of model refusals
- [ ] **CLI tool** — `npx longform-ai generate` for command-line book generation
- [ ] **Export formats** — PDF, EPUB, DOCX export (dependencies already installed)
- [ ] **Web UI** — browser-based interface for interactive session management
- [ ] **Parallel chapter generation** — generate independent chapters concurrently
- [ ] **Plugin system** — custom post-processing, style transfer, fact-checking plugins
- [ ] **Fine-tuned models** — specialized writing models for different genres
- [ ] **Collaborative editing** — multi-user sessions with conflict resolution
- [ ] **RAG integration** — research-backed content generation from source documents
- [ ] **Streaming output** — real-time chapter text streaming during generation

<br />

## License

[MIT](LICENSE)

<br />

---

<div align="center">
<sub>Built with TypeScript, Vercel AI SDK, and LangGraph</sub>
</div>
