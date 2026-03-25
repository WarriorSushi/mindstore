import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { retrieve } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';

/**
 * Newsletter Writer Plugin — Auto-curate weekly digests from your knowledge
 *
 * GET  ?action=newsletters      — List all newsletters
 * GET  ?action=newsletter&id=   — Get a single newsletter
 * GET  ?action=suggest          — AI-suggest a digest from recent memories
 * POST ?action=generate         — Generate newsletter from topic/timeframe + memories
 * POST ?action=update           — Update a newsletter (content, title, subject, status)
 * POST ?action=refine           — AI refine a section
 * POST ?action=delete           — Delete a newsletter
 */

const PLUGIN_SLUG = 'newsletter-writer';

// ─── Auto-install ────────────────────────────────────────────

async function ensurePluginInstalled() {
  const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  if ((existing as any[]).length === 0) {
    await db.execute(sql`
      INSERT INTO plugins (slug, name, description, type, status, icon, category)
      VALUES (
        ${PLUGIN_SLUG},
        'Newsletter Writer',
        'Auto-curate weekly digests from what you''ve learned. Edit and export.',
        'extension',
        'active',
        'Mail',
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

async function callAI(aiConfig: AIConfig, prompt: string, system: string, maxTokens = 8192): Promise<string | null> {
  try {
    if (aiConfig.type === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model}:generateContent?key=${aiConfig.key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    if (aiConfig.type === 'ollama') {
      const res = await fetch(`${aiConfig.url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          stream: false,
          options: { temperature: 0.7 },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.message?.content || null;
    }

    // OpenAI-compatible
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.key}`,
      ...(aiConfig.extraHeaders || {}),
    };
    const res = await fetch(aiConfig.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        temperature: 0.7,
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

interface NewsletterSection {
  id: string;
  type: 'intro' | 'topic' | 'highlight' | 'quicklinks' | 'reflection' | 'outro';
  title: string;
  content: string; // Markdown
  sourceCount: number;
}

interface Newsletter {
  id: string;
  title: string;
  subject: string;        // Email subject line
  period: string;          // e.g. "Mar 17–24, 2026"
  periodDays: number;      // 7, 14, 30
  tone: string;            // 'professional' | 'casual' | 'witty'
  sections: NewsletterSection[];
  wordCount: number;
  sourceCount: number;
  topicsCovered: string[];
  status: 'draft' | 'polishing' | 'ready';
  createdAt: string;
  updatedAt: string;
}

// ─── Storage ─────────────────────────────────────────────────

async function getNewsletters(): Promise<Newsletter[]> {
  const rows = await db.execute(
    sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`
  );
  const row = (rows as any[])[0];
  if (!row?.config) return [];
  const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  return config.newsletters || [];
}

