/**
 * Blog Draft Generator Plugin — Route (thin wrapper)
 *
 * GET  ?action=drafts           — List all saved drafts
 * GET  ?action=draft&id=        — Get a single draft
 * GET  ?action=topics           — Get AI-suggested topics
 * POST ?action=generate         — Generate a blog draft
 * POST ?action=save             — Save/update a draft
 * POST ?action=delete           — Delete a draft
 * POST ?action=refine           — Refine/edit with AI
 * POST ?action=export           — Export as markdown or HTML
 *
 * Logic delegated to src/server/plugins/ports/blog-draft.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';
import { retrieve } from '@/server/retrieval';
import { generateEmbeddings } from '@/server/embeddings';
import { resolveAIConfig, callAI } from '@/server/plugins/ai-caller';
import {
  listDraftSummaries,
  getDraftById,
  getDrafts,
  saveDrafts,
  updateDraft,
  deleteDraft,
  buildTopicSuggestionPrompt,
  buildOutlinePrompt,
  buildBlogPrompt,
  buildRefinePrompt,
  createDraftObject,
  exportAsMarkdown,
  exportAsHtml,
  parseJsonFromAI,
  parseOutline,
} from '@/server/plugins/ports/blog-draft';

const PLUGIN_SLUG = 'blog-draft-generator';

async function ensureInstalled() {
  const existing = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, PLUGIN_SLUG)).limit(1);
  if (existing.length === 0) {
    await db.insert(schema.plugins).values({
      slug: PLUGIN_SLUG,
      name: 'Blog Draft Generator',
      description: 'Turn your memories into polished, publishable blog posts — written from YOUR knowledge.',
      version: '1.0.0',
      type: 'extension',
      status: 'active',
      icon: 'FileEdit',
      category: 'action',
      config: {},
    });
  }
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await ensureInstalled();
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'drafts';

    if (action === 'drafts') {
      return NextResponse.json({ drafts: await listDraftSummaries() });
    }

    if (action === 'draft') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const draft = await getDraftById(id);
      if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      return NextResponse.json({ draft });
    }

    if (action === 'topics') {
      const aiConfig = await resolveAIConfig();
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });

      const memories = await db.execute(sql`
        SELECT title, content FROM memories
        WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 30
      `);
      const knowledgeSummary = (memories as any[])
        .map(m => `- ${m.title || '(untitled)'}: ${(m.content || '').slice(0, 150)}`)
        .join('\n');

      const { system, prompt } = buildTopicSuggestionPrompt(knowledgeSummary);
      const result = await callAI(aiConfig, prompt, { system, temperature: 0.7, maxTokens: 2048 });
      if (!result) return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });

      try {
        return NextResponse.json({ topics: parseJsonFromAI(result) });
      } catch {
        return NextResponse.json({ error: 'Failed to parse AI response', raw: result }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await ensureInstalled();
    const userId = await getUserId();
    const body = await req.json();
    const action = body.action;

    if (action === 'generate') {
      const { topic, style = 'casual', tone = 'conversational', targetLength = 1200 } = body;
      if (!topic) return NextResponse.json({ error: 'Topic required' }, { status: 400 });

      // RAG retrieval
      let embedding: number[] | null = null;
      try {
        const embs = await generateEmbeddings([topic]);
        if (embs?.length) embedding = embs[0];
      } catch { /* fallback */ }

      const retrievedMemories = await retrieve(topic, embedding, { userId, limit: 15 });
      if (retrievedMemories.length === 0) {
        return NextResponse.json({ error: 'No relevant memories found. Try a different angle.' }, { status: 400 });
      }

      const knowledgeContext = retrievedMemories
        .map((m: any, i: number) => `[Source ${i + 1}] ${m.title || '(untitled)'}:\n${m.content?.slice(0, 800) || ''}`)
        .join('\n\n---\n\n');

      const aiConfig = await resolveAIConfig();
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });

      // 1. Generate outline
      const outlinePrompt = buildOutlinePrompt(topic, style, tone, targetLength, knowledgeContext);
      const outlineResult = await callAI(aiConfig, outlinePrompt.prompt, { system: outlinePrompt.system, temperature: 0.7, maxTokens: 1024 });
      const outline = parseOutline(outlineResult || '');

      // 2. Generate full post
      const blogPrompt = buildBlogPrompt(topic, style, tone, targetLength, outline, knowledgeContext);
      const blogContent = await callAI(aiConfig, blogPrompt.prompt, { system: blogPrompt.system, temperature: 0.7, maxTokens: 8192 });
      if (!blogContent) return NextResponse.json({ error: 'AI generation failed — try again' }, { status: 500 });

      // 3. Create & save draft
      const draft = createDraftObject(topic, style, tone, blogContent, outline, retrievedMemories.map((m: any) => m.id).filter(Boolean));
      const drafts = await getDrafts();
      drafts.push(draft);
      await saveDrafts(drafts);

      return NextResponse.json({ draft });
    }

    if (action === 'save') {
      const { id, content, title, status } = body;
      if (!id) return NextResponse.json({ error: 'Missing draft id' }, { status: 400 });
      try {
        const draft = await updateDraft(id, { content, title, status });
        return NextResponse.json({ draft });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
    }

    if (action === 'refine') {
      const { id, instruction, selection } = body;
      if (!id || !instruction) return NextResponse.json({ error: 'Missing id or instruction' }, { status: 400 });

      const draft = await getDraftById(id);
      if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

      const aiConfig = await resolveAIConfig();
      if (!aiConfig) return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 });

      const { system, prompt } = buildRefinePrompt(instruction, selection || draft.content, !!selection);
      const refined = await callAI(aiConfig, prompt, { system, temperature: 0.7, maxTokens: 8192 });
      if (!refined) return NextResponse.json({ error: 'Refinement failed' }, { status: 500 });

      return NextResponse.json({ refined });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      try {
        await deleteDraft(id);
        return NextResponse.json({ success: true });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
    }

    if (action === 'export') {
      const { id, format = 'markdown' } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const draft = await getDraftById(id);
      if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

      if (format === 'html') return NextResponse.json({ ...exportAsHtml(draft), format: 'html' });
      return NextResponse.json({ ...exportAsMarkdown(draft), format: 'markdown' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
