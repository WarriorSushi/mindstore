import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { retrieve } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';

/**
 * Blog Draft Generator Plugin — Turn your knowledge into polished blog posts
 *
 * GET  ?action=drafts           — List all saved drafts
 * GET  ?action=draft&id=        — Get a single draft
 * GET  ?action=topics           — Get AI-suggested topics based on your knowledge
 * POST ?action=generate         — Generate a blog draft from topic + relevant memories
 * POST ?action=save             — Save/update a draft
 * POST ?action=delete           — Delete a draft
 * POST ?action=refine           — Refine/edit a section with AI
 * POST ?action=export           — Export draft as markdown or HTML
 */

const PLUGIN_SLUG = 'blog-draft-generator';

// ─── Auto-install ────────────────────────────────────────────

async function ensurePluginInstalled() {
  const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  if ((existing as any[]).length === 0) {
    await db.execute(sql`
      INSERT INTO plugins (slug, name, description, type, status, icon, category)
      VALUES (
        ${PLUGIN_SLUG},
        'Blog Draft Generator',
        'Turn your memories into polished, publishable blog posts — written from YOUR knowledge.',
        'extension',
        'active',
        'FileEdit',
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

interface BlogDraft {
  id: string;
  title: string;
  topic: string;
  style: string;   // 'technical' | 'casual' | 'storytelling' | 'tutorial' | 'opinion'
  tone: string;     // 'professional' | 'conversational' | 'academic' | 'witty'
  content: string;  // Markdown content
  outline: string[];
  wordCount: number;
  sourceMemoryIds: string[];
  sourceCount: number;
  status: 'draft' | 'refining' | 'ready';
  createdAt: string;
  updatedAt: string;
}

// ─── Storage ─────────────────────────────────────────────────

async function getDrafts(): Promise<BlogDraft[]> {
  const rows = await db.execute(
    sql`SELECT config FROM plugins WHERE slug = ${PLUGIN_SLUG}`
  );
  const row = (rows as any[])[0];
  if (!row?.config) return [];
  const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  return config.drafts || [];
}

async function saveDrafts(drafts: BlogDraft[]) {
  await db.execute(sql`
    UPDATE plugins 
    SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{drafts}', ${JSON.stringify(drafts)}::jsonb),
        updated_at = NOW()
    WHERE slug = ${PLUGIN_SLUG}
  `);
}

function generateId(): string {
  return `bd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Styles & Tones ──────────────────────────────────────────

const STYLES = {
  technical: 'Technical deep-dive with code examples, architecture diagrams, and precise terminology',
  casual: 'Relaxed, first-person narrative with personality and humor — like talking to a smart friend',
  storytelling: 'Narrative arc with a hook, building tension, climax, and takeaway — almost like a short story',
  tutorial: 'Step-by-step guide with clear instructions, numbered steps, and practical outcomes',
  opinion: 'Thought leadership piece — strong thesis, evidence, counterarguments, and a call to action',
};

const TONES = {
  professional: 'Clear, authoritative, well-structured — suitable for LinkedIn or industry publications',
  conversational: 'Warm, approachable, uses "you" and "I" — like a personal blog',
  academic: 'Rigorous, well-cited, formal — suitable for research summaries or whitepapers',
  witty: 'Sharp, clever, surprising turns of phrase — engaging and memorable',
};

// ─── GET Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await ensurePluginInstalled();
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'drafts';

    if (action === 'drafts') {
      const drafts = await getDrafts();
      // Return drafts sorted by updatedAt desc, without full content (for list view)
      const summaries = drafts
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
      return NextResponse.json({ drafts: summaries });
    }

    if (action === 'draft') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const drafts = await getDrafts();
      const draft = drafts.find(d => d.id === id);
      if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      return NextResponse.json({ draft });
    }

    if (action === 'topics') {
      // Suggest blog topics from user's knowledge
      const settingsRows = await db.execute(sql`SELECT key, value FROM settings`);
      const config: Record<string, string> = {};
      for (const r of settingsRows as any[]) config[r.key] = r.value;
      const aiConfig = getAIConfig(config);
      if (!aiConfig) {
        return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });
      }

      // Get a sample of memories to understand user's knowledge
      const memories = await db.execute(sql`
        SELECT title, content FROM memories 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 30
      `);

      const knowledgeSummary = (memories as any[])
        .map(m => `- ${m.title || '(untitled)'}: ${(m.content || '').slice(0, 150)}`)
        .join('\n');

      const system = `You are a blog topic strategist. Given a user's knowledge base, suggest blog post topics they could write about with authority — topics where they have real knowledge to share, not generic ideas.`;
      const prompt = `Based on these knowledge fragments from my personal knowledge base, suggest 8 specific blog post topics I could write about. For each topic, provide:
1. A compelling title
2. A one-line description of the angle
3. An estimated reading time (min)
4. A style suggestion (technical/casual/storytelling/tutorial/opinion)

My knowledge includes:
${knowledgeSummary}

Return ONLY a JSON array with objects: { "title": string, "description": string, "readingTime": number, "style": string }
No markdown fences, no explanation — just the JSON array.`;

      const result = await callAI(aiConfig, prompt, system, 2048);
      if (!result) {
        return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
      }

      try {
        // Parse JSON from response
        const cleaned = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const topics = JSON.parse(cleaned);
        return NextResponse.json({ topics });
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
      const { topic, style = 'casual', tone = 'conversational', targetLength = 1200 } = body;
      if (!topic) return NextResponse.json({ error: 'Topic required' }, { status: 400 });

      // 1. Retrieve relevant memories via RAG
      let embedding: number[] | null = null;
      try {
        const embeddings = await generateEmbeddings([topic]);
        if (embeddings && embeddings.length > 0) embedding = embeddings[0];
      } catch { /* fallback */ }

      const retrievedMemories = await retrieve(topic, embedding, {
        userId,
        limit: 15,
      });

      if (retrievedMemories.length === 0) {
        return NextResponse.json({ error: 'No relevant memories found for this topic. Try a different angle or add more knowledge first.' }, { status: 400 });
      }

      // 2. Build knowledge context
      const knowledgeContext = retrievedMemories
        .map((m: any, i: number) => `[Source ${i + 1}] ${m.title || '(untitled)'}:\n${m.content?.slice(0, 800) || ''}`)
        .join('\n\n---\n\n');

      // 3. Get AI config
      const settingsRows = await db.execute(sql`SELECT key, value FROM settings`);
      const config: Record<string, string> = {};
      for (const r of settingsRows as any[]) config[r.key] = r.value;
      const aiConfig = getAIConfig(config);
      if (!aiConfig) {
        return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });
      }

      // 4. Generate outline first
      const outlineSystem = `You are a professional blog editor who creates compelling, well-structured outlines. You write from the user's actual knowledge — never invent facts.`;
      const outlinePrompt = `Create a blog post outline for the topic: "${topic}"

Writing style: ${STYLES[style as keyof typeof STYLES] || style}
Tone: ${TONES[tone as keyof typeof TONES] || tone}
Target length: ~${targetLength} words

Here is the author's actual knowledge on this topic:

${knowledgeContext}

Create an outline with 4-7 sections. Each section should have a clear heading and 1-2 bullet points about what to cover.

Return ONLY a JSON array of strings (section headings). No markdown fences, no explanation — just the JSON array.`;

      const outlineResult = await callAI(aiConfig, outlinePrompt, outlineSystem, 1024);
      let outline: string[] = [];
      try {
        const cleaned = (outlineResult || '').replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        outline = JSON.parse(cleaned);
      } catch {
        outline = ['Introduction', 'Main Points', 'Key Insights', 'Conclusion'];
      }

      // 5. Generate the full blog post
      const blogSystem = `You are a professional writer who creates compelling blog posts. Critical rules:
- Write ONLY from the provided knowledge — never invent facts, statistics, or claims not in the sources
- Write in first person when appropriate
- Use the specified style and tone consistently
- Include a strong hook in the opening paragraph
- Use markdown formatting: ## for headings, **bold** for emphasis, > for blockquotes
- Add a clear conclusion with a takeaway
- Target approximately ${targetLength} words
- Do NOT add meta-commentary like "Based on my research" — just write the post naturally
- Do NOT use placeholder links or references — only cite what's in the knowledge base`;

      const blogPrompt = `Write a complete blog post about: "${topic}"

Style: ${STYLES[style as keyof typeof STYLES] || style}
Tone: ${TONES[tone as keyof typeof TONES] || tone}
Outline to follow:
${outline.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Here is my actual knowledge to draw from:

${knowledgeContext}

Write the complete blog post in markdown. Start with the title as # heading.`;

      const blogContent = await callAI(aiConfig, blogPrompt, blogSystem, 8192);
      if (!blogContent) {
        return NextResponse.json({ error: 'AI generation failed — try again' }, { status: 500 });
      }

      // 6. Extract title from content
      const titleMatch = blogContent.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : topic;

      // 7. Word count
      const wordCount = blogContent.split(/\s+/).filter(Boolean).length;

      // 8. Create draft object
      const draft: BlogDraft = {
        id: generateId(),
        title,
        topic,
        style,
        tone,
        content: blogContent,
        outline,
        wordCount,
        sourceMemoryIds: retrievedMemories.map((m: any) => m.id).filter(Boolean),
        sourceCount: retrievedMemories.length,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 9. Save
      const drafts = await getDrafts();
      drafts.push(draft);
      await saveDrafts(drafts);

      return NextResponse.json({ draft });
    }

    if (action === 'save') {
      const { id, content, title, status } = body;
      if (!id) return NextResponse.json({ error: 'Missing draft id' }, { status: 400 });
      
      const drafts = await getDrafts();
      const idx = drafts.findIndex(d => d.id === id);
      if (idx === -1) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

      if (content !== undefined) {
        drafts[idx].content = content;
        drafts[idx].wordCount = content.split(/\s+/).filter(Boolean).length;
      }
      if (title !== undefined) drafts[idx].title = title;
      if (status !== undefined) drafts[idx].status = status;
      drafts[idx].updatedAt = new Date().toISOString();

      await saveDrafts(drafts);
      return NextResponse.json({ draft: drafts[idx] });
    }

    if (action === 'refine') {
      const { id, instruction, selection } = body;
      if (!id || !instruction) {
        return NextResponse.json({ error: 'Missing id or instruction' }, { status: 400 });
      }

      const drafts = await getDrafts();
      const draft = drafts.find(d => d.id === id);
      if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

      const settingsRows = await db.execute(sql`SELECT key, value FROM settings`);
      const config: Record<string, string> = {};
      for (const r of settingsRows as any[]) config[r.key] = r.value;
      const aiConfig = getAIConfig(config);
      if (!aiConfig) {
        return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });
      }

      const refineSystem = `You are a professional editor. You refine blog post content based on specific instructions. Keep the same style and tone. Return ONLY the refined content — no explanation or meta-commentary.`;
      
      let refinePrompt: string;
      if (selection) {
        refinePrompt = `Here is a section from a blog post:

---
${selection}
---

Instruction: ${instruction}

Return ONLY the refined version of this section. Keep markdown formatting.`;
      } else {
        refinePrompt = `Here is a complete blog post:

---
${draft.content}
---

Instruction: ${instruction}

Return ONLY the refined version of the entire post. Keep markdown formatting.`;
      }

      const refined = await callAI(aiConfig, refinePrompt, refineSystem, 8192);
      if (!refined) {
        return NextResponse.json({ error: 'Refinement failed' }, { status: 500 });
      }

      return NextResponse.json({ refined });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      
      const drafts = await getDrafts();
      const filtered = drafts.filter(d => d.id !== id);
      if (filtered.length === drafts.length) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }
      await saveDrafts(filtered);
      return NextResponse.json({ success: true });
    }

    if (action === 'export') {
      const { id, format = 'markdown' } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      
      const drafts = await getDrafts();
      const draft = drafts.find(d => d.id === id);
      if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

      if (format === 'markdown') {
        // Add frontmatter
        const frontmatter = `---
title: "${draft.title.replace(/"/g, '\\"')}"
date: ${draft.createdAt.split('T')[0]}
draft: true
tags: []
---

`;
        return NextResponse.json({ 
          content: frontmatter + draft.content,
          filename: `${draft.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.md`,
          format: 'markdown',
        });
      }

      if (format === 'html') {
        // Basic markdown to HTML conversion
        let html = draft.content;
        // Headers
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        // Bold & italic
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Blockquotes
        html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
        // Lists
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
        // Paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = `<!DOCTYPE html>
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
    pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
    a { color: #14b8a6; }
  </style>
</head>
<body>
<p>${html}</p>
</body>
</html>`;

        return NextResponse.json({ 
          content: html,
          filename: `${draft.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.html`,
          format: 'html',
        });
      }

      return NextResponse.json({ error: 'Unknown format. Use markdown or html.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
