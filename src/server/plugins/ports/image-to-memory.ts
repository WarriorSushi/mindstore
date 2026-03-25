/**
 * Image-to-Memory — Portable logic module
 *
 * Extracted from the route for convergence with codex runtime.
 * Handles: context prompts, tag extraction, vision API request building.
 * Does NOT include actual fetch calls (those are runtime-specific).
 */

// ─── Types ────────────────────────────────────────────────────

export type ContextType = 'general' | 'screenshot' | 'whiteboard' | 'document' | 'diagram' | 'photo' | 'chart' | 'meme';

export interface VisionAnalysisResult {
  description: string;
  tags: string[];
}

// ─── Context Prompts ─────────────────────────────────────────

export const CONTEXT_PROMPTS: Record<ContextType, string> = {
  general: 'Describe this image in detail. Include: what you see, any text visible, key objects, people, colors, mood, and context. If there are diagrams or charts, describe their structure and data.',
  screenshot: 'This is a screenshot. Describe: what application/website is shown, the content/text visible, any UI elements of note, and the purpose or context of what is being shown.',
  whiteboard: 'This is a whiteboard or handwritten notes. Transcribe all visible text exactly. Describe any diagrams, arrows, connections, or visual organization. Explain the likely topic and key ideas being discussed.',
  document: 'This is a scanned or photographed document. Transcribe all visible text as accurately as possible. Note any formatting, headers, signatures, stamps, or other document elements.',
  diagram: 'This is a diagram, flowchart, or technical drawing. Describe the structure, connections, flow, labels, and overall purpose. Explain what system or concept it represents.',
  photo: 'This is a photograph. Describe: the scene, subjects, setting, lighting, mood, and any notable details. If there are people, describe what they are doing without identifying them.',
  chart: 'This is a chart or graph. Describe: the type of chart, axes/labels, data trends, key data points, and what insight or conclusion the chart conveys.',
  meme: 'This is a meme or social media image. Describe the visual content, any text/captions, the cultural reference or joke being made, and the tone/humor.',
};

export const SYSTEM_PROMPT = 'You are a precise image analyst for a personal knowledge management system. Your descriptions will become searchable memories. Be detailed but organized. After your description, provide a JSON array of 3-8 relevant tags on the last line, formatted as: TAGS: ["tag1", "tag2", "tag3"]';

// ─── Tag Extraction ──────────────────────────────────────────

/**
 * Extract tags from AI response text. Looks for TAGS: ["tag1", "tag2"] pattern.
 */
export function extractTagsFromResponse(text: string): VisionAnalysisResult {
  let description = text;
  let tags: string[] = [];

  const tagMatch = text.match(/TAGS:\s*\[([^\]]+)\]/i);
  if (tagMatch) {
    try {
      tags = JSON.parse(`[${tagMatch[1]}]`);
      description = text.replace(/TAGS:\s*\[([^\]]*)\]/i, '').trim();
    } catch {
      tags = tagMatch[1]
        .split(',')
        .map(t => t.replace(/["\s]/g, '').trim())
        .filter(Boolean);
      description = text.replace(/TAGS:\s*\[([^\]]*)\]/i, '').trim();
    }
  }

  tags = tags
    .map(t => String(t).toLowerCase().trim())
    .filter(t => t.length > 0 && t.length < 40)
    .slice(0, 10);

  return { description, tags };
}

// ─── Prompt Builder ──────────────────────────────────────────

export function buildAnalysisPrompt(contextType: ContextType, customPrompt?: string): string {
  const basePrompt = CONTEXT_PROMPTS[contextType] || CONTEXT_PROMPTS.general;
  return customPrompt
    ? `${basePrompt}\n\nAdditional context from the user: ${customPrompt}`
    : basePrompt;
}

// ─── Title Generator ─────────────────────────────────────────

export function generateTitleFromDescription(description: string): string {
  const firstSentence = description.split(/[.!?\n]/)[0]?.trim() || 'Image Analysis';
  return firstSentence.length > 60
    ? firstSentence.slice(0, 57) + '...'
    : firstSentence;
}

// ─── OpenAI-compatible Request Body Builder ──────────────────

export function buildOpenAIVisionRequest(
  model: string,
  base64Image: string,
  mimeType: string,
  prompt: string,
): object {
  return {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' },
          },
        ],
      },
    ],
    max_tokens: 1500,
    temperature: 0.3,
  };
}

// ─── Gemini Request Body Builder ─────────────────────────────

export function buildGeminiVisionRequest(
  base64Image: string,
  mimeType: string,
  prompt: string,
): object {
  return {
    contents: [
      {
        parts: [
          {
            text: `${prompt}\n\nAfter your description, provide a JSON array of 3-8 relevant tags on the last line, formatted as: TAGS: ["tag1", "tag2", "tag3"]`,
          },
          { inlineData: { mimeType, data: base64Image } },
        ],
      },
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
  };
}

// ─── Ollama Request Body Builder ─────────────────────────────

export function buildOllamaVisionRequest(
  model: string,
  base64Image: string,
  prompt: string,
): object {
  return {
    model,
    prompt: `${prompt}\n\nAfter your description, provide a JSON array of 3-8 relevant tags on the last line, formatted as: TAGS: ["tag1", "tag2", "tag3"]`,
    images: [base64Image],
    stream: false,
    options: { temperature: 0.3 },
  };
}

// ─── Format as Memory Content ────────────────────────────────

export function formatImageMemoryContent(
  title: string,
  description: string,
  tags: string[],
  contextType: ContextType,
): string {
  const tagLine = tags.length > 0 ? `\nTags: ${tags.join(', ')}` : '';
  const contextLine = contextType !== 'general' ? `\nType: ${contextType}` : '';
  return `# ${title}\n\n${description}${tagLine}${contextLine}`;
}

// ─── Allowed Image Types ─────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
];

export const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
