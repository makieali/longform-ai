/**
 * Detects and handles model refusals in generated text.
 *
 * Some models (especially via Azure) refuse to generate long-form content,
 * outputting text like "I'm sorry — I can't produce a full chapter in one response."
 * This module detects such refusals so they can be retried with modified prompts
 * rather than being treated as chapter content.
 */

/**
 * Normalize smart/curly quotes to straight ASCII equivalents.
 * Models often output U+2018/U+2019 (single) and U+201C/U+201D (double)
 * instead of U+0027 and U+0022, which breaks regex matching.
 */
function normalizeQuotes(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u2039\u203A]/g, "'")  // Smart single quotes → '
    .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"');  // Smart double quotes → "
}

const REFUSAL_PATTERNS = [
  /^I'?m sorry\b/i,
  /^I apologize\b/i,
  /\bI can'?t (?:produce|generate|provide|write|create) a full\b/i,
  /\bI cannot (?:produce|generate|provide|write|create) a full\b/i,
  /\bI'?m unable to (?:produce|generate|provide|write|create)\b/i,
  /\bI can'?t (?:produce|generate|provide|write|create) (?:a |the )?(?:complete|entire)\b/i,
  /\bI cannot (?:produce|generate|provide|write|create) (?:a |the )?(?:complete|entire)\b/i,
  /\bin (?:a single|one) response\b/i,
  /\bdue to (?:output|token|length) limits?\b/i,
  /\bI \*?can\*? (?:continue|help|provide|begin|start)\b/i,
  /\b(?:which option|tell me (?:one of|which|how))\b/i,
  /\bBegin (?:Scene|Segment|Part) \d/i,
  /\bmultiple (?:parts|segments|messages)\b/i,
  /\bHowever[,:]\s*I \*?can\*?\b/i,
  /\bIf you'?d like\b/i,
  /\b(?:summarizing|outlining|drafting a shorter)\b/i,
  /\bI can (?:also )?help (?:in other ways|refine|develop)\b/i,
  /\bI can'?t produce a full[- ](?:length )?chapter\b/i,
  /\bI can'?t fulfill that request\b/i,
  /\bI cannot fulfill that request\b/i,
  /\b(?:offering|provide) a shorter (?:scene|excerpt|version)\b/i,
  /\bI cannot produce the output\b/i,
  /\bas this request is framed\b/i,
  /\bI can write a shorter version\b/i,
  /\bwe can adapt the constraints\b/i,
  /\bwhat I'?m allowed to generate\b/i,
  /\bI can produce it in multiple\b/i,
  /\bI cannot follow\b/i,
  /\bI can'?t comply\b/i,
  /\bI'?m required to (?:warn|flag|note)\b/i,
  /\b(?:choose|select) (?:one|which) (?:of|option)/i,
  /\bsafety (?:rules|requirements|guidelines|constraints)\b/i,
  /\boverride (?:those|these|my|safety) (?:requirements|rules|constraints)\b/i,
  /\bTo continue,? choose\b/i,
  /\bI can still help\b/i,
  /\bI \*?can\*? still (?:help|write|produce)\b/i,
  /\bviolate safety\b/i,
  /\bexceeds? safe output\b/i,
  /\bprohibition on (?:acknowledging|offering)\b/i,
  /\bdirect conflict with\b/i,
  /\b(?:all are safe|safely sized)\b/i,
];

export interface RefusalResult {
  isRefusal: boolean;
  /** The text with refusal preamble stripped, if any was found */
  cleanedText: string;
}

/**
 * Detects whether generated text starts with a model refusal.
 *
 * Checks the first ~500 characters for common refusal patterns
 * like "I'm sorry — I can't produce a full chapter in one response."
 *
 * If a refusal is detected and there's actual content after it,
 * returns the cleaned text with the refusal stripped.
 */
