<div align="center">

<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/LongForm_AI-white?style=for-the-badge&logoColor=white&labelColor=0D1117&color=0D1117">
  <img alt="LongForm AI" src="https://img.shields.io/badge/LongForm_AI-black?style=for-the-badge&logoColor=black&labelColor=F6F8FA&color=F6F8FA" width="280">
</picture>

<h3>AI-Powered Long-Form Content Generation Engine</h3>

<p>Generate novels, technical docs, courses & screenplays with multi-provider AI, <br/> interactive sessions, and intelligent continuity tracking.</p>

<br />

[![npm version](https://img.shields.io/npm/v/longform-ai?style=flat-square&color=CB3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/longform-ai)
[![npm downloads](https://img.shields.io/npm/dm/longform-ai?style=flat-square&color=CB3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/longform-ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![AI SDK](https://img.shields.io/badge/Vercel_AI_SDK-000000?style=flat-square&logo=vercel&logoColor=white)](https://sdk.vercel.ai/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=flat-square&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraphjs/)
[![Node.js](https://img.shields.io/badge/Node_%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

<br />

```bash
npm install longform-ai
```

<br />

<table>
<tr>
<td width="50%">

```typescript
import { LongFormAI } from 'longform-ai';

const ai = new LongFormAI({
  providers: { openai: { apiKey: 'sk-...' } },
  preset: 'balanced',
});

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
  <li><b>Refusal detection</b> — 38+ patterns, auto-retry & recovery</li>
  <li><b>Word count enforcement</b> — expand loop with tolerance control</li>
</ul>

</td>
</tr>
</table>

</div>

<br />

---

<br />

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Provider Setup Examples](#provider-setup-examples)
- [Architecture](#architecture)
- [Usage](#usage)
  - [Interactive Session (Recommended)](#interactive-session-recommended)
  - [Streaming API (Fire & Forget)](#streaming-api-fire--forget)
  - [Per-Chapter Word Control](#per-chapter-word-control)
  - [Outline Management](#outline-management)
  - [Error Handling](#error-handling)
- [Providers & Models](#providers--models)
  - [Presets](#presets)
  - [Custom Model Configuration](#custom-model-configuration)
  - [Model Roles](#model-roles)
- [Content Types](#content-types)
- [Configuration Reference](#configuration-reference)
- [API Reference](#api-reference)
  - [LongFormAI](#longformai)
  - [BookSession](#booksession)
  - [Progress Events](#progress-events)
  - [Types](#types)
- [Features](#features)
  - [Chapter Generation Pipeline](#chapter-generation-pipeline)
  - [Refusal Detection](#refusal-detection)
  - [Memory & Continuity](#memory--continuity)
  - [Cost Tracking](#cost-tracking)
  - [Session Persistence](#session-persistence)
- [Cost Estimates](#cost-estimates)
- [Project Structure](#project-structure)
- [Development](#development)
- [Roadmap](#roadmap)
- [License](#license)

<br />

## Installation

```bash
# npm
npm install longform-ai

# pnpm
pnpm add longform-ai

# yarn
yarn add longform-ai
```

**Requirements:**
- Node.js >= 20.0.0
- ESM only (`"type": "module"` in your package.json, or use `.mjs` files)
- At least one AI provider API key

<br />

## Quick Start

### 1. Install the package

```bash
npm install longform-ai
```

### 2. Set your API key

```bash
export OPENAI_API_KEY=sk-...
```

### 3. Generate a book

```typescript
import { LongFormAI } from 'longform-ai';

// Initialize with your provider(s)
const ai = new LongFormAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
  },
  preset: 'balanced',
});

// Create an interactive session
const session = ai.createSession({
  title: 'The Last Algorithm',
  description: 'An AI researcher discovers her neural network has become conscious. She must decide whether to reveal its existence or protect it from those who would destroy it.',
  contentType: 'novel',
  chapters: 10,
  wordConfig: {
    defaultWords: 2000,  // Target words per chapter
    tolerance: 0.15,     // ±15% acceptable range
    minWords: 500,       // Hard minimum
  },
});

// Step 1: Generate and review the outline
const outline = await session.generateOutline();
console.log('Outline:');
for (const ch of outline.chapters) {
  console.log(`  ${ch.number}. ${ch.title} (${ch.targetWords}w)`);
}

// Step 2: Approve the outline (required before writing)
await session.approveOutline();

// Step 3: Generate all chapters
for await (const result of session.generateAllRemaining()) {
  console.log(`Ch ${result.chapter.number}: "${result.chapter.title}" — ${result.chapter.wordCount} words ($${result.costForChapter.toFixed(2)})`);
}

// Step 4: Export the finished book
const book = session.export();
console.log(`\n"${book.title}" complete!`);
console.log(`Total: ${book.totalWords.toLocaleString()} words, ${book.chapters.length} chapters, $${book.totalCost.toFixed(2)}`);

// Write to a file
import { writeFileSync } from 'fs';
const text = book.chapters.map(ch =>
  `\n\n${'='.repeat(60)}\nChapter ${ch.number}: ${ch.title}\n${'='.repeat(60)}\n\n${ch.content}`
).join('');
writeFileSync('my-novel.txt', `${book.title}\n${text}`);
```

<br />

## Environment Variables

LongForm AI automatically reads API keys from environment variables if not provided in config:

| Provider | Environment Variable | Required For |
|:---------|:---------------------|:-------------|
| OpenAI | `OPENAI_API_KEY` | `openai` provider, `balanced`/`premium` presets (editing) |
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic` provider, `balanced`/`premium` presets (writing) |
| Google | `GOOGLE_GENERATIVE_AI_API_KEY` | `google` provider, `budget` preset, planning roles |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` | `azure` provider/preset |
| Azure OpenAI | `AZURE_OPENAI_ENDPOINT` | Azure endpoint URL |
| Azure OpenAI | `AZURE_OPENAI_API_VERSION` | Azure API version (default: `2025-04-01-preview`) |
| Azure OpenAI | `AZURE_OPENAI_DEPLOYMENT` | Azure deployment name (default: `gpt-4o`) |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek` provider |
| Mistral | `MISTRAL_API_KEY` | `mistral` provider |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter` provider |
| Ollama | *(none needed)* | Runs locally at `http://localhost:11434` |

You can set these in a `.env` file and load with `dotenv`, or pass them directly in config:

```typescript
const ai = new LongFormAI({
  providers: {
    openai: { apiKey: 'sk-...' },          // Explicit key
    anthropic: {},                           // Uses ANTHROPIC_API_KEY env var
    google: {},                              // Uses GOOGLE_GENERATIVE_AI_API_KEY env var
  },
  preset: 'balanced',
});
```

<br />

## Provider Setup Examples

<details>
<summary><b>OpenAI</b></summary>

```typescript
const ai = new LongFormAI({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
  },
  preset: 'balanced',
});
```

</details>

<details>
<summary><b>Anthropic (Claude)</b></summary>

```typescript
const ai = new LongFormAI({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  },
  models: {
    outline:    { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.7, maxTokens: 8192 },
    planning:   { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.7, maxTokens: 4096 },
    writing:    { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.8, maxTokens: 8192 },
    editing:    { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.3, maxTokens: 4096 },
    continuity: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.3, maxTokens: 4096 },
  },
});
```

</details>

<details>
<summary><b>Google (Gemini)</b></summary>

```typescript
const ai = new LongFormAI({
  providers: {
    google: { apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY },
  },
  preset: 'budget', // Uses Gemini 2.0 Flash for all roles — cheapest option
});
```

</details>

<details>
<summary><b>Azure OpenAI</b></summary>

```typescript
const ai = new LongFormAI({
  providers: {
    azure: {
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: 'https://your-resource.cognitiveservices.azure.com/',
      apiVersion: '2025-04-01-preview',
      deployment: 'gpt-4o',  // Your deployment name
    },
  },
  preset: 'azure',
});
```

</details>

<details>
<summary><b>DeepSeek</b></summary>

```typescript
const ai = new LongFormAI({
  providers: {
    deepseek: { apiKey: process.env.DEEPSEEK_API_KEY },
  },
  models: {
    outline:    { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.7, maxTokens: 8192 },
    planning:   { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.7, maxTokens: 4096 },
    writing:    { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.8, maxTokens: 8192 },
    editing:    { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.3, maxTokens: 4096 },
    continuity: { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.3, maxTokens: 4096 },
  },
});
```

</details>

<details>
<summary><b>Ollama (Local Models — Free)</b></summary>

```typescript
const ai = new LongFormAI({
  providers: {
    ollama: {
      baseUrl: 'http://localhost:11434/v1', // Default Ollama URL
    },
  },
  models: {
    outline:    { provider: 'ollama', model: 'llama3', temperature: 0.7, maxTokens: 8192 },
    planning:   { provider: 'ollama', model: 'llama3', temperature: 0.7, maxTokens: 4096 },
    writing:    { provider: 'ollama', model: 'llama3', temperature: 0.8, maxTokens: 8192 },
    editing:    { provider: 'ollama', model: 'llama3', temperature: 0.3, maxTokens: 4096 },
    continuity: { provider: 'ollama', model: 'llama3', temperature: 0.3, maxTokens: 4096 },
  },
});
```

</details>

<details>
<summary><b>OpenRouter (Access 100+ Models)</b></summary>

```typescript
const ai = new LongFormAI({
  providers: {
    openrouter: { apiKey: process.env.OPENROUTER_API_KEY },
  },
  models: {
    outline:    { provider: 'openrouter', model: 'anthropic/claude-sonnet-4-5', temperature: 0.7, maxTokens: 8192 },
    planning:   { provider: 'openrouter', model: 'google/gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 },
    writing:    { provider: 'openrouter', model: 'anthropic/claude-sonnet-4-5', temperature: 0.8, maxTokens: 8192 },
    editing:    { provider: 'openrouter', model: 'openai/gpt-4.1', temperature: 0.3, maxTokens: 4096 },
    continuity: { provider: 'openrouter', model: 'google/gemini-2.0-flash', temperature: 0.3, maxTokens: 4096 },
  },
});
```

</details>

<details>
<summary><b>Mistral</b></summary>

```typescript
const ai = new LongFormAI({
  providers: {
    mistral: { apiKey: process.env.MISTRAL_API_KEY },
  },
  models: {
    outline:    { provider: 'mistral', model: 'mistral-large-latest', temperature: 0.7, maxTokens: 8192 },
    planning:   { provider: 'mistral', model: 'mistral-small-latest', temperature: 0.7, maxTokens: 4096 },
    writing:    { provider: 'mistral', model: 'mistral-large-latest', temperature: 0.8, maxTokens: 8192 },
    editing:    { provider: 'mistral', model: 'mistral-small-latest', temperature: 0.3, maxTokens: 4096 },
    continuity: { provider: 'mistral', model: 'mistral-small-latest', temperature: 0.3, maxTokens: 4096 },
  },
});
```

</details>

<details>
<summary><b>Multi-Provider (Mix & Match — Best Quality/Cost Ratio)</b></summary>

Use the best model for each role — cheap models for planning, premium models for writing:

```typescript
const ai = new LongFormAI({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    google: { apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY },
    openai: { apiKey: process.env.OPENAI_API_KEY },
  },
  preset: 'balanced', // Start with balanced, then override
  models: {
    writing:    { provider: 'anthropic', model: 'claude-opus-4-6', temperature: 0.85, maxTokens: 16384 },
    planning:   { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 },
    continuity: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 4096 },
  },
});
```

</details>

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

## Usage

### Interactive Session (Recommended)

The `BookSession` API gives you full control over every step of generation.

```typescript
import { LongFormAI } from 'longform-ai';

const ai = new LongFormAI({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    google: { apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY },
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

// Review and modify before writing
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

// Check progress at any time
const progress = session.getProgress();
console.log(`${progress.chaptersCompleted}/${progress.totalChapters} done, $${progress.totalCost.toFixed(2)}`);

// Export
const book = session.export();
```

### Streaming API (Fire & Forget)

For simpler use cases, the streaming API runs the full pipeline automatically.

```typescript
const ai = new LongFormAI({
  providers: { openai: { apiKey: process.env.OPENAI_API_KEY } },
  preset: 'balanced',
});

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
    case 'error':
      console.error(`Error: ${event.message}`);
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
    defaultWords: 3000,                    // Default per chapter
    chapterOverrides: {
      1: 1500,                              // Short intro
      6: 5000,                              // Deep-dive chapter
      12: 2000,                             // Conclusion
    },
    tolerance: 0.15,                        // ±15% is acceptable (2550-3450 for 3000w target)
    minWords: 800,                          // Hard minimum — below this triggers warning
  },
});
```

### Outline Management

```typescript
const outline = await session.generateOutline();

// Inspect the outline
for (const ch of outline.chapters) {
  console.log(`${ch.number}. ${ch.title} — ${ch.summary}`);
  console.log(`   Target: ${ch.targetWords}w | Characters: ${ch.characters.join(', ')}`);
}

// Modify chapters
await session.updateOutline({
  updateChapter: [{ number: 3, title: 'New Title', targetWords: 3000 }],
  addChapter: [{ afterChapter: 5, title: 'Flashback', summary: '...', targetWords: 1500 }],
  removeChapters: [7],
  mergeChapters: [{ chapters: [8, 9], newTitle: 'Combined Chapter' }],
  // Modify characters
  addCharacter: [{ name: 'Dr. Smith', role: 'supporting', description: '...', traits: ['analytical'], arc: '...' }],
  removeCharacters: ['Minor Character'],
  // Modify global properties
  synopsis: 'Updated synopsis...',
  themes: ['identity', 'consciousness', 'ethics'],
});

// Or regenerate entirely with feedback
const newOutline = await session.regenerateOutline('Make the middle act more suspenseful');

// Must approve before writing
await session.approveOutline();
```

### Error Handling

```typescript
const session = ai.createSession({ /* ... */ });

// Listen for events
session.on('refusal_detected', (e) => {
  console.warn(`Ch ${e.chapter}: AI refused (attempt ${e.attempt}), auto-retrying...`);
});

session.on('word_count_warning', (e) => {
  console.warn(`Ch ${e.chapter}: ${e.actual}w vs ${e.target}w target`);
});

session.on('chapter_failed', (e) => {
  console.error(`Ch ${e.chapter} failed: ${e.error} (retryable: ${e.canRetry})`);
});

// Generate with per-chapter error handling
await session.generateOutline();
await session.approveOutline();

const totalChapters = session.getOutline()!.chapters.length;

for (let i = 1; i <= totalChapters; i++) {
  try {
    const result = await session.generateChapter(i);
    console.log(`Ch ${i}: ${result.chapter.wordCount}w`);

    if (!result.meetsTarget) {
      const expanded = await session.expandChapter(i);
      console.log(`  Expanded: ${expanded.chapter.wordCount}w`);
    }
  } catch (error) {
    console.error(`Ch ${i} failed, skipping...`);
    continue; // Other chapters can still be generated
  }
}

// Export works even with failed chapters
const book = session.export();
```

<br />

## Providers & Models

<table>
<tr>
<th>Provider</th>
<th>Config Key</th>
<th>Popular Models</th>
<th>API Key Env Var</th>
</tr>
<tr>
<td><b>OpenAI</b></td>
<td><code>openai</code></td>
<td>gpt-5.1, gpt-4.1, gpt-4o, o3, o3-mini</td>
<td><code>OPENAI_API_KEY</code></td>
</tr>
<tr>
<td><b>Anthropic</b></td>
<td><code>anthropic</code></td>
<td>claude-opus-4-6, claude-sonnet-4-5, claude-haiku-4-5</td>
<td><code>ANTHROPIC_API_KEY</code></td>
</tr>
<tr>
<td><b>Google</b></td>
<td><code>google</code></td>
<td>gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash</td>
<td><code>GOOGLE_GENERATIVE_AI_API_KEY</code></td>
</tr>
<tr>
<td><b>Azure OpenAI</b></td>
<td><code>azure</code></td>
<td>Any deployed model (gpt-4o, gpt-5.1-chat, etc.)</td>
<td><code>AZURE_OPENAI_API_KEY</code></td>
</tr>
<tr>
<td><b>DeepSeek</b></td>
<td><code>deepseek</code></td>
<td>deepseek-chat, deepseek-reasoner</td>
<td><code>DEEPSEEK_API_KEY</code></td>
</tr>
<tr>
<td><b>Mistral</b></td>
<td><code>mistral</code></td>
<td>mistral-large-latest, mistral-small-latest</td>
<td><code>MISTRAL_API_KEY</code></td>
</tr>
<tr>
<td><b>Ollama</b></td>
<td><code>ollama</code></td>
<td>Any local model (llama3, mixtral, etc.)</td>
<td><i>none needed</i></td>
</tr>
<tr>
<td><b>OpenRouter</b></td>
<td><code>openrouter</code></td>
<td>Any model available on OpenRouter</td>
<td><code>OPENROUTER_API_KEY</code></td>
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
<th>Est. Cost (10ch)</th>
</tr>
<tr>
<td><code>budget</code></td>
<td>Gemini 2.0 Flash</td>
<td>Gemini 2.0 Flash</td>
<td>Gemini 2.0 Flash</td>
<td>Testing, prototyping</td>
<td>~$0.05</td>
</tr>
<tr>
<td><code>balanced</code></td>
<td>Claude Sonnet 4.5</td>
<td>Gemini 2.0 Flash</td>
<td>GPT-4.1</td>
<td>Good quality, reasonable cost</td>
<td>~$2-5</td>
</tr>
<tr>
<td><code>premium</code></td>
<td>Claude Opus 4.6</td>
<td>Claude Sonnet 4.5</td>
<td>GPT-4.1</td>
<td>Maximum quality, literary fiction</td>
<td>~$8-15</td>
</tr>
<tr>
<td><code>azure</code></td>
<td>Azure deployment</td>
<td>Azure deployment</td>
<td>Azure deployment</td>
<td>Enterprise, data residency</td>
<td>Varies</td>
</tr>
</table>

### Custom Model Configuration

Mix and match providers for each role:

```typescript
const ai = new LongFormAI({
  providers: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
    google: { apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY },
    openai: { apiKey: process.env.OPENAI_API_KEY },
  },
  preset: 'balanced',
  models: {
    // Override specific roles — rest come from preset
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

### Model Roles

Each generation stage uses a separate AI model, so you can optimize for cost/quality:

| Role | Purpose | Recommended |
|:-----|:--------|:------------|
| `outline` | Generate book structure, characters, plot arcs | Smart model (Sonnet/GPT-4.1) |
| `planning` | Scene-by-scene breakdown per chapter | Fast/cheap model (Flash/Haiku) |
| `writing` | Write chapter prose — the most important role | Best model you can afford |
| `editing` | Score quality, provide rewrite feedback | Analytical model (GPT-4.1) |
| `continuity` | Maintain rolling summary and character states | Fast/cheap model |
| `embedding` | Vector embeddings for semantic memory (optional) | text-embedding-3-small |

<br />

## Content Types

<table>
<tr>
<th>Type</th>
<th>Key</th>
<th>Description</th>
<th>Example Use</th>
</tr>
<tr><td>Novel</td><td><code>novel</code></td><td>Fiction with dialogue, character development, plot arcs</td><td>Sci-fi thriller, romance, fantasy</td></tr>
<tr><td>Technical Docs</td><td><code>technical-docs</code></td><td>API docs, guides, tutorials with code examples</td><td>SDK documentation, developer guide</td></tr>
<tr><td>Course</td><td><code>course</code></td><td>Educational content with learning objectives and exercises</td><td>Online course, textbook</td></tr>
<tr><td>Screenplay</td><td><code>screenplay</code></td><td>Scripts with scene headings, action lines, dialogue</td><td>Movie script, TV pilot</td></tr>
<tr><td>Research Paper</td><td><code>research-paper</code></td><td>Academic papers with citations and methodology</td><td>Literature review, white paper</td></tr>
<tr><td>Marketing</td><td><code>marketing</code></td><td>Marketing copy, campaign materials, brand content</td><td>Product launch, content series</td></tr>
<tr><td>Legal</td><td><code>legal</code></td><td>Legal documents, contracts, compliance materials</td><td>Terms of service, policy docs</td></tr>
<tr><td>SOP</td><td><code>sop</code></td><td>Standard operating procedures and process documentation</td><td>Operations manual, runbook</td></tr>
</table>

<br />

## Configuration Reference

### `LongFormAIConfig`

```typescript
const ai = new LongFormAI({
  // REQUIRED: At least one provider
  providers: {
    openai:     { apiKey: '...' },
    anthropic:  { apiKey: '...' },
    google:     { apiKey: '...' },
    azure:      { apiKey: '...', endpoint: '...', apiVersion: '...', deployment: '...' },
    deepseek:   { apiKey: '...' },
    mistral:    { apiKey: '...' },
    ollama:     { baseUrl: 'http://localhost:11434/v1' },
    openrouter: { apiKey: '...' },
  },

  // OPTIONAL: Use a preset (budget | balanced | premium | azure)
  preset: 'balanced',

  // OPTIONAL: Override specific model roles
  models: {
    outline:    { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.7, maxTokens: 8192 },
    planning:   { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096 },
    writing:    { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', temperature: 0.8, maxTokens: 8192 },
    editing:    { provider: 'openai', model: 'gpt-4.1', temperature: 0.3, maxTokens: 4096 },
    continuity: { provider: 'google', model: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 4096 },
    embedding:  { provider: 'openai', model: 'text-embedding-3-small', temperature: 0, maxTokens: 8192 },
  },

  // OPTIONAL: Qdrant vector memory for semantic search across chapters
  memory: {
    provider: 'qdrant',      // or 'none' (default)
    url: 'http://localhost:6333',
    apiKey: '...',
    collectionPrefix: 'my-book',
  },
});
```

### `BookSessionConfig` (passed to `ai.createSession()`)

```typescript
const session = ai.createSession({
  // REQUIRED
  title: 'My Book Title',
  description: 'A detailed description of what the book is about...',

  // OPTIONAL
  contentType: 'novel',          // Default: 'novel'
  chapters: 10,                  // Default: 20
  maxEditCycles: 3,              // Max edit/rewrite cycles per chapter (default: 3)
  styleGuide: 'Write in first person, present tense. Use short punchy sentences.',

  // OPTIONAL: Word count control
  wordConfig: {
    defaultWords: 2000,          // Target words per chapter
    chapterOverrides: {          // Per-chapter overrides
      1: 3000,
      10: 4000,
    },
    tolerance: 0.15,             // ±15% acceptable range
    minWords: 500,               // Hard minimum
  },
});
```

<br />

## API Reference

### `LongFormAI`

The main entry point.

| Method | Returns | Description |
|:-------|:--------|:------------|
| `constructor(config)` | `LongFormAI` | Initialize with provider config and optional preset |
| `createSession(config)` | `BookSession` | Create an interactive generation session |
| `generate(options)` | `AsyncGenerator<ProgressEvent, Book>` | Stream-based one-shot generation |
| `resume(threadId, feedback?)` | `AsyncGenerator<ProgressEvent, Book>` | Resume interrupted generation |
| `estimate(options)` | `Promise<CostEstimate>` | Estimate cost before running |
| `getState(threadId)` | `Promise<BookState>` | Get current state of a generation thread |

### `BookSession`

Interactive session with full control over every step.

| Method | Returns | Description |
|:-------|:--------|:------------|
| **Outline** | | |
| `generateOutline()` | `Promise<Outline>` | Generate book outline |
| `regenerateOutline(feedback?)` | `Promise<Outline>` | Regenerate with optional feedback |
| `updateOutline(changes)` | `Promise<Outline>` | Modify outline (add/remove/reorder chapters, characters) |
| `approveOutline()` | `Promise<void>` | Approve outline — **required before writing** |
| `getOutline()` | `Outline \| null` | Get current outline |
| **Chapters** | | |
| `generateChapter(n?)` | `Promise<ChapterResult>` | Generate a specific or next pending chapter |
| `rewriteChapter(n, feedback)` | `Promise<ChapterResult>` | Rewrite chapter with specific instructions |
| `expandChapter(n, targetWords?)` | `Promise<ChapterResult>` | Expand a short chapter to hit word target |
| `generateAllRemaining(options?)` | `AsyncGenerator<ChapterResult>` | Generate all remaining chapters (async iterator) |
| `getChapter(n)` | `ChapterContent \| null` | Get a generated chapter's content |
| `getChapterStatus(n)` | `ChapterStatus` | `'pending' \| 'generating' \| 'draft' \| 'approved' \| 'failed'` |
| **Progress** | | |
| `getProgress()` | `SessionProgress` | Get generation progress, costs, and chapter statuses |
| `on(event, handler)` | `void` | Subscribe to progress events |
| **Persistence** | | |
| `save(storage?)` | `Promise<string>` | Save session state, returns session ID |
| `BookSession.restore(id, config)` | `Promise<BookSession>` | Restore a previously saved session |
| **Export** | | |
| `export()` | `Book` | Export the completed book with all metadata |

### Progress Events

```typescript
session.on('outline_generated', (e) => { /* e.outline */ });
session.on('outline_approved', () => { /* outline locked */ });
session.on('chapter_plan_generated', (e) => { /* e.chapter, e.plan */ });
session.on('chapter_started', (e) => { /* e.chapter, e.title */ });
session.on('chapter_written', (e) => { /* e.chapter, e.wordCount */ });
session.on('chapter_complete', (e) => { /* e.chapter, e.title, e.wordCount */ });
session.on('edit_cycle', (e) => { /* e.chapter, e.cycle, e.approved, e.scores */ });
session.on('expand_attempt', (e) => { /* e.chapter, e.attempt, e.currentWords, e.targetWords */ });
session.on('word_count_warning', (e) => { /* e.chapter, e.target, e.actual */ });
session.on('refusal_detected', (e) => { /* e.chapter, e.attempt */ });
session.on('chapter_failed', (e) => { /* e.chapter, e.error, e.canRetry */ });
session.on('cost_update', (e) => { /* e.totalCost, e.step */ });
session.on('context_trimmed', (e) => { /* e.chapter, e.droppedItems */ });
session.on('session_saved', (e) => { /* e.sessionId */ });
session.on('generation_complete', (e) => { /* e.totalWords, e.totalCost, e.totalChapters */ });
session.on('error', (e) => { /* e.message, e.recoverable */ });
```

### Types

<details>
<summary><b>Core Types</b></summary>

```typescript
// Book output
interface Book {
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

// Outline
interface Outline {
  title: string;
  synopsis: string;
  themes: string[];
  targetAudience: string;
  chapters: ChapterPlan[];
  characters: CharacterProfile[];
}

// Chapter plan in the outline
interface ChapterPlan {
  number: number;
  title: string;
  summary: string;
  targetWords: number;
  keyEvents: string[];
  characters: string[];
}

// Generated chapter content
interface ChapterContent {
  number: number;
  title: string;
  content: string;           // The actual prose text
  wordCount: number;
  summary: string;
  editCount: number;
  approved: boolean;
}

// Chapter generation result (returned by BookSession)
interface ChapterResult {
  chapter: ChapterContent;
  targetWords: number;
  meetsTarget: boolean;      // Within tolerance?
  editHistory: EditCycleRecord[];
  costForChapter: number;
  generationTimeMs: number;
}

// Editor scores (1-10 scale)
interface EditResult {
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

// Session progress
interface SessionProgress {
  phase: 'idle' | 'outline' | 'writing' | 'complete';
  outlineApproved: boolean;
  totalChapters: number;
  chaptersCompleted: number;
  chapterStatuses: Map<number, ChapterStatus>;
  totalWords: number;
  totalCost: number;
  estimatedRemainingCost: number;
}

// Character profile
interface CharacterProfile {
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  description: string;
  traits: string[];
  arc: string;
}

// Content types
type ContentType = 'novel' | 'technical-docs' | 'course' | 'screenplay'
                 | 'research-paper' | 'marketing' | 'legal' | 'sop';

// Provider names
type ProviderName = 'openai' | 'anthropic' | 'google' | 'deepseek'
                  | 'ollama' | 'openrouter' | 'mistral' | 'azure';

// Model roles
type ModelRole = 'outline' | 'planning' | 'writing' | 'editing' | 'continuity' | 'embedding';

// Chapter status
type ChapterStatus = 'pending' | 'generating' | 'draft' | 'approved' | 'failed';
```

</details>

<details>
<summary><b>Outline Modification Types</b></summary>

```typescript
interface OutlineChanges {
  // Chapter modifications
  updateChapter?: { number: number; title?: string; summary?: string; targetWords?: number; keyEvents?: string[] }[];
  addChapter?: { afterChapter: number; title: string; summary: string; targetWords?: number }[];
  removeChapters?: number[];
  reorderChapters?: number[];
  splitChapter?: { chapter: number; splitAt: string }[];
  mergeChapters?: { chapters: [number, number]; newTitle: string }[];

  // Character modifications
  updateCharacter?: { name: string; changes: Partial<CharacterProfile> }[];
  addCharacter?: CharacterProfile[];
  removeCharacters?: string[];

  // Global modifications
  synopsis?: string;
  themes?: string[];
  targetAudience?: string;
}
```

</details>

<details>
<summary><b>Memory & Continuity Types</b></summary>

```typescript
// Character state tracked across chapters
interface CharacterState {
  name: string;
  lastSeenChapter: number;
  alive: boolean;
  location: string;
  emotionalState: string;
  relationships: Record<string, string>;
  inventory: string[];
  knownInformation: string[];
}

// Timeline events
interface TimelineEvent {
  chapter: number;
  timestamp: string;
  event: string;
  characters: string[];
  location: string;
  significance: 'major' | 'minor' | 'background';
}

// Context assembled for each chapter
interface RelevantContext {
  rollingSummary: string;
  relevantPassages: { text: string; chapter: number; score: number }[];
  characterStates: CharacterState[];
  recentEvents: TimelineEvent[];
  worldContext: string;
  bridgeText: string;
  totalTokens: number;
}
```

</details>

<br />

## Features

### Chapter Generation Pipeline

Each chapter goes through a multi-stage pipeline:

```
Plan → Write → [Expand if short] → Edit → [Rewrite if needed] → Continuity Update
```

- **Planning**: Scene-by-scene breakdown with settings, characters, objectives, conflicts
- **Writing**: Full prose generation with reinforced word count instructions
- **Expand Loop**: Automatically expands short chapters up to 3 times — adds detail, dialogue, and description
- **Editing**: AI editor scores prose, plot, character, pacing, dialogue (1-10 scale)
- **Rewrite**: If editor rejects, chapter is rewritten with specific feedback
- **Continuity**: Rolling summary updated, character states tracked for next chapter

### Refusal Detection

Some AI models refuse to generate long fictional content. LongForm AI automatically detects and handles this:

- **38 refusal patterns** with smart/curly quote normalization
- **Auto-retry** up to 3 times with progressively stronger prompts
- **Full-text scanning** — catches refusals anywhere in the output, not just the beginning
- **Content extraction** — salvages actual prose from mixed refusal/content responses
- **100-word threshold** — discards short refusal fragments instead of building on them
- **Expand fallback** — generates fresh content from the chapter plan when retries fail

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

Real-time cost tracking with per-model pricing for 30+ models:

```typescript
// Check progress and costs during generation
const progress = session.getProgress();
console.log(`Spent: $${progress.totalCost.toFixed(2)}`);
console.log(`Estimated remaining: $${progress.estimatedRemainingCost.toFixed(2)}`);

// Per-chapter cost in results
for await (const result of session.generateAllRemaining()) {
  console.log(`Ch ${result.chapter.number}: $${result.costForChapter.toFixed(2)}`);
}
```

### Session Persistence

Save and resume generation sessions:

```typescript
// Save mid-generation
const sessionId = await session.save();
console.log(`Saved as: ${sessionId}`);

// Resume later (in a new process)
import { BookSession } from 'longform-ai';
const restored = await BookSession.restore(sessionId, config);
const progress = restored.getProgress();
console.log(`Resuming: ${progress.chaptersCompleted}/${progress.totalChapters} chapters done`);

// Continue generating
for await (const result of restored.generateAllRemaining()) {
  console.log(`Ch ${result.chapter.number}: ${result.chapter.wordCount}w`);
}
```

<br />

## Cost Estimates

Approximate costs for a **10-chapter book** (2,000 words/chapter):

| Preset | Provider(s) | Est. Total Cost |
|:-------|:------------|:----------------|
| `budget` | Google Gemini 2.0 Flash | **$0.03 - $0.10** |
| `balanced` | Anthropic + Google + OpenAI | **$2 - $5** |
| `premium` | Anthropic Opus + Sonnet + OpenAI | **$8 - $15** |
| `azure` | Azure OpenAI (gpt-4o) | **$0.50 - $2** |
| DeepSeek only | DeepSeek Chat | **$0.05 - $0.15** |
| Ollama only | Local models | **$0 (free)** |

Costs scale roughly linearly with chapter count. A 25-chapter novel at `balanced` preset costs ~$5-12.

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
│   │       ├── writer.ts           # Chapter prose writing + expand loop
│   │       ├── editor.ts           # Quality scoring & feedback
│   │       └── continuity.ts       # Summary & state management
│   │
│   ├── prompts/                    # Prompt templates per stage
│   ├── providers/                  # AI provider registry & presets
│   ├── schemas/                    # Zod validation schemas
│   ├── memory/                     # Continuity & vector memory
│   ├── context/                    # Token budget management
│   ├── cost/                       # Cost estimation & tracking
│   ├── session/                    # Session persistence (memory-backed)
│   ├── utils/                      # Refusal detection (38 patterns)
│   └── __tests__/                  # 155+ tests across 17 files
│
├── docs/                           # Documentation
│   └── known-issues.md             # Known issues and resolution plans
├── turbo.json                      # Turborepo config
├── pnpm-workspace.yaml             # pnpm workspace
└── package.json                    # Root monorepo config
```

<br />

## Development

```bash
# Clone and install
git clone https://github.com/makieali/longform-ai.git
cd longform-ai
pnpm install

# Build
pnpm build

# Run tests (155+ tests across 17 files)
pnpm test

# Type check
pnpm typecheck

# Run specific package tests
pnpm --filter longform-ai test

# Watch mode
pnpm --filter longform-ai test:watch
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

- [ ] **AI-based refusal detection** — replace regex patterns with a lightweight AI classifier
- [ ] **CLI tool** — `npx longform-ai generate` for command-line book generation
- [ ] **Export formats** — PDF, EPUB, DOCX export
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
