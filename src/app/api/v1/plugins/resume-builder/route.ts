/**
 * Resume Builder Plugin — Route (thin wrapper)
 *
 * GET  ?action=list|get|templates
 * POST ?action=generate|update|refine|add-section|reorder|delete
 *
 * Logic delegated to src/server/plugins/ports/resume-builder.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { retrieve } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';
import {
  TEMPLATES,
  getResumes,
  saveResumes,
  canCreateResume,
  createResumeFromAI,
  updateResumeSection,
  addSection,
  reorderSections,
  deleteResume,
  buildGeneratePrompt,
  buildRefinePrompt,
  getProfessionalSearchQueries,
  parseResumeAIResponse,
  generateResumeId,
  generateSectionId,
  type Resume,
  type ResumeTemplate,
} from '@/server/plugins/ports/resume-builder';

const PLUGIN_SLUG = 'resume-builder';

// ─── Setup ───────────────────────────────────────────────────

async function ensurePluginInstalled() {
  const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  if ((existing as any[]).length === 0) {
    await db.execute(sql`INSERT INTO plugins (slug, name, description, type, status, icon, category) VALUES (${PLUGIN_SLUG}, 'Resume Builder', 'Build and maintain a professional resume from your memories.', 'extension', 'active', 'FileUser', 'action')`);
  }
}

// ─── AI Config ───────────────────────────────────────────────

interface AIConfig { type: 'openai-compatible' | 'gemini' | 'ollama'; url: string; key?: string; model: string; extraHeaders?: Record<string, string>; }

function getAIConfig(config: Record<string, string>): AIConfig | null {
  const p = config.chat_provider;
  const oai = config.openai_api_key || process.env.OPENAI_API_KEY;
  const gem = config.gemini_api_key || process.env.GEMINI_API_KEY;
  const oll = config.ollama_url || process.env.OLLAMA_URL;
  const orr = config.openrouter_api_key || process.env.OPENROUTER_API_KEY;
  const ck = config.custom_api_key, cu = config.custom_api_url, cm = config.custom_api_model;
  if (p === 'openrouter' && orr) return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: orr, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app' } };
  if (p === 'custom' && ck && cu) return { type: 'openai-compatible', url: cu, key: ck, model: cm || 'default' };
  if (p === 'gemini' && gem) return { type: 'gemini', url: '', key: gem, model: 'gemini-2.0-flash' };
  if (p === 'openai' && oai) return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: oai, model: 'gpt-4o-mini' };
  if (p === 'ollama' && oll) return { type: 'ollama', url: oll, model: 'llama3.2' };
  if (gem) return { type: 'gemini', url: '', key: gem, model: 'gemini-2.0-flash' };
  if (oai) return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: oai, model: 'gpt-4o-mini' };
  if (orr) return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: orr, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app' } };
  if (ck && cu) return { type: 'openai-compatible', url: cu, key: ck, model: cm || 'default' };
  if (oll) return { type: 'ollama', url: oll, model: 'llama3.2' };
  return null;
}

async function callAI(ai: AIConfig, prompt: string, system: string, maxTokens = 6000): Promise<string | null> {
  try {
    if (ai.type === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ai.model}:generateContent?key=${ai.key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens } }) });
      return res.ok ? ((await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || null) : null;
    }
    if (ai.type === 'ollama') {
      const res = await fetch(`${ai.url.replace(/\/$/, '')}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: ai.model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], stream: false, options: { temperature: 0.3, num_predict: maxTokens } }) });
      return res.ok ? ((await res.json()).message?.content || null) : null;
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(ai.key ? { Authorization: `Bearer ${ai.key}` } : {}), ...(ai.extraHeaders || {}) };
    const res = await fetch(ai.url, { method: 'POST', headers, body: JSON.stringify({ model: ai.model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature: 0.3, max_tokens: maxTokens }) });
    return res.ok ? ((await res.json()).choices?.[0]?.message?.content || null) : null;
  } catch { return null; }
}

async function getUserConfig(): Promise<Record<string, string>> {
  try { const rows = await db.execute(sql`SELECT key, value FROM settings`); const c: Record<string, string> = {}; for (const r of rows as any[]) c[r.key] = r.value; return c; } catch { return {}; }
}

// ─── Memory Search ───────────────────────────────────────────

async function searchProfessionalMemories(targetRole: string, userId: string) {
  const queries = getProfessionalSearchQueries(targetRole);
  const allResults = new Map<string, { content: string; title: string; id: string }>();

  for (const query of queries) {
    try {
      const emb = await generateEmbeddings([query]);
      const results = await retrieve(query, emb?.[0] || null, { userId, limit: 8 });
      for (const r of results) {
        if (!allResults.has(r.memoryId)) allResults.set(r.memoryId, { content: r.content.slice(0, 2000), title: r.sourceTitle || 'Untitled', id: r.memoryId });
      }
    } catch {}
  }

  try {
    const facts = await db.execute(sql`SELECT fact, category FROM user_facts ORDER BY confidence DESC LIMIT 20`);
    if ((facts as any[]).length > 0) {
      allResults.set('__user_facts__', { content: (facts as any[]).map((f: any) => `[${f.category}] ${f.fact}`).join('\n'), title: 'User Profile Facts', id: '__user_facts__' });
    }
  } catch {}

  return Array.from(allResults.values()).slice(0, 30);
}

// ─── GET Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await ensurePluginInstalled();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';

    if (action === 'templates') return NextResponse.json({ templates: TEMPLATES });

    const resumes = await getResumes();

    if (action === 'list') {
      return NextResponse.json({ resumes: resumes.map(r => ({
        id: r.id, title: r.title, targetRole: r.targetRole, template: r.template,
        sectionCount: r.sections.filter(s => s.visible).length, sourceCount: r.sourceCount,
        createdAt: r.createdAt, updatedAt: r.updatedAt,
        preview: r.sections.find(s => s.type === 'summary')?.content?.slice(0, 150) || '',
      })) });
    }

    if (action === 'get') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const resume = resumes.find(r => r.id === id);
      if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
      return NextResponse.json({ resume });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
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

    if (action === 'generate') {
      const { targetRole, template = 'modern', additionalContext = '' } = body;
      if (!targetRole) return NextResponse.json({ error: 'Target role required' }, { status: 400 });
      const resumes = await getResumes();
      if (!canCreateResume(resumes.length)) return NextResponse.json({ error: 'Maximum resumes reached. Delete one to create new.' }, { status: 400 });
      const aiConfig = getAIConfig(userConfig);
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured.' }, { status: 400 });

      const memories = await searchProfessionalMemories(targetRole, userId);
      if (!memories.length) return NextResponse.json({ error: 'No relevant memories found.' }, { status: 400 });

      const templateConfig = TEMPLATES.find(t => t.id === template) || TEMPLATES[0];
      const memoryContext = memories.filter(m => m.id !== '__user_facts__').map((m, i) => `[Memory ${i + 1}: ${m.title}]\n${m.content}`).join('\n\n---\n\n');
      const userFacts = memories.find(m => m.id === '__user_facts__')?.content || '';
      const { system, prompt } = buildGeneratePrompt(targetRole, templateConfig, memoryContext, userFacts, additionalContext || '');
      const aiResult = await callAI(aiConfig, prompt, system, 6000);
      if (!aiResult) return NextResponse.json({ error: 'AI generation failed.' }, { status: 500 });

      const sections = parseResumeAIResponse(aiResult);
      if (!sections.length) return NextResponse.json({ error: 'Failed to parse AI response.' }, { status: 500 });

      const sourceMemoryIds = memories.filter(m => m.id !== '__user_facts__').map(m => m.id);
      const resume = createResumeFromAI(targetRole, template, sections, sourceMemoryIds);
      resumes.unshift(resume);
      await saveResumes(resumes);
      return NextResponse.json({ resume });
    }

    if (action === 'update') {
      const { id, sectionId: secId, content, title, visible, resumeTitle, targetRole } = body;
      if (!id) return NextResponse.json({ error: 'Missing resume id' }, { status: 400 });
      const resumes = await getResumes();
      const idx = resumes.findIndex(r => r.id === id);
      if (idx === -1) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
      if (secId) {
        try { await updateResumeSection(id, secId, { content, title, visible }); } catch { return NextResponse.json({ error: 'Section not found' }, { status: 404 }); }
      }
      // Re-fetch after section update and apply resume-level changes
      const updated = await getResumes();
      const uidx = updated.findIndex(r => r.id === id);
      if (uidx === -1) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
      if (resumeTitle) updated[uidx].title = resumeTitle;
      if (targetRole) updated[uidx].targetRole = targetRole;
      updated[uidx].updatedAt = new Date().toISOString();
      await saveResumes(updated);
      return NextResponse.json({ resume: updated[uidx] });
    }

    if (action === 'refine') {
      const { id, sectionId: secId, instruction } = body;
      if (!id || !secId) return NextResponse.json({ error: 'Missing id or sectionId' }, { status: 400 });
      const resumes = await getResumes();
      const resume = resumes.find(r => r.id === id);
      if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
      const section = resume.sections.find(s => s.id === secId);
      if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });
      const aiConfig = getAIConfig(userConfig);
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });
      const { system, prompt } = buildRefinePrompt(resume.targetRole, section.title, section.content, instruction);
      const refined = await callAI(aiConfig, prompt, system, 3000);
      if (!refined) return NextResponse.json({ error: 'AI refinement failed' }, { status: 500 });
      section.content = refined.trim();
      resume.updatedAt = new Date().toISOString();
      await saveResumes(resumes);
      return NextResponse.json({ section });
    }

    if (action === 'add-section') {
      const { id, title = 'Custom Section', type = 'custom' } = body;
      if (!id) return NextResponse.json({ error: 'Missing resume id' }, { status: 400 });
      try {
        const { section: newSection, resume } = await addSection(id, title, type);
        return NextResponse.json({ section: newSection, resume });
      } catch { return NextResponse.json({ error: 'Resume not found' }, { status: 404 }); }
    }

    if (action === 'reorder') {
      const { id, sectionIds } = body;
      if (!id || !sectionIds) return NextResponse.json({ error: 'Missing id or sectionIds' }, { status: 400 });
      try {
        const updatedResume = await reorderSections(id, sectionIds);
        return NextResponse.json({ resume: updatedResume });
      } catch { return NextResponse.json({ error: 'Resume not found' }, { status: 404 }); }
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const resumes = await getResumes();
      const idx = resumes.findIndex(r => r.id === id);
      if (idx === -1) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
      resumes.splice(idx, 1);
      await saveResumes(resumes);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
