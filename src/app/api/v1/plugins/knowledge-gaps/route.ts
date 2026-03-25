/**
 * Knowledge Gaps Analyzer Plugin — Route (thin wrapper)
 *
 * GET /api/v1/plugins/knowledge-gaps
 *   ?action=analyze   — run full gap analysis (default)
 *   ?action=suggest   — get AI-suggested topics to explore
 *   ?maxTopics=12     — max topics to cluster (default 12)
 *
 * Logic delegated to src/server/plugins/ports/knowledge-gaps.ts
 */

import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import {
  analyzeKnowledgeGaps,
  buildSuggestionPrompt,
  type KnowledgeGapMemory,
} from '@/server/plugins/ports/knowledge-gaps';

const PLUGIN_SLUG = 'knowledge-gaps';

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'analyze';
    const maxTopics = Math.min(parseInt(searchParams.get('maxTopics') || '12'), 20);

    await autoInstallPlugin();

    // ─── Fetch all memories with embeddings ───────────────────
    const memoriesResult = await db.execute(sql`
      SELECT id, content, source_type, source_title, embedding, created_at, metadata
      FROM memories
      WHERE user_id = ${userId}::uuid AND embedding IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 500
    `);

    const memories: KnowledgeGapMemory[] = (memoriesResult as any[]).map(m => ({
      id: m.id,
      content: m.content,
      sourceType: m.source_type,
      sourceTitle: m.source_title || 'Untitled',
      embedding: parseEmbedding(m.embedding),
      createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
    })).filter(m => m.embedding.length > 0);

    if (memories.length < 5) {
      return NextResponse.json({
        topics: [], gaps: [], coverageMap: [],
        stats: { totalMemories: memories.length, topicCount: 0, gapCount: 0, overallCoverage: 0, insufficientData: true },
        suggestions: [],
      });
    }

    // ─── Delegate to port ─────────────────────────────────────
    const result = analyzeKnowledgeGaps(memories, maxTopics);

    // ─── AI suggestions (if action=suggest) ───────────────────
    let suggestions: { topic: string; reason: string; relatedTo: string }[] = [];
    if (action === 'suggest') {
      suggestions = await generateAISuggestions(result.topics, result.gaps, userId);
    }

    return NextResponse.json({ ...result, suggestions });
  } catch (err: any) {
    console.error('Knowledge Gaps error:', err);
    return NextResponse.json({ error: err.message || 'Analysis failed' }, { status: 500 });
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function parseEmbedding(raw: any): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const cleaned = raw.replace(/^\[/, '').replace(/\]$/, '');
      return cleaned.split(',').map(Number);
    } catch { return []; }
  }
  return [];
}

// ─── AI Suggestions ─────────────────────────────────────────────

async function generateAISuggestions(
  topics: any[],
  gaps: any[],
  userId: string,
): Promise<{ topic: string; reason: string; relatedTo: string }[]> {
  try {
    const settingsRows = await db.execute(sql`SELECT key, value FROM settings`);
    const config: Record<string, string> = {};
    for (const row of settingsRows as any[]) config[row.key] = row.value;

    const apiKey = config.openai_api_key || process.env.OPENAI_API_KEY
      || config.gemini_api_key || process.env.GEMINI_API_KEY;
    if (!apiKey) return [];

    const prompt = buildSuggestionPrompt(topics, gaps);

    const isGemini = !!(config.gemini_api_key || process.env.GEMINI_API_KEY);
    const isOpenAI = !!(config.openai_api_key || process.env.OPENAI_API_KEY);

    let responseText = '';

    if (isGemini) {
      const key = config.gemini_api_key || process.env.GEMINI_API_KEY;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        },
      );
      const data = await res.json();
      responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (isOpenAI) {
      const key = config.openai_api_key || process.env.OPENAI_API_KEY;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: config.openai_model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7, max_tokens: 1024,
        }),
      });
      const data = await res.json();
      responseText = data?.choices?.[0]?.message?.content || '';
    }

    if (!responseText) return [];

    const cleaned = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.slice(0, 5);
    return [];
  } catch (err) {
    console.error('AI suggestions error:', err);
    return [];
  }
}

// ─── Auto-install plugin ────────────────────────────────────────

async function autoInstallPlugin() {
  try {
    const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG} LIMIT 1`);
    if ((existing as any[]).length === 0) {
      await db.execute(sql`
        INSERT INTO plugins (slug, name, description, version, type, status, icon, category, config, metadata)
        VALUES (
          ${PLUGIN_SLUG},
          'Knowledge Gaps Analyzer',
          'Identifies blind spots in your knowledge. Finds sparse topics, missing bridges, and stale areas.',
          '1.0.0',
          'extension',
          'active',
          'Target',
          'analysis',
          '{}',
          '{"hooks": ["onDashboard", "onInsights"]}'
        )
      `);
    }
  } catch {}
}
