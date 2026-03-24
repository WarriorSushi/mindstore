import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { retrieve } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';

/**
 * Conversation Prep Plugin — Brief me before any meeting or conversation
 *
 * GET  ?action=history           — List past briefings
 * GET  ?action=briefing&id=      — Get a single briefing
 * POST ?action=prepare           — Generate a new briefing
 * POST ?action=delete            — Delete a briefing
 * POST ?action=follow-up         — Ask a follow-up question about a briefing
 */

const PLUGIN_SLUG = 'conversation-prep';

// ─── Auto-install ────────────────────────────────────────────

async function ensurePluginInstalled() {
  const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  if ((existing as any[]).length === 0) {
    await db.execute(sql`
      INSERT INTO plugins (slug, name, description, type, status, icon, category)
      VALUES (
        ${PLUGIN_SLUG},
        'Conversation Prep',
        'Get briefed before any meeting or conversation — everything you know about a person or topic, organized.',
        'extension',
        'active',
        'Users',
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

async function callAI(aiConfig: AIConfig, prompt: string, system: string, maxTokens = 4096): Promise<string | null> {
  try {
    if (aiConfig.type === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.model}:generateContent?key=${aiConfig.key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens },
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
          options: { temperature: 0.4 },
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
        temperature: 0.4,
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

interface Briefing {
  id: string;
  subject: string;        // Person name or topic
  type: 'person' | 'topic' | 'company' | 'project';
  context?: string;       // Optional context about the meeting
  sections: BriefingSection[];
  sourceCount: number;
  sourceMemoryIds: string[];
  createdAt: string;
}

interface BriefingSection {
  title: string;
  icon: string;           // Lucide icon name
  items: string[];
}

// ─── Storage ─────────────────────────────────────────────────

async function getBriefings(): Promise<Briefing[]> {
  const rows = await db.execute(
    sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`
  );
  const row = (rows as any[])[0];
  if (!row?.config) return [];
  const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  return config.briefings || [];
}

async function saveBriefings(briefings: Briefing[]) {
  await db.execute(sql`
    UPDATE plugins 
    SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{briefings}', ${JSON.stringify(briefings)}::jsonb),
        updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

function generateId(): string {
  return `bp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── GET Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await ensurePluginInstalled();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'history';

    if (action === 'history') {
      const briefings = await getBriefings();
      // Return summaries sorted by newest first
      const summaries = briefings
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
      return NextResponse.json({ briefings: summaries });
    }

    if (action === 'briefing') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const briefings = await getBriefings();
      const briefing = briefings.find(b => b.id === id);
      if (!briefing) return NextResponse.json({ error: 'Briefing not found' }, { status: 404 });
      return NextResponse.json({ briefing });
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

    if (action === 'prepare') {
      const { subject, type = 'topic', context = '' } = body;
      if (!subject?.trim()) {
        return NextResponse.json({ error: 'Subject required — who or what are you meeting about?' }, { status: 400 });
      }

      // 1. Build multi-query search strategy for comprehensive retrieval
      const searchQueries = [subject];
      
      // Add context-enriched queries
      if (context) {
        searchQueries.push(`${subject} ${context}`);
      }
      
      // Type-specific queries
      if (type === 'person') {
        searchQueries.push(`${subject} conversation`, `${subject} meeting notes`, `${subject} project`);
      } else if (type === 'company') {
        searchQueries.push(`${subject} business`, `${subject} product`, `${subject} partnership`);
      } else if (type === 'project') {
        searchQueries.push(`${subject} status`, `${subject} issues`, `${subject} decisions`);
      } else {
        searchQueries.push(`${subject} notes`, `${subject} insights`);
      }

      // 2. Execute multi-query retrieval and deduplicate
      const allResults: any[] = [];
      const seenIds = new Set<string>();

      for (const query of searchQueries.slice(0, 5)) {
        let embedding: number[] | null = null;
        try {
          const embeddings = await generateEmbeddings([query]);
          if (embeddings && embeddings.length > 0) embedding = embeddings[0];
        } catch { /* fallback */ }

        const results = await retrieve(query, embedding, {
          userId,
          limit: 8,
        });

        for (const r of results) {
          if (!seenIds.has(r.memoryId)) {
            seenIds.add(r.memoryId);
            allResults.push(r);
          }
        }
      }

      if (allResults.length === 0) {
        return NextResponse.json({ 
          error: `No relevant memories found about "${subject}". Try adding more knowledge first, or check the spelling.` 
        }, { status: 400 });
      }

      // Sort by score and take top results
      allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      const topResults = allResults.slice(0, 20);

      // 3. Build knowledge context
      const knowledgeContext = topResults
        .map((m: any, i: number) => {
          const date = m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown date';
          return `[Source ${i + 1} | ${m.sourceType || 'note'} | ${date}] ${m.sourceTitle || '(untitled)'}:\n${m.content?.slice(0, 600) || ''}`;
        })
        .join('\n\n---\n\n');

      // 4. Get AI config
      const settingsRows = await db.execute(sql`SELECT key, value FROM settings`);
      const config: Record<string, string> = {};
      for (const r of settingsRows as any[]) config[r.key] = r.value;
      const aiConfig = getAIConfig(config);
      if (!aiConfig) {
        return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });
      }

      // 5. Generate structured briefing
      const typeLabel = type === 'person' ? 'person' : type === 'company' ? 'company/organization' : type === 'project' ? 'project' : 'topic';
      
      const system = `You are a brilliant executive assistant preparing a comprehensive briefing. You extract and organize relevant information from the user's personal knowledge base. You ONLY use information from the provided sources — never invent facts. Be specific, cite dates when available, and surface non-obvious connections. If the sources don't contain certain information, say so honestly rather than making things up.`;

      const prompt = `Prepare a comprehensive briefing about this ${typeLabel}: "${subject}"
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

Icon options: "User" (for overview/person info), "ListChecks" (for key facts), "Clock" (for history/timeline), "Network" (for related topics), "MessageCircle" (for talking points), "HelpCircle" (for questions), "ClipboardList" (for prep notes).

Be specific and actionable. Each item should be a single, clear statement. No markdown fences around the JSON — just the raw JSON.`;

      const result = await callAI(aiConfig, prompt, system, 4096);
      if (!result) {
        return NextResponse.json({ error: 'AI generation failed — try again' }, { status: 500 });
      }

      let sections: BriefingSection[] = [];
      try {
        const cleaned = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        sections = parsed.sections || [];
      } catch {
        // Fallback: try to extract sections from text
        sections = [{
          title: 'Briefing',
          icon: 'User',
          items: [result.slice(0, 2000)],
        }];
      }

      // Filter out empty sections
      sections = sections.filter(s => s.items && s.items.length > 0);

      if (sections.length === 0) {
        return NextResponse.json({ error: 'Could not generate a meaningful briefing from available knowledge' }, { status: 500 });
      }

      // 6. Create briefing object
      const briefing: Briefing = {
        id: generateId(),
        subject,
        type,
        context: context || undefined,
        sections,
        sourceCount: topResults.length,
        sourceMemoryIds: topResults.map((m: any) => m.memoryId).filter(Boolean),
        createdAt: new Date().toISOString(),
      };

      // 7. Save
      const briefings = await getBriefings();
      briefings.push(briefing);
      // Keep last 50 briefings
      if (briefings.length > 50) briefings.splice(0, briefings.length - 50);
      await saveBriefings(briefings);

      return NextResponse.json({ briefing });
    }

    if (action === 'follow-up') {
      const { id, question } = body;
      if (!id || !question?.trim()) {
        return NextResponse.json({ error: 'Missing briefing id or question' }, { status: 400 });
      }

      const briefings = await getBriefings();
      const briefing = briefings.find(b => b.id === id);
      if (!briefing) return NextResponse.json({ error: 'Briefing not found' }, { status: 404 });

      // Re-search for more specific info
      let embedding: number[] | null = null;
      try {
        const embeddings = await generateEmbeddings([`${briefing.subject} ${question}`]);
        if (embeddings && embeddings.length > 0) embedding = embeddings[0];
      } catch { /* fallback */ }

      const results = await retrieve(`${briefing.subject} ${question}`, embedding, {
        userId,
        limit: 10,
      });

      const knowledgeContext = results
        .map((m: any, i: number) => `[${i + 1}] ${m.sourceTitle || '(untitled)'}: ${m.content?.slice(0, 500) || ''}`)
        .join('\n\n');

      const settingsRows = await db.execute(sql`SELECT key, value FROM settings`);
      const config: Record<string, string> = {};
      for (const r of settingsRows as any[]) config[r.key] = r.value;
      const aiConfig = getAIConfig(config);
      if (!aiConfig) {
        return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });
      }

      const briefingContext = briefing.sections
        .map(s => `${s.title}:\n${s.items.map(i => `- ${i}`).join('\n')}`)
        .join('\n\n');

      const system = `You are an executive assistant answering a follow-up question about a briefing. Use ONLY information from the provided sources. Be specific and concise.`;
      const prompt = `Previous briefing about "${briefing.subject}":\n${briefingContext}\n\nAdditional knowledge:\n${knowledgeContext}\n\nFollow-up question: ${question}\n\nAnswer concisely and specifically. If the answer isn't in the sources, say so.`;

      const answer = await callAI(aiConfig, prompt, system, 1024);
      if (!answer) {
        return NextResponse.json({ error: 'Failed to generate answer' }, { status: 500 });
      }

      return NextResponse.json({ answer });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      
      const briefings = await getBriefings();
      const filtered = briefings.filter(b => b.id !== id);
      if (filtered.length === briefings.length) {
        return NextResponse.json({ error: 'Briefing not found' }, { status: 404 });
      }
      await saveBriefings(filtered);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