async function saveNewsletters(newsletters: Newsletter[]) {
  // Max 20 newsletters stored
  const trimmed = newsletters.slice(0, 20);
  await db.execute(sql`
    UPDATE plugins 
    SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{newsletters}', ${JSON.stringify(trimmed)}::jsonb),
        updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

function generateId(): string {
  return `nl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateSectionId(): string {
  return `sec_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Period Helpers ──────────────────────────────────────────

function getPeriodLabel(days: number): string {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)}–${fmt(end)}, ${end.getFullYear()}`;
}

function getDateNDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString();
}

// ─── Tone Config ─────────────────────────────────────────────

const TONES: Record<string, string> = {
  professional: 'Polished and authoritative — suitable for a professional audience. Clear headings, concise paragraphs, actionable insights.',
  casual: 'Warm and conversational — like writing to a friend. Use "I" and "you", share honest reactions, be relatable.',
  witty: 'Sharp and clever — engaging hooks, surprising turns, memorable phrasing. Smart humor where appropriate.',
};

// ─── GET Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await ensurePluginInstalled();
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'newsletters';

    if (action === 'newsletters') {
      const newsletters = await getNewsletters();
      const summaries = newsletters
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
      return NextResponse.json({ newsletters: summaries });
    }

    if (action === 'newsletter') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const newsletters = await getNewsletters();
      const nl = newsletters.find(n => n.id === id);
      if (!nl) return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
      return NextResponse.json({ newsletter: nl });
    }

    if (action === 'suggest') {
      // Analyze recent memories and suggest newsletter themes
      const days = parseInt(searchParams.get('days') || '7');

      const sinceDate = getDateNDaysAgo(days);
      const recentMemories = await db.execute(sql`
        SELECT id, title, content, source_type, created_at
        FROM memories 
        WHERE user_id = ${userId} AND created_at >= ${sinceDate}::timestamp
        ORDER BY created_at DESC
        LIMIT 50
      `);

      const memoryList = recentMemories as any[];
      if (memoryList.length === 0) {
        return NextResponse.json({ 
          suggestion: null,
          message: `No memories found in the last ${days} days. Try a longer timeframe.`,
          memoryCount: 0,
        });
      }

      // Summarize for AI
      const knowledgeSummary = memoryList
        .map(m => `[${m.source_type || 'note'}] ${m.title || '(untitled)'}: ${(m.content || '').slice(0, 200)}`)
        .join('\n');

      const settingsRows = await db.execute(sql`SELECT key, value FROM settings`);
      const config: Record<string, string> = {};
      for (const r of settingsRows as any[]) config[r.key] = r.value;
      const aiConfig = getAIConfig(config);
      if (!aiConfig) {
        return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });
      }

      const system = `You are a newsletter editor analyzing someone's knowledge base to suggest themes for a personal digest.`;
      const prompt = `I added ${memoryList.length} items to my knowledge base in the last ${days} days. Here they are:

${knowledgeSummary}

Suggest 3 newsletter theme ideas I could write about. For each:
1. A catchy title for the newsletter issue
2. An email subject line (compelling, under 60 chars)
3. The main topics it would cover (2-4 topics)
4. A one-line pitch

Return ONLY a JSON array: [{ "title": string, "subject": string, "topics": string[], "pitch": string }]
No markdown fences, no explanation — just the JSON array.`;

      const result = await callAI(aiConfig, prompt, system, 2048);
      if (!result) {
        return NextResponse.json({ error: 'AI suggestion failed' }, { status: 500 });
      }

      try {
        const cleaned = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const suggestions = JSON.parse(cleaned);
        return NextResponse.json({ 
          suggestions, 
          memoryCount: memoryList.length,
          period: getPeriodLabel(days),
        });
      } catch {
        return NextResponse.json({ error: 'Failed to parse AI response', raw: result }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await ensurePluginInstalled();
    const userId = await getUserId();
    const body = await req.json();
    const action = body.action;

    if (action === 'generate') {
      const { 
        title, 
        subject,
        periodDays = 7, 
        tone = 'casual',
        focusTopics,   // optional: specific topics to focus on
        customPrompt,  // optional: additional instructions
      } = body;

      // 1. Fetch recent memories within the timeframe
      const sinceDate = getDateNDaysAgo(periodDays);
      const recentMemories = await db.execute(sql`
        SELECT id, title, content, source_type, created_at
        FROM memories 
        WHERE user_id = ${userId} AND created_at >= ${sinceDate}::timestamp
        ORDER BY created_at DESC
        LIMIT 60
      `);

      const memoryList = recentMemories as any[];
      if (memoryList.length === 0) {
        return NextResponse.json({ 
          error: `No memories found in the last ${periodDays} days. Import some content first or try a longer timeframe.` 
        }, { status: 400 });
      }

      // 2. If focusTopics provided, also do RAG search for each topic
      let topicMemories: any[] = [];
      if (focusTopics && focusTopics.length > 0) {
        for (const topic of focusTopics.slice(0, 4)) {
          let embedding: number[] | null = null;
          try {
            const embeddings = await generateEmbeddings([topic]);
            if (embeddings && embeddings.length > 0) embedding = embeddings[0];
          } catch { /* fallback */ }
          const results = await retrieve(topic, embedding, { userId, limit: 5 });
          topicMemories.push(...results);
        }
      }

      // 3. Deduplicate and build knowledge context
      const seenIds = new Set<string>();
      const allMemories: any[] = [];
      for (const m of [...memoryList, ...topicMemories]) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
          allMemories.push(m);
        }
      }

      const knowledgeContext = allMemories.slice(0, 40)
        .map((m, i) => `[${i + 1}] (${m.source_type || 'note'}) ${m.title || '(untitled)'}:\n${(m.content || '').slice(0, 600)}`)
        .join('\n\n---\n\n');

      // 4. Get AI config
      const settingsRows = await db.execute(sql`SELECT key, value FROM settings`);
      const config: Record<string, string> = {};
      for (const r of settingsRows as any[]) config[r.key] = r.value;
      const aiConfig = getAIConfig(config);
      if (!aiConfig) {
        return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });
      }

      // 5. Generate structured newsletter sections
      const period = getPeriodLabel(periodDays);
      const toneDesc = TONES[tone] || TONES.casual;

      const system = `You are a skilled newsletter writer. You create engaging, well-curated digests from someone's personal knowledge base. Critical rules:
- Write ONLY from the provided sources — never invent facts or links
- Create a structured newsletter with clear sections
- Each section should be self-contained and interesting
- Use markdown formatting
- Make it feel personal and insightful, not like a generic AI summary
- ${toneDesc}`;

      const prompt = `Create a newsletter issue: "${title || 'This Week in My Mind'}"
Subject: "${subject || 'What I learned this week'}"
Period: ${period} (last ${periodDays} days)
${focusTopics ? `Focus topics: ${focusTopics.join(', ')}` : ''}
${customPrompt ? `Additional instructions: ${customPrompt}` : ''}

Sources from my knowledge base (${allMemories.length} items):

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

      const result = await callAI(aiConfig, prompt, system, 8192);
      if (!result) {
        return NextResponse.json({ error: 'AI generation failed — try again' }, { status: 500 });
      }

      let sections: NewsletterSection[] = [];
      let topicsCovered: string[] = [];
      try {
        const cleaned = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        sections = parsed.map((s: any) => ({
          id: generateSectionId(),
          type: s.type || 'topic',
          title: s.title || 'Untitled Section',
          content: s.content || '',
          sourceCount: s.sourceCount || 0,
        }));
        topicsCovered = sections
          .filter(s => s.type === 'topic')
          .map(s => s.title);
      } catch {
        // Fallback: treat entire result as a single section
        sections = [{
          id: generateSectionId(),
          type: 'topic',
          title: 'This Week\'s Digest',
          content: result,
          sourceCount: allMemories.length,
        }];
        topicsCovered = ['General Digest'];
      }

      // Build newsletter object
      const totalWords = sections.reduce((sum, s) => sum + s.content.split(/\s+/).filter(Boolean).length, 0);
      const newsletter: Newsletter = {
        id: generateId(),
        title: title || 'This Week in My Mind',
        subject: subject || `What I learned — ${period}`,
        period,
        periodDays,
        tone,
        sections,
        wordCount: totalWords,
        sourceCount: allMemories.length,
        topicsCovered,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save
      const newsletters = await getNewsletters();
      newsletters.unshift(newsletter);
      await saveNewsletters(newsletters);

      return NextResponse.json({ newsletter });
    }

    if (action === 'update') {
      const { id, title, subject, content, sectionId, status } = body;
      if (!id) return NextResponse.json({ error: 'Missing newsletter id' }, { status: 400 });

      const newsletters = await getNewsletters();
      const idx = newsletters.findIndex(n => n.id === id);
      if (idx === -1) return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });

      if (title !== undefined) newsletters[idx].title = title;
      if (subject !== undefined) newsletters[idx].subject = subject;
      if (status !== undefined) newsletters[idx].status = status;

      // Update a specific section's content
      if (sectionId && content !== undefined) {
        const secIdx = newsletters[idx].sections.findIndex(s => s.id === sectionId);
        if (secIdx !== -1) {
          newsletters[idx].sections[secIdx].content = content;
        }
      }

      // Recalculate word count
      newsletters[idx].wordCount = newsletters[idx].sections
        .reduce((sum, s) => sum + s.content.split(/\s+/).filter(Boolean).length, 0);
      newsletters[idx].updatedAt = new Date().toISOString();

      await saveNewsletters(newsletters);
      return NextResponse.json({ newsletter: newsletters[idx] });
    }

    if (action === 'refine') {
      const { id, sectionId, instruction } = body;
      if (!id || !sectionId || !instruction) {
        return NextResponse.json({ error: 'Missing id, sectionId, or instruction' }, { status: 400 });
      }

      const newsletters = await getNewsletters();
      const nl = newsletters.find(n => n.id === id);
      if (!nl) return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });

      const section = nl.sections.find(s => s.id === sectionId);
      if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

      const settingsRows = await db.execute(sql`SELECT key, value FROM settings`);
      const config: Record<string, string> = {};
      for (const r of settingsRows as any[]) config[r.key] = r.value;
      const aiConfig = getAIConfig(config);
      if (!aiConfig) {
        return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });
      }

      const system = `You are a newsletter editor refining a section. Keep the same style and tone. Return ONLY the refined content in markdown — no explanation.`;
      const prompt = `Here is a newsletter section titled "${section.title}":

---
${section.content}
---

Refinement instruction: ${instruction}

Return ONLY the refined version. Keep markdown formatting.`;

      const refined = await callAI(aiConfig, prompt, system, 4096);
      if (!refined) {
        return NextResponse.json({ error: 'Refinement failed' }, { status: 500 });
      }

      return NextResponse.json({ refined, sectionId });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

      const newsletters = await getNewsletters();
      const filtered = newsletters.filter(n => n.id !== id);
      if (filtered.length === newsletters.length) {
        return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
      }
      await saveNewsletters(filtered);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