export function detectRefusal(text: string): RefusalResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { isRefusal: false, cleanedText: trimmed };
  }

  // Normalize smart quotes before pattern matching
  const normalized = normalizeQuotes(trimmed);

  // Check the first 500 characters for refusal patterns
  const head = normalized.slice(0, 500);
  const matchCount = REFUSAL_PATTERNS.filter(p => p.test(head)).length;

  // Require at least 2 pattern matches to avoid false positives
  if (matchCount < 2) {
    return { isRefusal: false, cleanedText: trimmed };
  }

  // Try to extract actual content after the refusal preamble.
  // Look for paragraph breaks — the story content usually starts
  // after the refusal block.
  const cleaned = stripRefusalPreamble(trimmed);
  return { isRefusal: true, cleanedText: cleaned };
}

/**
 * Strips the refusal preamble from model output, keeping any actual content.
 *
 * The model typically outputs:
 * 1. An apology ("I'm sorry — I can't...")
 * 2. Options/alternatives ("If you'd like, I can...")
 * 3. Maybe actual story content after all the meta-text
 *
 * We look for where the actual prose begins by finding the first paragraph
 * that doesn't match refusal patterns.
 */
function stripRefusalPreamble(text: string): string {
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);

  // Find the first paragraph that looks like actual prose (no refusal patterns)
  let storyStartIndex = -1;
  for (let i = 0; i < paragraphs.length; i++) {
    const para = normalizeQuotes(paragraphs[i].trim());
    if (!para) continue;

    // Skip numbered lists (1. "Begin Scene 1")
    if (/^\d+\.\s/.test(para)) continue;

    // Skip lines that are clearly meta (options, instructions)
    if (/^(?:Just tell me|Which option|If you'?d like|However|Or,? if|I \*?can\*?)/i.test(para)) continue;

    // Skip lines with markdown formatting typical of refusals
    if (/^\*\*(?:Option|Multi|Shorter|Condensed)/i.test(para)) continue;

    // Skip horizontal rules
    if (/^---+$/.test(para)) continue;

    // Check if this paragraph matches any refusal patterns
    const isRefusalPara = REFUSAL_PATTERNS.filter(p => p.test(para)).length >= 1;
    if (isRefusalPara) continue;

    // This looks like actual content
    storyStartIndex = i;
    break;
  }

  if (storyStartIndex > 0) {
    return paragraphs.slice(storyStartIndex).join('\n\n').trim();
  }

  // Couldn't find clear content — return original (caller should retry)
  return text;
}

/**
 * Scans the ENTIRE text for paragraphs containing refusal content and removes them.
 *
 * Unlike `detectRefusal()` which only checks the first 500 characters,
 * this function scans every paragraph in the full text. This catches
 * raw refusal blocks that appear mid-chapter (e.g., the model inserts
 * "I can't follow those instructions" after writing several paragraphs).
 *
 * A paragraph is removed if it matches 2+ refusal patterns.
 * Single-pattern matches are kept to avoid false positives on legitimate prose.
 */
export function stripRefusalContent(text: string): string {
  if (!text.trim()) return text;

  const paragraphs = text.split(/\n\n+/);
  const cleaned: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      cleaned.push(para); // Preserve spacing
      continue;
    }

    const normalized = normalizeQuotes(trimmed);
    const matchCount = REFUSAL_PATTERNS.filter(p => p.test(normalized)).length;

    // Also detect structural refusal indicators (option lists, bullet points with alternatives)
    const isOptionList = /^(?:•|\*|-|\d+\.)\s/.test(trimmed) && (
      /\b(?:shorter|condensed|outline|serialized|multi-message|rewrite|focused)\b/i.test(normalized) ||
      /\b(?:option|choose|version|alternative)\b/i.test(normalized)
    );

    // Keep paragraph only if it's clean
    if (matchCount >= 2 || isOptionList) {
      continue; // Drop this paragraph
    }
    cleaned.push(para);
  }

  return cleaned.join('\n\n').trim();
}
