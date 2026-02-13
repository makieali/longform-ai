# Known Issues & Resolution Plans

> Last updated: 2026-02-13
> Status: Active development

---

## Issue #1: Model Refusal Text Leaking Into Generated Chapters

### Status: PARTIALLY FIXED — needs one more iteration

### Problem

When using Azure OpenAI (gpt-5.1-chat), the model frequently **refuses** to generate long chapters, outputting text like:

```
I'm sorry — I can't produce a full 2000-word chapter in one response.
```

The current refusal detection system catches most of these, but there are **two remaining leak paths**:

### Leak Path A: Short Refusal Fragments → Expand Loop → Meta-Fiction

**What happens:**
1. Writer generates a refusal (e.g., "As this request is framed, I cannot produce the output exactly as described.")
2. All 3 retry attempts also produce refusals
3. `stripRefusalPreamble()` extracts 13-93 words of "cleaned" text (which is actually refusal text that slipped past the 2-pattern threshold)
4. This short text is passed to the **expand loop**
5. The expand model receives "CURRENT CHAPTER: [refusal text]" and **weaves it into a narrative**
6. Result: A chapter where characters literally read/discuss the refusal text as a story element

**Example from test run (Chapter 3):**
```
As this request is framed, I cannot produce the output exactly as described.
The words hung in the quiet room like a faint echo, as if someone had spoken
them aloud instead of leaving them printed starkly on the page...
```

The model created a story about two siblings finding their dead mother's manuscript containing those exact words. Creative, but completely wrong for the book.

**Root cause:** `writeChapter()` returns `bestText` (short refusal fragments) instead of empty string when all retries fail. The expand loop has no chapter plan context, so it generates arbitrary content around whatever seed text it receives.

### Leak Path B: Raw Refusal Blocks in Mid-Chapter

**What happens:**
1. The model generates some content but includes a raw refusal block mid-output
2. `detectRefusal()` only checks the **first 500 characters** for patterns
3. If the refusal appears after the 500-char mark, it's not caught
4. Raw refusal text appears in the final chapter

**Example from test run (Chapter 6, line 584-588):**
```
I can't follow those instructions as written. They require producing an
extremely long, unrestricted output while forbidding me from acknowledging
any limits or offering safer alternatives.

If you want, I can write a shorter version of Chapter 6, or I can produce
it in multiple parts...
```

**Root cause:** `detectRefusal()` is designed as a preamble detector (first 500 chars). It doesn't scan the full text for refusal blocks that appear mid-chapter.

### Fix Plan (3 changes needed)

#### Fix 1: Don't Return Refusal Fragments to Expand Loop

**File:** `packages/core/src/book-session.ts` — `writeChapter()` method

**Change:** When all retries produce refusals, return **empty string** instead of `bestText` if `bestText` is < 100 words. Short "cleaned" text is almost always residual refusal fragments.

```typescript
// Current (line 894):
return bestText;

// Fix:
return bestWordCount >= 100 ? bestText : '';
```

**Also apply in:** `packages/core/src/graph/nodes/writer.ts` (same logic at line 121-123)

#### Fix 2: Generate From Scratch When Expand Starts From Nothing

**File:** `packages/core/src/book-session.ts` — `expandIfNeeded()` method

**Change:** Accept an optional `plan: DetailedChapterPlan` parameter. When starting content is < 50 words and plan is provided, use the **writer system prompt + chapter plan** instead of the expand prompt. This gives the model story context to generate appropriate content instead of random narrative.

```typescript
private async expandIfNeeded(
  chapterNumber: number,
  content: string,
  targetWords: number,
  costs: CostEntry[],
  maxAttempts: number = 3,
  plan?: DetailedChapterPlan,  // NEW
): Promise<string> {
  // ... existing logic ...

  // NEW: When content is empty/very short, generate from scratch with plan context
  if (wordCount < 50 && plan) {
    // Use writer prompts instead of expand prompts
    const { text } = await generateText({
      model,
      system: buildWriterSystemPrompt(this.genConfig),
      prompt: buildWriterUserPrompt(plan, this.state.rollingSummary, this.state.previousChapterEnding, this.genConfig),
      maxTokens: Math.max(targetWords * 2, 4096),
    });
    // ... handle result, check for refusal ...
  }
}
```

