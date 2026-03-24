import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { retrieve } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';

/**
 * Resume Builder Plugin — Build professional resumes from your memories
 *
 * GET  ?action=list              — List saved resumes
 * GET  ?action=get&id=           — Get a single resume
 * GET  ?action=templates         — List available templates
 * POST ?action=generate          — Generate a new resume from memories
 * POST ?action=update            — Update resume content
 * POST ?action=refine            — AI-refine a specific section
 * POST ?action=add-section       — Add a custom section
 * POST ?action=reorder           — Reorder sections
 * POST ?action=delete            — Delete a resume
 */

const PLUGIN_SLUG = 'resume-builder';
const MAX_RESUMES = 10;

// ─── Auto-install ────────────────────────────────────────────

async function ensurePluginInstalled() {
  const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  if ((existing as any[]).length === 0) {
    await db.execute(sql`
      INSERT INTO plugins (slug, name, description, type, status, icon, category)
      VALUES (
        ${PLUGIN_SLUG},
        'Resume Builder',
        'Build and maintain a professional resume from your memories. AI-powered, always up to date.',
        'extension',
        'active',
        'FileUser',
        'action'
      )
    `);
  }
}

// ─── AI Config ───────────────────────────────────────────────

interface AIConfig {
  type: 'openai-compatible' | 'gemini' | 'ollama';
  url: string;
  key?: string;
  model: string;
  extraHeaders?: Record<string, string>;
}

function getAIConfig(config: Record<string, string>): AIConfig | null {
  const preferred = config.chat_provider;
  const openaiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
  const geminiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;
  const ollamaUrl = config.ollama_url || process.env.OLLAMA_URL;
  const openrouterKey = config.openrouter_api_key || process.env.OPENROUTER_API_KEY;
  const customKey = config.custom_api_key;
  const customUrl = config.custom_api_url;
  const customModel = config.custom_api_model;

  if (preferred === 'openrouter' && openrouterKey) {
    return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  }
  if (preferred === 'custom' && customKey && customUrl) {
    return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  }
  if (preferred === 'gemini' && geminiKey) {
    return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash' };
  }
  if (preferred === 'openai' && openaiKey) {
    return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  }
  if (preferred === 'ollama' && ollamaUrl) {
    return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };
  }

  if (geminiKey) return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash' };
  if (openaiKey) return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  if (openrouterKey) return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  if (customKey && customUrl) return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  if (ollamaUrl) return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };
  return null;
}

