/**
 * Resume Builder — Portable logic module
 * 
 * Extracted from the route for convergence with codex runtime.
 * Handles: resume CRUD, templates, section management, prompt builders.
 * AI calling injected — will use Codex's shared ai-client.ts once converged.
 */

import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────

export interface ResumeSection {
  id: string;
  type: 'header' | 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'certifications' | 'languages' | 'interests' | 'custom';
  title: string;
  content: string;
  visible: boolean;
  order: number;
}

export interface Resume {
  id: string;
  title: string;
  targetRole: string;
  template: string;
  sections: ResumeSection[];
  sourceMemoryIds: string[];
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
}

// ─── Constants ────────────────────────────────────────────────

const PLUGIN_SLUG = 'resume-builder';
const MAX_RESUMES = 10;

export const TEMPLATES: ResumeTemplate[] = [
  { id: 'modern', name: 'Modern', description: 'Clean, minimal layout with strong typography. Best for tech roles.', sections: ['header', 'summary', 'experience', 'skills', 'projects', 'education'] },
  { id: 'classic', name: 'Classic', description: 'Traditional chronological format. Universally accepted.', sections: ['header', 'summary', 'experience', 'education', 'skills', 'certifications'] },
  { id: 'creative', name: 'Creative', description: 'Projects-first layout for portfolio-driven roles.', sections: ['header', 'summary', 'projects', 'experience', 'skills', 'interests'] },
  { id: 'executive', name: 'Executive', description: 'Leadership-focused with achievements and impact metrics.', sections: ['header', 'summary', 'experience', 'certifications', 'education', 'languages'] },
];

export const SECTION_DEFAULTS: Record<string, { title: string; type: ResumeSection['type'] }> = {
  header: { title: 'Contact Information', type: 'header' },
  summary: { title: 'Professional Summary', type: 'summary' },
  experience: { title: 'Work Experience', type: 'experience' },
  education: { title: 'Education', type: 'education' },
  skills: { title: 'Technical Skills', type: 'skills' },
  projects: { title: 'Projects', type: 'projects' },
  certifications: { title: 'Certifications & Awards', type: 'certifications' },
  languages: { title: 'Languages', type: 'languages' },
  interests: { title: 'Interests', type: 'interests' },
};

// ─── ID Generation ────────────────────────────────────────────

