/**
 * Resume Builder — Portable Logic
 *
 * Extracts resume generation, management, and AI-refinement logic
 * from the route into pure/reusable functions.
 * No HTTP, no NextRequest/NextResponse.
 *
 * Capabilities:
 * - Resume CRUD (create, read, update, delete, reorder)
 * - AI-powered resume generation from memory context
 * - Section refinement with AI
 * - Template definitions
 * - ID generation
 */

// ─── Types ───────────────────────────────────────────────────

export interface ResumeSection {
  id: string;
  type:
    | 'header'
    | 'summary'
    | 'experience'
    | 'education'
    | 'skills'
    | 'projects'
    | 'certifications'
    | 'languages'
    | 'interests'
    | 'custom';
  title: string;
  content: string; // markdown
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

export interface ResumeSummary {
  id: string;
  title: string;
  targetRole: string;
  template: string;
  sectionCount: number;
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

export interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
}

export interface MemorySource {
  content: string;
  title: string;
  id: string;
}

// ─── Constants ───────────────────────────────────────────────

export const MAX_RESUMES = 10;

export const TEMPLATES: ResumeTemplate[] = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean, minimal layout with strong typography. Best for tech roles.',
    sections: ['header', 'summary', 'experience', 'skills', 'projects', 'education'],
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional chronological format. Universally accepted.',
    sections: ['header', 'summary', 'experience', 'education', 'skills', 'certifications'],
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Projects-first layout for portfolio-driven roles.',
    sections: ['header', 'summary', 'projects', 'experience', 'skills', 'interests'],
  },
  {
    id: 'executive',
    name: 'Executive',
    description: 'Leadership-focused with achievements and impact metrics.',
    sections: ['header', 'summary', 'experience', 'certifications', 'education', 'languages'],
  },
];

export const SECTION_DEFAULTS: Record<
  string,
  { title: string; type: ResumeSection['type'] }
