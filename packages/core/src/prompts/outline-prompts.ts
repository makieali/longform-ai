import type { GenerationConfig, ContentType } from '../types.js';

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  'novel': 'novel',
  'technical-docs': 'technical documentation',
  'course': 'educational course',
  'screenplay': 'screenplay',
  'research-paper': 'research paper',
  'marketing': 'marketing content',
  'legal': 'legal document',
  'sop': 'standard operating procedure',
};

const CONTENT_TYPE_SECTION_NAMES: Record<ContentType, string> = {
  'novel': 'chapters',
  'technical-docs': 'sections',
  'course': 'modules',
  'screenplay': 'acts',
  'research-paper': 'sections',
  'marketing': 'sections',
  'legal': 'sections',
  'sop': 'sections',
};

export function buildOutlineSystemPrompt(config: GenerationConfig): string {
  const contentLabel = CONTENT_TYPE_LABELS[config.contentType];
  const sectionName = CONTENT_TYPE_SECTION_NAMES[config.contentType];

  let roleDescription: string;
  let qualityGuidelines: string;

  if (config.contentType === 'novel') {
    roleDescription = `You are a master storyteller and literary architect. You craft compelling narratives with rich character development, thematic depth, and satisfying story arcs.`;
    qualityGuidelines = `
- Create multi-dimensional characters with clear motivations and arcs
- Weave themes organically through the narrative
- Balance action, dialogue, and introspection
- Plan rising tension and satisfying resolution
- Consider pacing — vary chapter lengths for rhythm
- Ensure each chapter has a clear purpose advancing the story`;
  } else if (config.contentType === 'technical-docs') {
    roleDescription = `You are an expert technical writer. You create clear, comprehensive, and well-organized documentation that serves both beginners and experienced users.`;
    qualityGuidelines = `
- Organize content from fundamentals to advanced topics
- Include practical examples and code snippets where relevant
- Define technical terms on first use
- Create clear section headers and logical flow
- Plan for cross-references between sections
- Ensure completeness — cover all necessary topics`;
  } else if (config.contentType === 'course') {
    roleDescription = `You are an expert curriculum designer and educator. You create engaging, progressive learning experiences that build mastery through structured modules.`;
    qualityGuidelines = `
- Design progressive learning objectives (Bloom's taxonomy)
- Include hands-on exercises and assessments
- Build concepts incrementally — each module builds on previous
- Mix theory with practical application
- Plan recap and reinforcement sections
- Include real-world case studies`;
  } else if (config.contentType === 'screenplay') {
    roleDescription = `You are an accomplished screenwriter. You craft visually compelling stories with strong dialogue, clear character motivations, and cinematic pacing.`;
    qualityGuidelines = `
- Structure according to three-act format
- Focus on visual storytelling and subtext
- Write distinctive character voices
- Plan compelling set pieces and turning points
- Balance exposition with action
- Create clear scene transitions`;
  } else {
    roleDescription = `You are an expert ${contentLabel} writer with deep domain knowledge. You create comprehensive, well-structured content that serves its intended audience effectively.`;
    qualityGuidelines = `
- Organize content logically for the target audience
- Ensure comprehensive coverage of all necessary topics
- Use appropriate tone and terminology
- Plan clear transitions between sections
- Include supporting evidence and examples
- Maintain consistency throughout`;
  }

  return `${roleDescription}

You are creating a detailed outline for a ${contentLabel} with approximately ${config.targetWords.toLocaleString()} words across ${config.chaptersCount} ${sectionName}.

Quality guidelines:${qualityGuidelines}

You must respond with a structured outline following the exact schema provided. Be thorough and creative — this outline drives the entire generation process.`;
}

export function buildOutlineUserPrompt(title: string, description: string, config: GenerationConfig): string {
  const sectionName = CONTENT_TYPE_SECTION_NAMES[config.contentType];
  const wordsPerChapter = Math.round(config.targetWords / config.chaptersCount);

  return `Create a detailed outline for the following:

**Title:** ${title}

**Description:** ${description}

**Requirements:**
- Exactly ${config.chaptersCount} ${sectionName}
- Target approximately ${config.targetWords.toLocaleString()} total words
- Each ${sectionName.slice(0, -1)} should target approximately ${wordsPerChapter.toLocaleString()} words
- Include all major characters with their roles, traits, and arcs
- Provide a compelling synopsis
- Identify core themes
- Each ${sectionName.slice(0, -1)} needs: title, summary, key events, and characters involved

Make the outline detailed enough to guide a writer through the entire ${CONTENT_TYPE_LABELS[config.contentType]}.`;
}
