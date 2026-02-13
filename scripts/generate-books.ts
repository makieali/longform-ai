import fs from 'node:fs/promises';
import path from 'node:path';
import { LongFormAI } from '../packages/core/src/index.js';
import type { GenerateOptions, Book, ProgressEvent, ContentType } from '../packages/core/src/types.js';
import { BookExporter } from './book-exporter.js';

// ─── Book Configurations ───────────────────────────────────────────────

interface BookConfig extends GenerateOptions {
  index: number;
  slug: string;
}

const BOOKS: BookConfig[] = [
  {
    index: 1,
    slug: '001-quantum-echoes',
    title: 'Quantum Echoes',
    description:
      'A hard science-fiction novel set in 2187 where a quantum physicist discovers that parallel universes are collapsing into one another. As reality fragments around her, Dr. Lena Vasquez must navigate shifting timelines, unreliable memories, and a conspiracy within the Global Quantum Research Initiative to find a way to stabilize the multiverse before all versions of reality annihilate each other.',
    contentType: 'novel' as ContentType,
    targetWords: 50000,
    chapters: 25,
  },
  {
    index: 2,
    slug: '002-the-cartographer-of-lost-kingdoms',
    title: 'The Cartographer of Lost Kingdoms',
    description:
      'An epic fantasy novel following Eira Nighthollow, a cartographer who discovers that the maps she draws of imaginary lands are actually portals to dying worlds. Each kingdom she maps is on the brink of destruction, and she must journey through her own creations to save civilizations she unknowingly brought into existence. Features intricate world-building, a magic system based on cartography, and a war between the Mapped Realms and the Void.',
    contentType: 'novel' as ContentType,
    targetWords: 55000,
    chapters: 27,
  },
  {
    index: 3,
    slug: '003-the-silence-between-notes',
    title: 'The Silence Between Notes',
    description:
      'A literary mystery novel set in Vienna\'s classical music scene. When renowned pianist Isabelle Morel is found dead in a locked practice room at the Vienna Conservatory, detective Karl Brenner discovers that her final composition contains coded messages pointing to a decades-old scandal. Each chapter reveals a new musical clue, interweaving past and present as Brenner uncovers corruption, forbidden love, and betrayal among the city\'s elite musicians.',
    contentType: 'novel' as ContentType,
    targetWords: 50000,
    chapters: 25,
  },
  {
    index: 4,
    slug: '004-building-production-ai-agents',
    title: 'Building Production AI Agents with LangGraph.js',
    description:
      'A comprehensive technical guide for senior developers building production-grade AI agent systems using LangGraph.js and the Vercel AI SDK. Covers graph architecture, state management, human-in-the-loop patterns, checkpointing, streaming, tool use, multi-agent orchestration, memory systems, evaluation and testing, deployment to production, cost optimization, and real-world case studies. Each chapter includes working code examples, architecture diagrams described in text, and best practices.',
    contentType: 'technical-docs' as ContentType,
    targetWords: 50000,
    chapters: 25,
  },
  {
    index: 5,
    slug: '005-mastering-typescript',
    title: 'Mastering TypeScript: From Intermediate to Expert',
    description:
      'An advanced TypeScript course covering the type system in depth: conditional types, mapped types, template literal types, variance, declaration merging, module augmentation, compiler internals, performance optimization, advanced generics patterns, type-level programming, branded types, the builder pattern, effect systems, and real-world application architecture. Each chapter builds on the previous, with exercises, quizzes, and project-based learning.',
    contentType: 'course' as ContentType,
    targetWords: 50000,
    chapters: 25,
  },
  {
    index: 6,
    slug: '006-the-bookshop-on-rue-de-rivoli',
    title: 'The Bookshop on Rue de Rivoli',
    description:
      'A sweeping romance novel set across two timelines. In 1942 Paris, resistance fighter Marguerite Delacroix uses her bookshop as a safe house, falling in love with a British intelligence officer. In 2024, her granddaughter Claire inherits the shop and discovers hidden letters that reveal a love story intertwined with espionage, sacrifice, and an unsolved mystery about a missing painting. The parallel narratives converge as Claire uncovers the truth about her grandmother\'s wartime choices.',
    contentType: 'novel' as ContentType,
    targetWords: 50000,
    chapters: 25,
  },
  {
    index: 7,
    slug: '007-meridian',
    title: 'Meridian',
    description:
      'A science-fiction screenplay novelization following Commander Aisha Torres and her crew aboard the deep-space vessel Meridian as they investigate a mysterious signal from beyond the Oort Cloud. What begins as a first-contact mission becomes a psychological thriller when they discover the signal is coming from a future version of their own ship. Explores themes of determinism, sacrifice, and what it means to be human. Written in a cinematic style with vivid scene descriptions and sharp dialogue.',
    contentType: 'screenplay' as ContentType,
    targetWords: 50000,
    chapters: 25,
  },
  {
    index: 8,
    slug: '008-the-architecture-of-memory',
    title: 'The Architecture of Memory',
    description:
      'A comprehensive research paper / academic monograph on the neuroscience and computer science of memory systems. Covers biological memory (hippocampal formation, synaptic plasticity, memory consolidation), computational models (Hopfield networks, transformers as associative memory, vector databases), AI memory architectures (RAG, episodic memory for agents, working memory in LLMs), philosophical implications (personal identity, false memories, digital immortality), and future directions. Includes literature reviews, methodology discussions, and cross-disciplinary synthesis.',
    contentType: 'research-paper' as ContentType,
    targetWords: 50000,
    chapters: 25,
  },
  {
    index: 9,
    slug: '009-the-attention-economy',
    title: 'The Attention Economy',
    description:
      'A marketing strategy book analyzing how brands capture, retain, and monetize attention in the age of AI, short-form video, and infinite content. Covers attention metrics, the psychology of engagement, content strategy for the AI era, brand storytelling, community building, influencer dynamics, algorithmic amplification, ethical marketing, case studies from companies like Duolingo and Liquid Death, and a framework for building an attention-first marketing strategy. Written in an engaging, accessible style with actionable takeaways per chapter.',
    contentType: 'marketing' as ContentType,
    targetWords: 50000,
    chapters: 25,
  },
  {
    index: 10,
    slug: '010-the-weight-of-light',
    title: 'The Weight of Light',
    description:
      'A literary fiction novel following three interconnected storylines across a single year. A retired astrophysicist in rural Ireland confronts dementia while trying to complete her life\'s work. Her estranged son, a war photographer in Kyiv, grapples with moral injury and the ethics of documenting suffering. Her granddaughter, a marine biologist in Okinawa, discovers a bioluminescent organism that could revolutionize medicine but faces a choice between scientific ambition and ecological preservation. Themes: legacy, the burden of knowledge, the connections between cosmic and personal scales.',
    contentType: 'novel' as ContentType,
    targetWords: 55000,
    chapters: 27,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(msg: string): void {
  console.log(`[${timestamp()}] ${msg}`);
}

// ─── Main Runner ────────────────────────────────────────────────────────

interface BookResult {
  index: number;
  slug: string;
  title: string;
  success: boolean;
  totalWords?: number;
  totalCost?: number;
  totalChapters?: number;
  durationMs?: number;
  exports?: { format: string; filePath: string; sizeBytes: number }[];
  error?: string;
}

async function main() {
  const OUTPUT_DIR = '/Users/muhammadali/Desktop/opensource-contribution/book-outputs';

  log('=== LongForm AI — 10-Book Generation ===');
  log(`Output directory: ${OUTPUT_DIR}`);
  log(`Books to generate: ${BOOKS.length}`);
  log('');

  // Validate environment
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-5.1-chat';

  if (!apiKey || !endpoint) {
    console.error('ERROR: Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT environment variables.');
    process.exit(1);
  }

  log(`Azure endpoint: ${endpoint}`);
  log(`Azure deployment: ${deployment}`);
  log('');

  const results: BookResult[] = [];
  const startTime = Date.now();

  const MAX_RETRIES = 3;

  for (const bookConfig of BOOKS) {
    const bookStart = Date.now();
    const bookDir = path.join(OUTPUT_DIR, bookConfig.slug);
    log(`━━━ [${bookConfig.index}/${BOOKS.length}] Starting: "${bookConfig.title}" ━━━`);
    log(`  Type: ${bookConfig.contentType}, Target: ${bookConfig.targetWords} words, Chapters: ${bookConfig.chapters}`);

    let bookSuccess = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 1) {
        const waitSec = attempt * 30;
        log(`  Retry ${attempt}/${MAX_RETRIES} after ${waitSec}s cooldown...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
      }

      try {
        // Fresh instance per attempt (memory checkpointer resets)
        const freshAI = new LongFormAI({
          providers: {
            azure: { apiKey, endpoint },
          },
          preset: 'azure',
          models: {
            outline: { provider: 'azure', model: deployment, temperature: 0.7, maxTokens: 8192 },
            planning: { provider: 'azure', model: deployment, temperature: 0.7, maxTokens: 4096 },
            writing: { provider: 'azure', model: deployment, temperature: 0.8, maxTokens: 16384 },
            editing: { provider: 'azure', model: deployment, temperature: 0.3, maxTokens: 4096 },
            continuity: { provider: 'azure', model: deployment, temperature: 0.3, maxTokens: 4096 },
          },
          checkpointer: 'memory',
        });

        const generator = freshAI.generate({
          title: bookConfig.title,
          description: bookConfig.description,
          contentType: bookConfig.contentType,
          targetWords: bookConfig.targetWords,
          chapters: bookConfig.chapters,
          maxEditCycles: 2,
          humanReview: false,
        });

        let book: Book | undefined;

        while (true) {
          const result = await generator.next();
          if (result.done) {
            book = result.value;
            break;
          }
          logProgressEvent(bookConfig.index, result.value);
        }

        if (!book) {
          throw new Error('Generator finished without returning a Book');
        }

        const durationMs = Date.now() - bookStart;
        log(`  Generation complete: ${book.totalWords} words, ${book.chapters.length} chapters, $${book.totalCost.toFixed(4)}, ${formatDuration(durationMs)}`);

        // Export to all formats
        log('  Exporting to all formats...');
        const exporter = new BookExporter(book);
        const exports = await exporter.exportAll(bookDir);

        for (const exp of exports) {
          log(`    ${exp.format.toUpperCase()}: ${formatBytes(exp.sizeBytes)} → ${path.basename(exp.filePath)}`);
        }

        results.push({
          index: bookConfig.index,
          slug: bookConfig.slug,
          title: bookConfig.title,
          success: true,
          totalWords: book.totalWords,
          totalCost: book.totalCost,
          totalChapters: book.chapters.length,
          durationMs,
          exports: exports.map(e => ({
            format: e.format,
            filePath: path.relative(OUTPUT_DIR, e.filePath),
            sizeBytes: e.sizeBytes,
          })),
        });

        log(`  Done: "${bookConfig.title}" in ${formatDuration(durationMs)}`);
        bookSuccess = true;
        break; // Success — exit retry loop
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`  Attempt ${attempt}/${MAX_RETRIES} FAILED: ${message}`);

        if (attempt === MAX_RETRIES) {
          const durationMs = Date.now() - bookStart;
          log(`  ALL RETRIES EXHAUSTED for "${bookConfig.title}"`);

          await fs.mkdir(bookDir, { recursive: true });
          await fs.writeFile(
            path.join(bookDir, 'error.json'),
            JSON.stringify(
              {
                title: bookConfig.title,
                error: message,
                stack: err instanceof Error ? err.stack : undefined,
                attempts: MAX_RETRIES,
                durationMs,
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            ),
          );

          results.push({
            index: bookConfig.index,
            slug: bookConfig.slug,
            title: bookConfig.title,
            success: false,
            durationMs,
            error: message,
          });
        }
      }
    }

    log('');
  }

  // Write summary
  const totalDuration = Date.now() - startTime;
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  const summary = {
    generatedAt: new Date().toISOString(),
    totalDurationMs: totalDuration,
    totalDuration: formatDuration(totalDuration),
    booksAttempted: BOOKS.length,
    booksSucceeded: successful.length,
    booksFailed: failed.length,
    totalWords: successful.reduce((sum, r) => sum + (r.totalWords ?? 0), 0),
    totalCost: Number(successful.reduce((sum, r) => sum + (r.totalCost ?? 0), 0).toFixed(4)),
    totalExportFiles: successful.reduce((sum, r) => sum + (r.exports?.length ?? 0), 0),
    books: results,
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const summaryPath = path.join(OUTPUT_DIR, 'summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  log('═══════════════════════════════════════════════');
  log('GENERATION COMPLETE');
  log(`  Books: ${successful.length}/${BOOKS.length} succeeded`);
  log(`  Total words: ${summary.totalWords.toLocaleString()}`);
  log(`  Total cost: $${summary.totalCost.toFixed(2)}`);
  log(`  Total time: ${formatDuration(totalDuration)}`);
  log(`  Summary: ${summaryPath}`);
  log('═══════════════════════════════════════════════');
}

function logProgressEvent(bookIndex: number, event: ProgressEvent): void {
  switch (event.type) {
    case 'outline_complete':
      log(`  [${bookIndex}] Outline complete: ${event.outline.chapters.length} chapters planned`);
      break;
    case 'chapter_started':
      log(`  [${bookIndex}] Chapter ${event.chapter} started: "${event.title}"`);
      break;
    case 'chapter_written':
      log(`  [${bookIndex}] Chapter ${event.chapter} written: ${event.wordCount} words`);
      break;
    case 'edit_cycle':
      log(`  [${bookIndex}] Chapter ${event.chapter} edit cycle ${event.cycle}: ${event.approved ? 'APPROVED' : 'needs revision'} (overall: ${event.scores.overall}/10)`);
      break;
    case 'chapter_complete':
      log(`  [${bookIndex}] Chapter ${event.chapter} complete: "${event.title}" (${event.wordCount} words)`);
      break;
    case 'cost_update':
      log(`  [${bookIndex}] Cost update: $${event.totalCost.toFixed(4)} (${event.step})`);
      break;
    case 'error':
      log(`  [${bookIndex}] ERROR: ${event.message} (recoverable: ${event.recoverable})`);
      break;
    case 'generation_complete':
      // Handled in main loop
      break;
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
