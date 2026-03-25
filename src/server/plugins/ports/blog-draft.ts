/**
 * Blog Draft Generator — Portable logic module
 * 
 * Extracted from the route for convergence with codex runtime.
 * Handles: draft CRUD, generation prompts/pipeline, export formatting.
 * AI calling is injected — will use Codex's shared ai-client.ts once converged.
 */

import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────

export interface BlogDraft {
  id: string;
  title: string;
  topic: string;
  style: string;
  tone: string;
  content: string;
  outline: string[];
  wordCount: number;
  sourceMemoryIds: string[];
  sourceCount: number;
  status: 'draft' | 'refining' | 'ready';
  createdAt: string;
  updatedAt: string;
}

export interface BlogDraftSummary {
  id: string;
  title: string;
  topic: string;
  style: string;
  tone: string;
  wordCount: number;
  sourceCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

export interface TopicSuggestion {
  title: string;
  description: string;
  readingTime: number;
  style: string;
}

// ─── Style & Tone Definitions ─────────────────────────────────

export const STYLES: Record<string, string> = {
  technical: 'Technical deep-dive with code examples, architecture diagrams, and precise terminology',
  casual: 'Relaxed, first-person narrative with personality and humor — like talking to a smart friend',
  storytelling: 'Narrative arc with a hook, building tension, climax, and takeaway — almost like a short story',
  tutorial: 'Step-by-step guide with clear instructions, numbered steps, and practical outcomes',
  opinion: 'Thought leadership piece — strong thesis, evidence, counterarguments, and a call to action',
};

export const TONES: Record<string, string> = {
  professional: 'Clear, authoritative, well-structured — suitable for LinkedIn or industry publications',
  conversational: 'Warm, approachable, uses "you" and "I" — like a personal blog',
  academic: 'Rigorous, well-cited, formal — suitable for research summaries or whitepapers',
  witty: 'Sharp, clever, surprising turns of phrase — engaging and memorable',
};

const PLUGIN_SLUG = 'blog-draft-generator';

// ─── ID Generation ────────────────────────────────────────────

export function generateDraftId(): string {
  return `bd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Storage ──────────────────────────────────────────────────

export async function getDrafts(): Promise<BlogDraft[]> {
  const rows = await db.execute(
    sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`
  );
  const row = (rows as any[])[0];
  if (!row?.config) return [];
  const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  return config.drafts || [];
}

export async function saveDrafts(drafts: BlogDraft[]): Promise<void> {
  await db.execute(sql`
    UPDATE plugins 
    SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{drafts}', ${JSON.stringify(drafts)}::jsonb),
        updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

export async function getDraftById(id: string): Promise<BlogDraft | null> {
  const drafts = await getDrafts();
  return drafts.find(d => d.id === id) || null;
}

export async function listDraftSummaries(): Promise<BlogDraftSummary[]> {
  const drafts = await getDrafts();
  return drafts
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(d => ({
      id: d.id,
      title: d.title,
      topic: d.topic,
      style: d.style,
      tone: d.tone,
      wordCount: d.wordCount,
      sourceCount: d.sourceCount,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      preview: d.content.slice(0, 200),
    }));
}

export async function updateDraft(
  id: string,
  updates: Partial<Pick<BlogDraft, 'content' | 'title' | 'status'>>,
): Promise<BlogDraft> {
  const drafts = await getDrafts();
  const idx = drafts.findIndex(d => d.id === id);
  if (idx === -1) throw new Error('Draft not found');

  if (updates.content !== undefined) {
    drafts[idx]!.content = updates.content;
    drafts[idx]!.wordCount = updates.content.split(/\s+/).filter(Boolean).length;
  }
  if (updates.title !== undefined) drafts[idx]!.title = updates.title;
  if (updates.status !== undefined) drafts[idx]!.status = updates.status;
  drafts[idx]!.updatedAt = new Date().toISOString();

  await saveDrafts(drafts);
  return drafts[idx]!;
}

export async function deleteDraft(id: string): Promise<void> {
  const drafts = await getDrafts();
  const filtered = drafts.filter(d => d.id !== id);
  if (filtered.length === drafts.length) throw new Error('Draft not found');
  await saveDrafts(filtered);
}

// ─── Prompt Builders ──────────────────────────────────────────

export function buildTopicSuggestionPrompt(knowledgeSummary: string): {
  system: string;
  prompt: string;
} {
  return {
    system: `You are a blog topic strategist. Given a user's knowledge base, suggest blog post topics they could write about with authority — topics where they have real knowledge to share, not generic ideas.`,
    prompt: `Based on these knowledge fragments from my personal knowledge base, suggest 8 specific blog post topics I could write about. For each topic, provide:
1. A compelling title
2. A one-line description of the angle
3. An estimated reading time (min)
4. A style suggestion (technical/casual/storytelling/tutorial/opinion)

My knowledge includes:
${knowledgeSummary}

Return ONLY a JSON array with objects: { "title": string, "description": string, "readingTime": number, "style": string }
No markdown fences, no explanation — just the JSON array.`,
  };
}

