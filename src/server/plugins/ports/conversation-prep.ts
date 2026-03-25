/**
 * Conversation Prep — Portable logic module
 * 
 * Extracted from the route for convergence with codex runtime.
 * Handles: briefing CRUD, prompt construction, search strategy.
 * AI calling injected — will use Codex's shared ai-client.ts once converged.
 */

import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────

export interface BriefingSection {
  title: string;
  icon: string;
  items: string[];
}

export interface Briefing {
  id: string;
  subject: string;
  type: 'person' | 'topic' | 'company' | 'project';
  context?: string;
  sections: BriefingSection[];
  sourceCount: number;
  sourceMemoryIds: string[];
  createdAt: string;
}

export interface BriefingSummary {
  id: string;
  subject: string;
  type: string;
  context?: string;
  sectionCount: number;
  sourceCount: number;
  createdAt: string;
  preview: string;
}

const PLUGIN_SLUG = 'conversation-prep';
const MAX_BRIEFINGS = 50;

// ─── ID Generation ────────────────────────────────────────────

export function generateBriefingId(): string {
  return `bp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Storage ──────────────────────────────────────────────────

export async function getBriefings(): Promise<Briefing[]> {
  const rows = await db.execute(
    sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`
  );
  const row = (rows as any[])[0];
  if (!row?.config) return [];
  const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  return config.briefings || [];
}

export async function saveBriefings(briefings: Briefing[]): Promise<void> {
  const trimmed = briefings.length > MAX_BRIEFINGS
    ? briefings.slice(briefings.length - MAX_BRIEFINGS)
    : briefings;
  await db.execute(sql`
    UPDATE plugins 
    SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{briefings}', ${JSON.stringify(trimmed)}::jsonb),
        updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

export async function getBriefingById(id: string): Promise<Briefing | null> {
  const briefings = await getBriefings();
  return briefings.find(b => b.id === id) || null;
}

export async function listBriefingSummaries(): Promise<BriefingSummary[]> {
  const briefings = await getBriefings();
  return briefings
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(b => ({
      id: b.id,
      subject: b.subject,
      type: b.type,
      context: b.context,
      sectionCount: b.sections.length,
      sourceCount: b.sourceCount,
      createdAt: b.createdAt,
      preview: b.sections[0]?.items?.[0]?.slice(0, 120) || '',
    }));
}

export async function deleteBriefing(id: string): Promise<void> {
  const briefings = await getBriefings();
  const filtered = briefings.filter(b => b.id !== id);
  if (filtered.length === briefings.length) throw new Error('Briefing not found');
  await saveBriefings(filtered);
}

// ─── Search Strategy ──────────────────────────────────────────

export function buildSearchQueries(
  subject: string,
  type: Briefing['type'],
  context?: string,
): string[] {
  const queries = [subject];
  if (context) queries.push(`${subject} ${context}`);

  switch (type) {
    case 'person':
      queries.push(`${subject} conversation`, `${subject} meeting notes`, `${subject} project`);
      break;
    case 'company':
      queries.push(`${subject} business`, `${subject} product`, `${subject} partnership`);
      break;
    case 'project':
      queries.push(`${subject} status`, `${subject} issues`, `${subject} decisions`);
      break;
    default:
      queries.push(`${subject} notes`, `${subject} insights`);
  }

  return queries.slice(0, 5);
}

// ─── Prompt Builders ──────────────────────────────────────────

export function buildBriefingPrompt(
  subject: string,
  type: Briefing['type'],
  context: string,
  knowledgeContext: string,
): { system: string; prompt: string } {
  const typeLabel = type === 'person' ? 'person'
    : type === 'company' ? 'company/organization'
    : type === 'project' ? 'project'
    : 'topic';

  return {
    system: `You are a brilliant executive assistant preparing a comprehensive briefing. You extract and organize relevant information from the user's personal knowledge base. You ONLY use information from the provided sources — never invent facts. Be specific, cite dates when available, and surface non-obvious connections. If the sources don't contain certain information, say so honestly rather than making things up.`,
    prompt: `Prepare a comprehensive briefing about this ${typeLabel}: "${subject}"
${context ? `\nMeeting context: ${context}` : ''}

Here is everything from my knowledge base related to this ${typeLabel}:

${knowledgeContext}

Create a structured briefing with these sections (skip any section if there's no relevant info for it):

1. **Overview** — Quick summary of what I know about ${subject}. 2-3 sentences max.
2. **Key Facts** — Specific facts, details, data points I've stored about ${subject}.
3. **History & Timeline** — Past interactions, milestones, or events related to ${subject} in chronological order.
4. **Related Topics** — Other topics/people/projects in my knowledge that connect to ${subject}.
5. **Talking Points** — Suggested conversation topics based on what I know. Things I could bring up.
6. **Questions to Ask** — Things I might want to find out based on gaps in my knowledge about ${subject}.
7. **Preparation Notes** — Any action items, context, or things to review before the conversation.

Return ONLY a JSON object with this structure:
{
  "sections": [
    {
      "title": "Section Title",
      "icon": "icon-name",
      "items": ["Item 1", "Item 2", ...]
    }
  ]
}

Icon options: "User" (overview), "ListChecks" (facts), "Clock" (timeline), "Network" (related), "MessageCircle" (talking points), "HelpCircle" (questions), "ClipboardList" (prep notes).

Be specific and actionable. Each item should be a single, clear statement. No markdown fences — just raw JSON.`,
  };
}

export function buildFollowUpPrompt(
  briefing: Briefing,
  question: string,
  additionalContext: string,
): { system: string; prompt: string } {
  const briefingContext = briefing.sections
    .map(s => `${s.title}:\n${s.items.map(i => `- ${i}`).join('\n')}`)
    .join('\n\n');

  return {
    system: `You are an executive assistant answering a follow-up question about a briefing. Use ONLY information from the provided sources. Be specific and concise.`,
    prompt: `Previous briefing about "${briefing.subject}":\n${briefingContext}\n\nAdditional knowledge:\n${additionalContext}\n\nFollow-up question: ${question}\n\nAnswer concisely and specifically. If the answer isn't in the sources, say so.`,
  };
}

// ─── Briefing Creation ────────────────────────────────────────

export function parseBriefingSections(aiResponse: string): BriefingSection[] {
  try {
    const cleaned = aiResponse.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const sections = (parsed.sections || []) as BriefingSection[];
    return sections.filter(s => s.items && s.items.length > 0);
  } catch {
    return [{
      title: 'Briefing',
      icon: 'User',
      items: [aiResponse.slice(0, 2000)],
    }];
  }
}

export function createBriefingObject(
  subject: string,
  type: Briefing['type'],
  context: string | undefined,
  sections: BriefingSection[],
  sourceMemoryIds: string[],
): Briefing {
  return {
    id: generateBriefingId(),
    subject,
    type,
    context,
    sections,
    sourceCount: sourceMemoryIds.length,
    sourceMemoryIds,
    createdAt: new Date().toISOString(),
  };
}

// ─── Knowledge Context Builder ────────────────────────────────

export function buildKnowledgeContext(memories: any[]): string {
  return memories
    .map((m: any, i: number) => {
      const date = m.createdAt
        ? new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'unknown date';
      return `[Source ${i + 1} | ${m.sourceType || 'note'} | ${date}] ${m.sourceTitle || '(untitled)'}:\n${m.content?.slice(0, 600) || ''}`;
    })
    .join('\n\n---\n\n');
}