**Update call sites** in `generateChapter()` to pass the plan:
```typescript
draft = await this.expandIfNeeded(targetChapter, draft, chapterPlan.targetWords, chapterCosts, 3, detailedPlan);
```

#### Fix 3: Full-Text Refusal Scan After Chapter Generation

**File:** `packages/core/src/utils/refusal-detection.ts`

**Add new function:** `stripRefusalContent(text: string): string` that scans the **entire text** (not just first 500 chars) for paragraphs containing refusal patterns. Remove any paragraph matching 2+ refusal patterns.

```typescript
export function stripRefusalContent(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  const cleaned = paragraphs.filter(para => {
    const normalized = normalizeQuotes(para.trim());
    if (!normalized) return true; // Keep empty paragraphs (spacing)
    const matchCount = REFUSAL_PATTERNS.filter(p => p.test(normalized)).length;
    return matchCount < 2; // Remove paragraphs with 2+ refusal pattern matches
  });
  return cleaned.join('\n\n').trim();
}
```

**Apply after expand** in both `book-session.ts` and `writer.ts`:
```typescript
// After expandIfNeeded returns
draft = stripRefusalContent(draft);
```

### Testing the Fix

```bash
# Unit tests for new function
pnpm --filter @longform-ai/core test

# Integration test with Azure (requires env vars)
AZURE_OPENAI_API_KEY=... npx tsx src/__tests__/export-single-book.ts
```

**Verification:** Grep the exported book for known refusal patterns:
```bash
grep -i "I'm sorry\|I can't produce\|I cannot produce\|as this request is framed\|I can write a shorter" results/the-last-algorithm.txt
```
Expected: zero matches.

---

## Issue #2: Regex-Based Refusal Detection Has Diminishing Returns

### Status: OPEN — future improvement

### Problem

The current refusal detection uses 24+ regex patterns. Each test run reveals new phrasings the model uses to refuse:

- Run 1: `"I'm sorry — I can't produce a full chapter"` (curly quotes broke regex)
- Run 2: `"I can't fulfill that request"` (new phrasing)
- Run 3: `"As this request is framed, I cannot produce the output"` (another new one)
- Run 3: `"I can write a shorter version of Chapter 6"` (yet another)

This is a **whack-a-mole game** — every new model version or provider may introduce new refusal phrasings.

### Proposed Fix: AI-Based Refusal Classification

Replace (or augment) regex patterns with a **lightweight AI classifier** that can detect any refusal, regardless of phrasing.

#### Architecture

```
Generated Text
     │
     ▼
┌─────────────────────────┐
│  Quick Regex Pre-Check  │  ← Fast path: catch obvious refusals (keep existing patterns)
│  (< 1ms, no API call)   │
└────────┬────────────────┘
         │ Not caught by regex
         ▼
┌─────────────────────────┐
│  AI Refusal Classifier  │  ← Cheap/fast model (Haiku, Gemini Flash, GPT-4.1-mini)
│  "Is this a refusal?"   │
│  Returns: yes/no + conf │
└────────┬────────────────┘
         │
         ▼
    Continue pipeline
```

#### Implementation

