/**
 * Newsletter Writer — Portable logic module
 *
 * Extracted from the route for convergence with codex runtime.
 * Handles: newsletter generation, suggestion, section refinement, and CRUD.
 * Uses the shared AI caller instead of duplicated provider logic.
 */

import { resolveAIConfig, callAI, type AIConfig } from '@/server/plugins/ai-caller';

// ─── Types ────────────────────────────────────────────────────

export interface NewsletterSection {
  id: string;
  type: 'intro' | 'topic' | 'highlight' | 'quicklinks' | 'reflection' | 'outro';
  title: string;
  content: string;
  sourceCount: number;
}

export interface Newsletter {
  id: string;
  title: string;
  subject: string;
  period: string;
  periodDays: number;
  tone: string;
  sections: NewsletterSection[];
  wordCount: number;
  sourceCount: number;
  topicsCovered: string[];
  status: 'draft' | 'polishing' | 'ready';
  createdAt: string;
  updatedAt: string;
}

export interface NewsletterSummary {
  id: string;
  title: string;
  subject: string;
  period: string;
  periodDays: number;
  tone: string;
  sectionCount: number;
  wordCount: number;
  sourceCount: number;
  topicsCovered: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeSuggestion {
  title: string;
  subject: string;
  topics: string[];
  pitch: string;
}

export interface GenerateInput {
  title?: string;
  subject?: string;
  periodDays?: number;
  tone?: string;
  focusTopics?: string[];
  customPrompt?: string;
}

// ─── Tone Config ──────────────────────────────────────────────

export const NEWSLETTER_TONES: Record<string, string> = {
  professional: 'Polished and authoritative — suitable for a professional audience. Clear headings, concise paragraphs, actionable insights.',
  casual: 'Warm and conversational — like writing to a friend. Use "I" and "you", share honest reactions, be relatable.',
  witty: 'Sharp and clever — engaging hooks, surprising turns, memorable phrasing. Smart humor where appropriate.',
};

// ─── Helpers ──────────────────────────────────────────────────

export function generateNewsleterId(): string {
  return `nl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateNlSectionId(): string {
  return `sec_${Math.random().toString(36).slice(2, 10)}`;
}

export function getNewsletterPeriodLabel(days: number): string {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)}–${fmt(end)}, ${end.getFullYear()}`;
}

export function getNewsletterDateNDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString();
}

// ─── Summarize newsletters to list form ───────────────────────