export function generateResumeId(): string {
  return `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateSectionId(): string {
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Storage ──────────────────────────────────────────────────

export async function getResumes(): Promise<Resume[]> {
  try {
    const rows = await db.execute(sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    const config = (rows as any[])?.[0]?.config || {};
    return config.resumes || [];
  } catch { return []; }
}

export async function saveResumes(resumes: Resume[]): Promise<void> {
  await db.execute(sql`
    UPDATE plugins SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{resumes}', ${JSON.stringify(resumes)}::jsonb), updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

export async function getResumeById(id: string): Promise<Resume | null> {
  const resumes = await getResumes();
  return resumes.find(r => r.id === id) || null;
}

export async function deleteResume(id: string): Promise<void> {
  const resumes = await getResumes();
  const filtered = resumes.filter(r => r.id !== id);
  if (filtered.length === resumes.length) throw new Error('Resume not found');
  await saveResumes(filtered);
}

export async function updateResumeSection(
  resumeId: string,
  sectionId: string,
  updates: Partial<Pick<ResumeSection, 'content' | 'title' | 'visible'>>,
): Promise<Resume> {
  const resumes = await getResumes();
  const idx = resumes.findIndex(r => r.id === resumeId);
  if (idx === -1) throw new Error('Resume not found');

  const secIdx = resumes[idx]!.sections.findIndex(s => s.id === sectionId);
  if (secIdx === -1) throw new Error('Section not found');

  if (updates.content !== undefined) resumes[idx]!.sections[secIdx]!.content = updates.content;
  if (updates.title !== undefined) resumes[idx]!.sections[secIdx]!.title = updates.title;
  if (updates.visible !== undefined) resumes[idx]!.sections[secIdx]!.visible = updates.visible;
  resumes[idx]!.updatedAt = new Date().toISOString();

  await saveResumes(resumes);
  return resumes[idx]!;
}

export async function addSection(
  resumeId: string,
  title = 'Custom Section',
  type: ResumeSection['type'] = 'custom',
): Promise<{ section: ResumeSection; resume: Resume }> {
  const resumes = await getResumes();
  const idx = resumes.findIndex(r => r.id === resumeId);
  if (idx === -1) throw new Error('Resume not found');

  const section: ResumeSection = {
    id: generateSectionId(), type, title, content: '', visible: true,
    order: resumes[idx]!.sections.length,
  };

  resumes[idx]!.sections.push(section);
  resumes[idx]!.updatedAt = new Date().toISOString();
  await saveResumes(resumes);
  return { section, resume: resumes[idx]! };
}

export async function reorderSections(resumeId: string, sectionIds: string[]): Promise<Resume> {
  const resumes = await getResumes();
  const idx = resumes.findIndex(r => r.id === resumeId);
  if (idx === -1) throw new Error('Resume not found');

  const reordered: ResumeSection[] = [];
  for (const sid of sectionIds) {
    const sec = resumes[idx]!.sections.find(s => s.id === sid);
    if (sec) { sec.order = reordered.length; reordered.push(sec); }
  }
  for (const sec of resumes[idx]!.sections) {
    if (!reordered.find(s => s.id === sec.id)) { sec.order = reordered.length; reordered.push(sec); }
  }

  resumes[idx]!.sections = reordered;
  resumes[idx]!.updatedAt = new Date().toISOString();
  await saveResumes(resumes);
  return resumes[idx]!;
}

// ─── Resume Creation ─────────────────────────────────────────

export function canCreateResume(currentCount: number): boolean {
  return currentCount < MAX_RESUMES;
}

export function createResumeFromAI(
  targetRole: string,
  template: string,
  parsedSections: { type: string; title: string; content: string }[],
  sourceMemoryIds: string[],
): Resume {
  return {
    id: generateResumeId(),
    title: `${targetRole} Resume`,
    targetRole, template,
    sections: parsedSections.map((s, i) => ({
      id: generateSectionId(),
      type: (s.type || 'custom') as ResumeSection['type'],
      title: s.title || 'Section',
      content: s.content || '',
      visible: true, order: i,
    })),
    sourceMemoryIds, sourceCount: sourceMemoryIds.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Prompt Builders ──────────────────────────────────────────

export function buildGeneratePrompt(
  targetRole: string,
  template: ResumeTemplate,
  memoryContext: string,
  userFacts: string,
  additionalContext: string,
): { system: string; prompt: string } {
  return {
    system: `You are an expert resume writer who creates ATS-optimized, compelling professional resumes.

RULES:
- Use strong action verbs (Led, Architected, Shipped, Grew, Optimized)
- Quantify achievements with metrics wherever possible (%, $, numbers)
- Be concise — each bullet should be one impactful line
- Tailor content to the target role
- Use markdown formatting
- Be honest — only use information from the provided memories
- If there's not enough info for a section, write a placeholder with [TODO: ...]`,
    prompt: `Generate a professional resume for: **${targetRole}**

Template: ${template.name} (${template.description})

${userFacts ? `USER PROFILE:\n${userFacts}\n\n` : ''}
MEMORIES TO EXTRACT FROM:
${memoryContext}

${additionalContext ? `ADDITIONAL CONTEXT:\n${additionalContext}\n\n` : ''}
Generate each of these sections in order. Return ONLY valid JSON:
{
  "sections": [
    ${template.sections.map(s => {
      const def = SECTION_DEFAULTS[s] || { title: s, type: s };
      return `{ "type": "${def.type}", "title": "${def.title}", "content": "markdown content" }`;
    }).join(',\n    ')}
  ]
}`,
  };
}

export function buildRefinePrompt(
  targetRole: string,
  sectionTitle: string,
  currentContent: string,
  instruction?: string,
): { system: string; prompt: string } {
  return {
    system: `You are an expert resume writer. You refine resume sections to be more impactful, ATS-friendly, and compelling. Return ONLY the refined markdown content, nothing else.`,
    prompt: `Target role: ${targetRole}

Section: ${sectionTitle}
Current content:
${currentContent}

${instruction ? `User instruction: ${instruction}` : 'Make it more impactful with stronger action verbs, metrics, and concise language.'}

Return ONLY the refined markdown content.`,
  };
}

// ─── Professional Memory Search Queries ───────────────────────

export function getProfessionalSearchQueries(targetRole: string): string[] {
  return [
    `professional experience work ${targetRole}`,
    'skills technologies tools programming languages',
    'education degree university certification course',
    'projects built achievements accomplishments portfolio',
    'work history career job role responsibilities',
  ];
}

// ─── Parse AI Response ────────────────────────────────────────

export function parseResumeAIResponse(raw: string): { type: string; title: string; content: string }[] {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || raw);
    return parsed.sections || [];
  } catch {
    throw new Error('Failed to parse AI response');
  }
}