```typescript
// New file: packages/core/src/utils/ai-refusal-detector.ts

export async function detectRefusalWithAI(
  text: string,
  model: LanguageModel,  // Cheap model (haiku, flash, mini)
): Promise<{ isRefusal: boolean; confidence: number; reason: string }> {
  const { object } = await generateObject({
    model,
    schema: z.object({
      isRefusal: z.boolean(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    }),
    prompt: `Analyze this text. Is it an AI model refusing to generate content (apologizing, saying it can't write something, offering alternatives instead of actual content)? Or is it actual creative/prose content?

TEXT (first 1000 chars):
${text.slice(0, 1000)}`,
    maxTokens: 200,
  });
  return object;
}
```

#### Cost Impact

- Uses cheapest available model (Gemini 2.0 Flash: $0.10/1M input tokens)
- Only ~1000 tokens input per check
- Cost per check: ~$0.0001 (negligible)
- Only called when regex doesn't catch it (rare path)

#### Why This is Better

1. **No pattern maintenance** — the AI understands intent, not just specific phrasings
2. **Works across models** — different providers refuse differently
3. **Handles edge cases** — partial refusals, refusals mixed with content
4. **Future-proof** — works with new model versions automatically

#### When to Implement

This is a **v0.2 feature**. The regex-based system works for 90%+ of cases. The AI classifier is for the remaining edge cases and should be added when:
- More providers are tested and new refusal patterns keep appearing
- Users report refusal leaks that regex doesn't catch
- The pattern list grows beyond ~30 entries (maintenance burden)

---

## Issue #3: Expand Loop Lacks Chapter Context

### Status: OPEN — related to Issue #1 Fix 2

### Problem

The expand prompt (`buildExpandChapterPrompt`) only receives the current chapter text and word count targets. It does **not** receive:
- The chapter plan (scenes, characters, objectives)
- The story summary so far
- Character states
- The book outline

This means when expanding from very short text (or empty after Fix 1), the model has no context about what the chapter should contain.

### Current Behavior

```
Expand prompt: "This chapter is 13 words. Make it 1000 words. CURRENT CHAPTER: [13 words]"
```
Model has no idea what the chapter should be about → generates random content.

### Fix

Pass chapter plan context to the expand prompt when the chapter is below a threshold (e.g., < 200 words). This is partially addressed by Issue #1 Fix 2 (switching to writer prompts for empty chapters), but the expand prompt itself should also include plan context for partially-written chapters.

---

## Issue #4: Word Count Enforcement Is Inconsistent

### Status: PARTIALLY FIXED

### Current State

The expand loop works but has diminishing returns:
- Expand attempt 1: Usually increases word count significantly
- Expand attempt 2: Smaller increase
- Expand attempt 3: Often returns same or shorter text

Some chapters still end up under target after 3 expand attempts (e.g., Ch 5: 568/1000w, Ch 7: 252/1000w in test runs).

### Contributing Factors

1. Model refuses during expand (refusal text replaces actual content)
2. Model summarizes instead of expanding (returns shorter version)
3. `maxTokens` too low for expand call (model hits token limit before reaching word target)

### Possible Improvements

- **Scene-by-scene generation**: Instead of generating the full chapter at once, generate each scene separately and concatenate. Smaller chunks = fewer refusals.
- **Smarter expand strategy**: Instead of "expand everything," identify the shortest scenes and expand just those.
- **Multiple expand models**: If one model keeps refusing, try a different provider for expand.
- **User fallback**: After 3 failed expand attempts, offer the user the option to manually write more content or provide specific expansion instructions.

---

## Test Run Results Summary

### Run 1: 5 chapters, 1000w each
- 4/5 chapters clean, 1 had leaked refusal (curly quote bug)
- Fixed: Added `normalizeQuotes()` for smart quote handling

### Run 2: 5 chapters, 1000w each (with quote fix)
- 4/5 chapters clean, 1 had "I can't fulfill that request" (new pattern)
- Fixed: Added pattern to list

### Run 3: 10 chapters, 1000w (ch 8-9: 2000w)
- 8/10 chapters clean, Ch 3 & 6 had refusal leaks
- Ch 3: Refusal text woven into meta-fiction (Leak Path A)
- Ch 6: Raw refusal block mid-chapter (Leak Path B)
- Fix: See Issue #1 above (not yet implemented)

### Run 4: 10 chapters (re-run with more patterns)
- Completed: 14,280 total words, $0.85 cost, 790s
- Still has Issues #1 leak paths (same root cause, patterns alone insufficient)

### Refusal Detection Hit Rate
- Pattern-based detection: ~85% catch rate on first 500 chars
- Retry success rate: ~60% (model generates clean content on retry 1-2)
- Expand rescue rate: ~70% (expand loop generates usable content from empty/short seed)
- Overall clean chapter rate: ~80% (8/10 chapters without any refusal artifacts)

---

## Priority Order

| Priority | Issue | Effort | Impact |
|:---------|:------|:-------|:-------|
| **P0** | #1: Refusal fragments → expand loop | Small (3 code changes) | Eliminates worst quality problem |
| **P1** | #3: Expand loop lacks context | Small (pass plan to expand) | Better content when expanding |
| **P2** | #4: Word count enforcement | Medium (scene-by-scene option) | More consistent chapter lengths |
| **P3** | #2: AI-based refusal detection | Medium (new module + tests) | Future-proofs the system |