async function callAI(aiConfig: AIConfig, prompt: string, system: string, maxTokens = 6000): Promise<string | null> {
  try {
    if (aiConfig.type === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model}:generateContent?key=${aiConfig.key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (aiConfig.key) headers['Authorization'] = `Bearer ${aiConfig.key}`;
    if (aiConfig.extraHeaders) Object.assign(headers, aiConfig.extraHeaders);

    const url = aiConfig.type === 'ollama'
      ? `${aiConfig.url.replace(/\/$/, '')}/api/chat`
      : aiConfig.url;

    if (aiConfig.type === 'ollama') {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          stream: false,
          options: { temperature: 0.3, num_predict: maxTokens },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.message?.content || null;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// ─── Types ───────────────────────────────────────────────────

interface ResumeSection {
  id: string;
  type: 'header' | 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'certifications' | 'languages' | 'interests' | 'custom';
  title: string;
  content: string; // markdown content
  visible: boolean;
  order: number;
}

interface Resume {
  id: string;
  title: string; // "Software Engineer Resume", "Product Manager CV"
  targetRole: string;
  template: string;
  sections: ResumeSection[];
  sourceMemoryIds: string[];
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────

function generateId(): string {
  return `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sectionId(): string {
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getPluginConfig(): Promise<Record<string, any>> {
  try {
    const rows = await db.execute(sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
    return (rows as any[])?.[0]?.config || {};
  } catch {
    return {};
  }
}

async function savePluginConfig(config: Record<string, any>) {
  await db.execute(sql`
    UPDATE plugins SET config = ${JSON.stringify(config)}::jsonb, updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

async function getUserConfig(): Promise<Record<string, string>> {
  try {
    const rows = await db.execute(sql`SELECT key, value FROM settings`);
    const config: Record<string, string> = {};
    for (const row of rows as any[]) {
      config[row.key] = row.value;
    }
    return config;
  } catch {
    return {};
  }
}

// ─── Search professional memories ────────────────────────────

async function searchProfessionalMemories(targetRole: string, userId: string): Promise<{ content: string; title: string; id: string }[]> {
  const queries = [
    `professional experience work ${targetRole}`,
    'skills technologies tools programming languages',
    'education degree university certification course',
    'projects built achievements accomplishments portfolio',
    'work history career job role responsibilities',
  ];

  const allResults: Map<string, { content: string; title: string; id: string }> = new Map();

  for (const query of queries) {
    try {
      const embeddings = await generateEmbeddings([query]);
      let embedding: number[] | null = null;
      if (embeddings && embeddings.length > 0) embedding = embeddings[0];
      const results = await retrieve(query, embedding, { userId, limit: 8 });
      for (const r of results) {
        if (!allResults.has(r.memoryId)) {
          allResults.set(r.memoryId, {
            content: r.content.slice(0, 2000),
            title: r.sourceTitle || 'Untitled',
            id: r.memoryId,
          });
        }
      }
    } catch {
      continue;
    }
  }

  // Also search for user facts/profile
  try {
    const facts = await db.execute(sql`SELECT fact, category FROM user_facts ORDER BY confidence DESC LIMIT 20`);
    if ((facts as any[]).length > 0) {
      const factText = (facts as any[]).map((f: any) => `[${f.category}] ${f.fact}`).join('\n');
      allResults.set('__user_facts__', {
        content: factText,
        title: 'User Profile Facts',
        id: '__user_facts__',
      });
    }
  } catch {
    // user_facts table may not exist
  }

  return Array.from(allResults.values()).slice(0, 30);
}

// ─── TEMPLATES ───────────────────────────────────────────────

const TEMPLATES = [
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

// ─── SECTION DEFAULTS ────────────────────────────────────────

const SECTION_DEFAULTS: Record<string, { title: string; type: ResumeSection['type'] }> = {
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

// ─── GET Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await ensurePluginInstalled();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';

    if (action === 'templates') {
      return NextResponse.json({ templates: TEMPLATES });
    }

    const pluginConfig = await getPluginConfig();
    const resumes: Resume[] = pluginConfig.resumes || [];

    if (action === 'list') {
      const summaries = resumes.map((r) => ({
        id: r.id,
        title: r.title,
        targetRole: r.targetRole,
        template: r.template,
        sectionCount: r.sections.filter((s) => s.visible).length,
        sourceCount: r.sourceCount,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        preview: r.sections.find((s) => s.type === 'summary')?.content?.slice(0, 150) || '',
      }));
      return NextResponse.json({ resumes: summaries });
    }

    if (action === 'get') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const resume = resumes.find((r) => r.id === id);
      if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
      return NextResponse.json({ resume });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('[resume-builder] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await ensurePluginInstalled();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || '';
    const body = await req.json().catch(() => ({}));
    const userId = await getUserId();

    const userConfig = await getUserConfig();
    const pluginConfig = await getPluginConfig();
    const resumes: Resume[] = pluginConfig.resumes || [];

    // ─── Generate ────────────────────────────────────────────

    if (action === 'generate') {
      const { targetRole, template = 'modern', additionalContext = '' } = body;
      if (!targetRole) return NextResponse.json({ error: 'Target role required' }, { status: 400 });
      if (resumes.length >= MAX_RESUMES) {
        return NextResponse.json({ error: `Maximum ${MAX_RESUMES} resumes. Delete one to create new.` }, { status: 400 });
      }

      const aiConfig = getAIConfig(userConfig);
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured. Go to Settings.' }, { status: 400 });

      // Search memories for professional content
      const memories = await searchProfessionalMemories(targetRole, userId);
      if (memories.length === 0) {
        return NextResponse.json({ error: 'No relevant memories found. Import some professional content first.' }, { status: 400 });
      }

      const memoryContext = memories
        .filter((m) => m.id !== '__user_facts__')
        .map((m, i) => `[Memory ${i + 1}: ${m.title}]\n${m.content}`)
        .join('\n\n---\n\n');

      const userFacts = memories.find((m) => m.id === '__user_facts__')?.content || '';

      const templateConfig = TEMPLATES.find((t) => t.id === template) || TEMPLATES[0];
      const sectionList = templateConfig.sections;

      const system = `You are an expert resume writer who creates ATS-optimized, compelling professional resumes.

RULES:
- Use strong action verbs (Led, Architected, Shipped, Grew, Optimized)
- Quantify achievements with metrics wherever possible (%, $, numbers)
- Be concise — each bullet should be one impactful line
- Tailor content to the target role
- Use markdown formatting
- Be honest — only use information from the provided memories
- If there's not enough info for a section, write a placeholder with [TODO: ...]`;

      const prompt = `Generate a professional resume for: **${targetRole}**

Template: ${templateConfig.name} (${templateConfig.description})

${userFacts ? `USER PROFILE:\n${userFacts}\n\n` : ''}

MEMORIES TO EXTRACT FROM:
${memoryContext}

${additionalContext ? `ADDITIONAL CONTEXT:\n${additionalContext}\n\n` : ''}

Generate each of these sections in order. Return ONLY valid JSON (no markdown wrapping), with this exact structure:
{
  "sections": [
    ${sectionList.map((s) => {
      const def = SECTION_DEFAULTS[s] || { title: s, type: s };
      return `{ "type": "${def.type}", "title": "${def.title}", "content": "markdown content here" }`;
    }).join(',\n    ')}
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

      const aiResult = await callAI(aiConfig, prompt, system, 6000);
      if (!aiResult) {
        return NextResponse.json({ error: 'AI generation failed. Try again.' }, { status: 500 });
      }

      // Parse JSON from response
      let parsed: any;
      try {
        const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch?.[0] || aiResult);
      } catch {
        return NextResponse.json({ error: 'Failed to parse AI response. Try again.' }, { status: 500 });
      }

      const sections: ResumeSection[] = (parsed.sections || []).map((s: any, i: number) => ({
        id: sectionId(),
        type: s.type || 'custom',
        title: s.title || 'Section',
        content: s.content || '',
        visible: true,
        order: i,
      }));

      const sourceMemoryIds = memories.filter((m) => m.id !== '__user_facts__').map((m) => m.id);

      const resume: Resume = {
        id: generateId(),
        title: `${targetRole} Resume`,
        targetRole,
        template,
        sections,
        sourceMemoryIds,
        sourceCount: sourceMemoryIds.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      resumes.unshift(resume);
      await savePluginConfig({ ...pluginConfig, resumes });
      return NextResponse.json({ resume });
    }

    // ─── Update resume (edit section content) ────────────────

    if (action === 'update') {
      const { id, sectionId: secId, content, title, visible } = body;
      if (!id) return NextResponse.json({ error: 'Missing resume id' }, { status: 400 });

      const idx = resumes.findIndex((r) => r.id === id);
      if (idx === -1) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

      if (secId) {
        const secIdx = resumes[idx].sections.findIndex((s) => s.id === secId);
        if (secIdx === -1) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

        if (content !== undefined) resumes[idx].sections[secIdx].content = content;
        if (title !== undefined) resumes[idx].sections[secIdx].title = title;
        if (visible !== undefined) resumes[idx].sections[secIdx].visible = visible;
      }

      // Update resume-level fields
      if (body.resumeTitle) resumes[idx].title = body.resumeTitle;
      if (body.targetRole) resumes[idx].targetRole = body.targetRole;

      resumes[idx].updatedAt = new Date().toISOString();
      await savePluginConfig({ ...pluginConfig, resumes });
      return NextResponse.json({ resume: resumes[idx] });
    }

    // ─── Refine a section with AI ────────────────────────────

    if (action === 'refine') {
      const { id, sectionId: secId, instruction } = body;
      if (!id || !secId) return NextResponse.json({ error: 'Missing id or sectionId' }, { status: 400 });

      const resume = resumes.find((r) => r.id === id);
      if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

      const section = resume.sections.find((s) => s.id === secId);
      if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

      const aiConfig = getAIConfig(userConfig);
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });

      const system = `You are an expert resume writer. You refine resume sections to be more impactful, ATS-friendly, and compelling. Return ONLY the refined markdown content, nothing else.`;

      const prompt = `Target role: ${resume.targetRole}

Section: ${section.title}
Current content:
${section.content}

${instruction ? `User instruction: ${instruction}` : 'Make it more impactful with stronger action verbs, metrics, and concise language.'}

Return ONLY the refined markdown content.`;

      const refined = await callAI(aiConfig, prompt, system, 3000);
      if (!refined) return NextResponse.json({ error: 'AI refinement failed' }, { status: 500 });

      const idx = resumes.findIndex((r) => r.id === id);
      const secIdx = resumes[idx].sections.findIndex((s) => s.id === secId);
      resumes[idx].sections[secIdx].content = refined.trim();
      resumes[idx].updatedAt = new Date().toISOString();

      await savePluginConfig({ ...pluginConfig, resumes });
      return NextResponse.json({ section: resumes[idx].sections[secIdx] });
    }

    // ─── Add custom section ──────────────────────────────────

    if (action === 'add-section') {
      const { id, title = 'Custom Section', type = 'custom' } = body;
      if (!id) return NextResponse.json({ error: 'Missing resume id' }, { status: 400 });

      const idx = resumes.findIndex((r) => r.id === id);
      if (idx === -1) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

      const newSection: ResumeSection = {
        id: sectionId(),
        type: type as ResumeSection['type'],
        title,
        content: '',
        visible: true,
        order: resumes[idx].sections.length,
      };

      resumes[idx].sections.push(newSection);
      resumes[idx].updatedAt = new Date().toISOString();
      await savePluginConfig({ ...pluginConfig, resumes });
      return NextResponse.json({ section: newSection, resume: resumes[idx] });
    }

    // ─── Reorder sections ────────────────────────────────────

    if (action === 'reorder') {
      const { id, sectionIds } = body;
      if (!id || !sectionIds) return NextResponse.json({ error: 'Missing id or sectionIds' }, { status: 400 });

      const idx = resumes.findIndex((r) => r.id === id);
      if (idx === -1) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

      const reordered: ResumeSection[] = [];
      for (const sid of sectionIds as string[]) {
        const sec = resumes[idx].sections.find((s) => s.id === sid);
        if (sec) {
          sec.order = reordered.length;
          reordered.push(sec);
        }
      }
      // Add any sections not in the reorder list
      for (const sec of resumes[idx].sections) {
        if (!reordered.find((s) => s.id === sec.id)) {
          sec.order = reordered.length;
          reordered.push(sec);
        }
      }

      resumes[idx].sections = reordered;
      resumes[idx].updatedAt = new Date().toISOString();
      await savePluginConfig({ ...pluginConfig, resumes });
      return NextResponse.json({ resume: resumes[idx] });
    }

    // ─── Delete ──────────────────────────────────────────────

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

      const idx = resumes.findIndex((r) => r.id === id);
      if (idx === -1) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

      resumes.splice(idx, 1);
      await savePluginConfig({ ...pluginConfig, resumes });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('[resume-builder] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
