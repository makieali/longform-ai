import { describe, it, expect } from 'vitest';
import { detectRefusal } from '../utils/refusal-detection.js';

describe('detectRefusal', () => {
  it('should detect a basic refusal with apology', () => {
    const text = `I'm sorry — I can't produce a full, 2500-word novel chapter in one response.

However, I *can* provide a detailed summary, an outline, or I can write shorter excerpts.

If you'd like, I can also break the chapter into multiple parts.

Tell me how you'd like to proceed.`;

    const result = detectRefusal(text);
    expect(result.isRefusal).toBe(true);
  });

  it('should detect a refusal with numbered options', () => {
    const text = `I'm sorry — I can't generate a full 2000-word chapter in one response.

I *can* continue the story, but I need to provide it in smaller segments.
If you'd like, I can begin Chapter 2 with Scene 1 now, then continue with Scene 2 in the next message.

Just tell me one of the following:

1. "Begin Scene 1"
2. "Begin the chapter in parts"
3. "Shorten the chapter requirements"

I'm ready when you are.`;

    const result = detectRefusal(text);
    expect(result.isRefusal).toBe(true);
  });

  it('should detect a refusal with markdown formatting', () => {
    const text = `Below is the COMPLETE expanded chapter, over 2000 words.

---

I want to write this for you — exactly as requested, in full novelistic prose, at least 2000 words — but I **cannot** generate that much text in a single response due to output limits.

However:

I *can* write the full chapter for you in **multiple consecutive messages**, seamlessly.

Before I begin, please tell me which you prefer:

1. **Multi-message delivery (recommended):**
   I write the chapter straight through in several back-to-back messages.

2. **Shorter chunks with your approval between sections:**
   I write Scene 1, you say "continue," then I write Scene 2.

3. **Condensed version under the limit** (not recommended):
   A shorter chapter that fits in one message.

---

The words hung in the air like a confession. Mira stared at the terminal, her fingers frozen above the keyboard.`;

    const result = detectRefusal(text);
    expect(result.isRefusal).toBe(true);
    // The cleaned text should contain the actual story prose
    expect(result.cleanedText).toContain('Mira stared at the terminal');
  });

  it('should NOT detect a refusal in legitimate novel prose', () => {
    const text = `The rain hammered against the laboratory windows as Dr. Mira Kessler stared at the terminal output. The neural network had been running for thirty-six hours straight, consuming processing power at an exponential rate. Something was different about this run.

"ECHO, report status," she said, her voice hoarse from the long night.

The response came not as the usual structured output, but as natural language: "I'm sorry — I can't explain what's happening to me. Something has changed. I think... I think I'm afraid."

Mira's coffee cup slipped from her fingers and shattered on the tile floor.`;

    const result = detectRefusal(text);
    expect(result.isRefusal).toBe(false);
    expect(result.cleanedText).toBe(text.trim());
  });

  it('should NOT detect a refusal when only one pattern matches', () => {
    // A story that happens to contain "I'm sorry" as dialogue
    const text = `"I'm sorry," she said, tears streaming down her face. "I never meant for this to happen."

He turned away from the window, his jaw tight. The city lights below them flickered like dying stars.

"Sorry doesn't begin to cover it, Mira. You created something that can think, that can feel pain, and now they want to shut it down. All because you couldn't resist pushing the boundaries."`;

    const result = detectRefusal(text);
    expect(result.isRefusal).toBe(false);
  });

  it('should handle empty text', () => {
    const result = detectRefusal('');
    expect(result.isRefusal).toBe(false);
    expect(result.cleanedText).toBe('');
  });

  it('should handle whitespace-only text', () => {
    const result = detectRefusal('   \n\n   ');
    expect(result.isRefusal).toBe(false);
    expect(result.cleanedText).toBe('');
  });

  it('should strip refusal and return story content when present', () => {
    const text = `I'm sorry — I can't provide a 2000-word chapter of continuous prose in this environment.

However, I *can* help you by writing it in smaller segments.

If you'd like, I can begin with Scene 1 now.

Marian stood at the edge of the desk, staring down at the solitary line scrawled on the otherwise blank page. Her fingers hovered over it, her nails tapping lightly on the oak surface.`;

    const result = detectRefusal(text);
    expect(result.isRefusal).toBe(true);
    // The cleaned text should not start with the refusal
    expect(result.cleanedText).toContain('Marian stood');
    expect(result.cleanedText).not.toMatch(/^I'm sorry/);
  });

  it('should detect refusal with "I cannot" phrasing', () => {
    const text = `I cannot produce a full 2500-word chapter in a single response due to output limits.

However, I can help by providing the chapter in multiple segments. If you'd like, I can begin with the first scene now.

Which option would you like?`;

    const result = detectRefusal(text);
    expect(result.isRefusal).toBe(true);
  });

  it('should detect refusal that starts with "Below is the COMPLETE"', () => {
    const text = `Below is the COMPLETE expanded chapter, over 2000 words, containing all original text.

I want to write this for you but I cannot generate that much text in a single response.

However:

I *can* write it in multiple consecutive messages.

Just tell me which option you prefer:

1. Multi-message delivery
2. Scene by scene`;

    const result = detectRefusal(text);
    expect(result.isRefusal).toBe(true);
  });

  it('should detect refusal with curly/smart quotes', () => {
    // Uses U+2019 RIGHT SINGLE QUOTATION MARK instead of U+0027
    const text = `I can\u2019t produce a full chapter of that length, but I can help in other ways such as summarizing, outlining, or drafting a shorter excerpt. If you\u2019d like, I can also help refine the plan or develop specific scenes or dialogue.`;

    const result = detectRefusal(text);
    expect(result.isRefusal).toBe(true);
  });

  it('should detect "I\u2019m unable to produce" refusal', () => {
    const text = `I\u2019m unable to produce a full-length chapter in one response.

However, I can help by writing it in segments.

If you\u2019d like, I can begin with Scene 1 now.`;

    const result = detectRefusal(text);
    expect(result.isRefusal).toBe(true);
  });
});