> = {
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

// ─── ID Generation ───────────────────────────────────────────

export function generateResumeId(): string {
  return `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateSectionId(): string {
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Resume Summaries ────────────────────────────────────────

export function summarizeResumes(resumes: Resume[]): ResumeSummary[] {
  return resumes.map((r) => ({
    id: r.id,
    title: r.title,
    targetRole: r.targetRole,
    template: r.template,
    sectionCount: r.sections.filter((s) => s.visible).length,
    sourceCount: r.sourceCount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    preview:
      r.sections.find((s) => s.type === 'summary')?.content?.slice(0, 150) || '',
  }));
}

// ─── Prompt Building ─────────────────────────────────────────

export const RESUME_SYSTEM_PROMPT = `You are an expert resume writer who creates ATS-optimized, compelling professional resumes.

RULES:
- Use strong action verbs (Led, Architected, Shipped, Grew, Optimized)
- Quantify achievements with metrics wherever possible (%, $, numbers)
- Be concise — each bullet should be one impactful line
- Tailor content to the target role
- Use markdown formatting
- Be honest — only use information from the provided memories
- If there's not enough info for a section, write a placeholder with [TODO: ...]`;

export function buildGenerationPrompt(
  targetRole: string,
  template: ResumeTemplate,
  memories: MemorySource[],
  userFacts: string,
  additionalContext: string,
): string {
  const memoryContext = memories
    .filter((m) => m.id !== '__user_facts__')
    .map((m, i) => `[Memory ${i + 1}: ${m.title}]\n${m.content}`)
    .join('\n\n---\n\n');

  const sectionList = template.sections;

  return `Generate a professional resume for: **${targetRole}**

Template: ${template.name} (${template.description})

${userFacts ? `USER PROFILE:\n${userFacts}\n\n` : ''}

MEMORIES TO EXTRACT FROM:
${memoryContext}

${additionalContext ? `ADDITIONAL CONTEXT:\n${additionalContext}\n\n` : ''}

Generate each of these sections in order. Return ONLY valid JSON (no markdown wrapping), with this exact structure:
{
  "sections": [
    ${sectionList
      .map((s) => {
        const def = SECTION_DEFAULTS[s] || { title: s, type: s };
        return `{ "type": "${def.type}", "title": "${def.title}", "content": "markdown content here" }`;
      })
      .join(',\n    ')}
  ]
}

Section guidelines:
- header: Name, email, phone, location, LinkedIn, GitHub, portfolio URL. Format as a clean contact block.
- summary: 2-3 sentence professional summary tailored to ${targetRole}. Highlight key strengths.
- experience: List jobs reverse-chronologically. Each with: **Company** — Role (dates). Then 3-5 bullet points with achievements.
- education: Degree, institution, year. Relevant coursework if applicable.
- skills: Grouped by category (Languages, Frameworks, Tools, etc.). Comma-separated within groups.
- projects: 2-4 notable projects with tech stack and impact.
- certifications: List relevant certifications and awards.
- languages: Human languages spoken with proficiency level.
- interests: Professional interests that show personality.`;
}

export const REFINE_SYSTEM_PROMPT = `You are an expert resume writer. You refine resume sections to be more impactful, ATS-friendly, and compelling. Return ONLY the refined markdown content, nothing else.`;

export function buildRefinePrompt(
  targetRole: string,
  sectionTitle: string,
  currentContent: string,
  instruction?: string,
): string {
  return `Target role: ${targetRole}

Section: ${sectionTitle}
Current content:
${currentContent}

${instruction || 'Make it more impactful with stronger action verbs, metrics, and concise language.'}

Return ONLY the refined markdown content.`;
}

// ─── AI Response Parsing ─────────────────────────────────────

export function parseGeneratedSections(aiResult: string): ResumeSection[] | null {
  try {
    const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || aiResult);
    return (parsed.sections || []).map((s: any, i: number) => ({
      id: generateSectionId(),
      type: s.type || 'custom',
      title: s.title || 'Section',
      content: s.content || '',
      visible: true,
      order: i,
    }));
  } catch {
    return null;
  }
}

// ─── Resume Operations (pure, mutate-in-place) ───────────────

export function createResume(
  targetRole: string,
  template: string,
  sections: ResumeSection[],
  sourceMemoryIds: string[],
): Resume {
  return {
    id: generateResumeId(),
    title: `${targetRole} Resume`,
    targetRole,
    template,
    sections,
    sourceMemoryIds,
    sourceCount: sourceMemoryIds.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function updateResumeSection(
  resume: Resume,
  sectionId: string,
  updates: { content?: string; title?: string; visible?: boolean },
): boolean {
  const section = resume.sections.find((s) => s.id === sectionId);
  if (!section) return false;
  if (updates.content !== undefined) section.content = updates.content;
  if (updates.title !== undefined) section.title = updates.title;
  if (updates.visible !== undefined) section.visible = updates.visible;
  resume.updatedAt = new Date().toISOString();
  return true;
}

export function addSection(
  resume: Resume,
  title: string = 'Custom Section',
  type: ResumeSection['type'] = 'custom',
): ResumeSection {
  const section: ResumeSection = {
    id: generateSectionId(),
    type,
    title,
    content: '',
    visible: true,
    order: resume.sections.length,
  };
  resume.sections.push(section);
  resume.updatedAt = new Date().toISOString();
  return section;
}

export function reorderSections(resume: Resume, sectionIds: string[]): void {
  const reordered: ResumeSection[] = [];
  for (const sid of sectionIds) {
    const sec = resume.sections.find((s) => s.id === sid);
    if (sec) {
      sec.order = reordered.length;
      reordered.push(sec);
    }
  }
  // Append any sections not in the reorder list
  for (const sec of resume.sections) {
    if (!reordered.find((s) => s.id === sec.id)) {
      sec.order = reordered.length;
      reordered.push(sec);
    }
  }
  resume.sections = reordered;
  resume.updatedAt = new Date().toISOString();
}

export function deleteResume(resumes: Resume[], id: string): boolean {
  const idx = resumes.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  resumes.splice(idx, 1);
  return true;
}

/**
 * Professional memory search queries for resume building.
 * These are the semantic queries used to find relevant memories.
 */
export function getResumeSearchQueries(targetRole: string): string[] {
  return [
    `professional experience work ${targetRole}`,
    'skills technologies tools programming languages',
    'education degree university certification course',
    'projects built achievements accomplishments portfolio',
    'work history career job role responsibilities',
  ];
}