export function summarizeNewsletters(newsletters: Newsletter[]): NewsletterSummary[] {
  return newsletters
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(n => ({
      id: n.id,
      title: n.title,
      subject: n.subject,
      period: n.period,
      periodDays: n.periodDays,
      tone: n.tone,
      sectionCount: n.sections.length,
      wordCount: n.wordCount,
      sourceCount: n.sourceCount,
      topicsCovered: n.topicsCovered,
      status: n.status,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));
}

// ─── Suggest Themes ───────────────────────────────────────────

/**
 * AI-suggest newsletter themes from a list of recent memories.
 * Returns null if no AI provider is available.
 */
export async function suggestThemes(
  memories: { source_type?: string; title?: string; content: string }[],
  days: number,
  aiConfig?: AIConfig | null,
): Promise<ThemeSuggestion[] | null> {
  const config = aiConfig ?? await resolveAIConfig();
  if (!config) return null;

  const knowledgeSummary = memories
    .map(m => `[${m.source_type || 'note'}] ${m.title || '(untitled)'}: ${(m.content || '').slice(0, 200)}`)
    .join('\n');

  const system = 'You are a newsletter editor analyzing someone\'s knowledge base to suggest themes for a personal digest.';
  const prompt = `I added ${memories.length} items to my knowledge base in the last ${days} days. Here they are:

${knowledgeSummary}

Suggest 3 newsletter theme ideas I could write about. For each:
1. A catchy title for the newsletter issue
2. An email subject line (compelling, under 60 chars)
3. The main topics it would cover (2-4 topics)
4. A one-line pitch

Return ONLY a JSON array: [{ "title": string, "subject": string, "topics": string[], "pitch": string }]
No markdown fences, no explanation — just the JSON array.`;

  const result = await callAI(config, prompt, { system, temperature: 0.7, maxTokens: 2048 });
  if (!result) return null;

  try {
    const cleaned = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as ThemeSuggestion[];
  } catch {
    return null;
  }
}

// ─── Generate Newsletter ──────────────────────────────────────

/**
 * Generate a structured newsletter from a set of memories.
 * Returns the built Newsletter object (not yet persisted).
 */
export async function generateNewsletter(
  input: GenerateInput,
  memories: { id: string; title?: string; content: string; source_type?: string; created_at?: string }[],
  aiConfig?: AIConfig | null,
): Promise<Newsletter | null> {
  const config = aiConfig ?? await resolveAIConfig();
  if (!config) return null;

  const {
    title = 'This Week in My Mind',
    subject,
    periodDays = 7,
    tone = 'casual',
    focusTopics,
    customPrompt,
  } = input;

  const period = getNewsletterPeriodLabel(periodDays);
  const toneDesc = NEWSLETTER_TONES[tone] || NEWSLETTER_TONES.casual;

  const knowledgeContext = memories.slice(0, 40)
    .map((m, i) => `[${i + 1}] (${m.source_type || 'note'}) ${m.title || '(untitled)'}:\n${(m.content || '').slice(0, 600)}`)
    .join('\n\n---\n\n');

  const system = `You are a skilled newsletter writer. You create engaging, well-curated digests from someone's personal knowledge base. Critical rules:
- Write ONLY from the provided sources — never invent facts or links
- Create a structured newsletter with clear sections
- Each section should be self-contained and interesting
- Use markdown formatting
- Make it feel personal and insightful, not like a generic AI summary
- ${toneDesc}`;

  const prompt = `Create a newsletter issue: "${title}"
Subject: "${subject || 'What I learned this week'}"
Period: ${period} (last ${periodDays} days)
${focusTopics ? `Focus topics: ${focusTopics.join(', ')}` : ''}
${customPrompt ? `Additional instructions: ${customPrompt}` : ''}

Sources from my knowledge base (${memories.length} items):

${knowledgeContext}

Generate a newsletter with these sections (as a JSON array):
1. "intro" — Opening paragraph: warm greeting + what this issue covers (2-3 sentences)
2. 2-4 "topic" sections — Deep dives into the most interesting themes. Each should have a catchy title, 2-3 paragraphs synthesizing related sources, and a personal take
3. 1 "highlight" section — The single most interesting/surprising thing from this period. Quote or excerpt with commentary
4. 1 "quicklinks" section — Bullet list of 3-5 other noteworthy items that didn't get full sections (title + one-line description each)
5. "outro" — Closing thought, what you're looking forward to, or a question for readers (1-2 sentences)

Return ONLY a JSON array of section objects:
[{
  "type": "intro" | "topic" | "highlight" | "quicklinks" | "outro",
  "title": "Section title",
  "content": "Markdown content",
  "sourceCount": number
}]

No markdown fences, no explanation — just the JSON array.`;

  const result = await callAI(config, prompt, { system, temperature: 0.7, maxTokens: 8192 });
  if (!result) return null;

  let sections: NewsletterSection[];
  let topicsCovered: string[];
  try {
    const cleaned = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    sections = parsed.map((s: any) => ({
      id: generateNlSectionId(),
      type: s.type || 'topic',
      title: s.title || 'Untitled Section',
      content: s.content || '',
      sourceCount: s.sourceCount || 0,
    }));
    topicsCovered = sections.filter(s => s.type === 'topic').map(s => s.title);
  } catch {
    sections = [{
      id: generateNlSectionId(),
      type: 'topic',
      title: 'This Week\'s Digest',
      content: result,
      sourceCount: memories.length,
    }];
    topicsCovered = ['General Digest'];
  }

  const totalWords = sections.reduce(
    (sum, s) => sum + s.content.split(/\s+/).filter(Boolean).length, 0,
  );

  return {
    id: generateNewsleterId(),
    title,
    subject: subject || `What I learned — ${period}`,
    period,
    periodDays,
    tone,
    sections,
    wordCount: totalWords,
    sourceCount: memories.length,
    topicsCovered,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Refine Section ───────────────────────────────────────────

/**
 * AI-refine a single newsletter section given an instruction.
 */
export async function refineSection(
  section: NewsletterSection,
  instruction: string,
  aiConfig?: AIConfig | null,
): Promise<string | null> {
  const config = aiConfig ?? await resolveAIConfig();
  if (!config) return null;

  const system = 'You are a newsletter editor refining a section. Keep the same style and tone. Return ONLY the refined content in markdown — no explanation.';
  const prompt = `Here is a newsletter section titled "${section.title}":

---
${section.content}
---

Refinement instruction: ${instruction}

Return ONLY the refined version. Keep markdown formatting.`;

  return callAI(config, prompt, { system, temperature: 0.7, maxTokens: 4096 });
}

// ─── Update Newsletter ────────────────────────────────────────

/**
 * Apply partial updates to a newsletter object (in-memory, not persisted).
 * Returns the updated newsletter.
 */
export function updateNewsletter(
  newsletter: Newsletter,
  updates: {
    title?: string;
    subject?: string;
    status?: 'draft' | 'polishing' | 'ready';
    sectionId?: string;
    content?: string;
  },
): Newsletter {
  const nl = { ...newsletter };

  if (updates.title !== undefined) nl.title = updates.title;
  if (updates.subject !== undefined) nl.subject = updates.subject;
  if (updates.status !== undefined) nl.status = updates.status;

  if (updates.sectionId && updates.content !== undefined) {
    nl.sections = nl.sections.map(s =>
      s.id === updates.sectionId ? { ...s, content: updates.content! } : s,
    );
  }

  nl.wordCount = nl.sections.reduce(
    (sum, s) => sum + s.content.split(/\s+/).filter(Boolean).length, 0,
  );
  nl.updatedAt = new Date().toISOString();

  return nl;
}