export function buildOutlinePrompt(
  topic: string,
  style: string,
  tone: string,
  targetLength: number,
  knowledgeContext: string,
): { system: string; prompt: string } {
  return {
    system: `You are a professional blog editor who creates compelling, well-structured outlines. You write from the user's actual knowledge — never invent facts.`,
    prompt: `Create a blog post outline for the topic: "${topic}"

Writing style: ${STYLES[style] || style}
Tone: ${TONES[tone] || tone}
Target length: ~${targetLength} words

Here is the author's actual knowledge on this topic:

${knowledgeContext}

Create an outline with 4-7 sections. Each section should have a clear heading and 1-2 bullet points about what to cover.

Return ONLY a JSON array of strings (section headings). No markdown fences, no explanation — just the JSON array.`,
  };
}

export function buildBlogPrompt(
  topic: string,
  style: string,
  tone: string,
  targetLength: number,
  outline: string[],
  knowledgeContext: string,
): { system: string; prompt: string } {
  return {
    system: `You are a professional writer who creates compelling blog posts. Critical rules:
- Write ONLY from the provided knowledge — never invent facts, statistics, or claims not in the sources
- Write in first person when appropriate
- Use the specified style and tone consistently
- Include a strong hook in the opening paragraph
- Use markdown formatting: ## for headings, **bold** for emphasis, > for blockquotes
- Add a clear conclusion with a takeaway
- Target approximately ${targetLength} words
- Do NOT add meta-commentary like "Based on my research" — just write the post naturally
- Do NOT use placeholder links or references — only cite what's in the knowledge base`,
    prompt: `Write a complete blog post about: "${topic}"

Style: ${STYLES[style] || style}
Tone: ${TONES[tone] || tone}
Outline to follow:
${outline.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Here is my actual knowledge to draw from:

${knowledgeContext}

Write the complete blog post in markdown. Start with the title as # heading.`,
  };
}

export function buildRefinePrompt(
  instruction: string,
  content: string,
  isSelection: boolean,
): { system: string; prompt: string } {
  return {
    system: `You are a professional editor. You refine blog post content based on specific instructions. Keep the same style and tone. Return ONLY the refined content — no explanation or meta-commentary.`,
    prompt: isSelection
      ? `Here is a section from a blog post:\n\n---\n${content}\n---\n\nInstruction: ${instruction}\n\nReturn ONLY the refined version of this section. Keep markdown formatting.`
      : `Here is a complete blog post:\n\n---\n${content}\n---\n\nInstruction: ${instruction}\n\nReturn ONLY the refined version of the entire post. Keep markdown formatting.`,
  };
}

// ─── Draft Creation ───────────────────────────────────────────

export function createDraftObject(
  topic: string,
  style: string,
  tone: string,
  content: string,
  outline: string[],
  sourceMemoryIds: string[],
): BlogDraft {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return {
    id: generateDraftId(),
    title: titleMatch ? titleMatch[1]! : topic,
    topic,
    style,
    tone,
    content,
    outline,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    sourceMemoryIds,
    sourceCount: sourceMemoryIds.length,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Export Formatting ────────────────────────────────────────

export function exportAsMarkdown(draft: BlogDraft): { content: string; filename: string } {
  const frontmatter = `---
title: "${draft.title.replace(/"/g, '\\"')}"
date: ${draft.createdAt.split('T')[0]}
draft: true
tags: []
---

`;
  return {
    content: frontmatter + draft.content,
    filename: `${draft.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.md`,
  };
}

export function exportAsHtml(draft: BlogDraft): { content: string; filename: string } {
  let html = draft.content;
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/\n\n/g, '</p><p>');

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${draft.title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 680px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 2.2rem; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
    h2 { font-size: 1.5rem; margin-top: 2.5rem; letter-spacing: -0.01em; }
    h3 { font-size: 1.2rem; margin-top: 2rem; }
    blockquote { border-left: 3px solid #14b8a6; padding-left: 1rem; margin-left: 0; color: #555; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    a { color: #14b8a6; }
  </style>
</head>
<body><p>${html}</p></body>
</html>`;

  return {
    content: fullHtml,
    filename: `${draft.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.html`,
  };
}

// ─── Parse Helpers ────────────────────────────────────────────

export function parseJsonFromAI(raw: string): unknown {
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

export function parseOutline(raw: string): string[] {
  try {
    const parsed = parseJsonFromAI(raw);
    return Array.isArray(parsed) ? parsed.map(String) : ['Introduction', 'Main Points', 'Key Insights', 'Conclusion'];
  } catch {
    return ['Introduction', 'Main Points', 'Key Insights', 'Conclusion'];
  }
}
