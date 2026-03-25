import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';

/**
 * Contradiction Finder Plugin — AI-powered contradiction detection
 * 
 * GET  ?action=scan    — Run a new contradiction scan (finds candidate pairs via embeddings, verifies via AI)
 * GET  ?action=results — Get cached scan results from contradictions table
 * POST ?action=resolve — Resolve a contradiction (dismiss, keep-a, keep-b)
 * POST ?action=scan    — Run scan (same as GET but allows for future body params)
 */

const PLUGIN_SLUG = 'contradiction-finder';

// Auto-install plugin in DB
async function ensurePluginInstalled() {
  const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  if ((existing as any[]).length === 0) {
    await db.execute(sql`
      INSERT INTO plugins (slug, name, description, type, status, icon, category)
      VALUES (
        ${PLUGIN_SLUG},
        'Contradiction Finder',
        'Scans your memories for conflicting beliefs, outdated info, and inconsistencies. Uses AI to verify real contradictions.',
        'extension',
        'active',
        'AlertTriangle',
        'analysis'
      )
    `);
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const action = req.nextUrl.searchParams.get('action') || 'results';

    await ensurePluginInstalled();

    if (action === 'results') {
      return getResults(userId);
    }
    if (action === 'scan') {
      return runScan(userId);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const action = req.nextUrl.searchParams.get('action') || 'resolve';

    await ensurePluginInstalled();

    if (action === 'resolve') {
      const body = await req.json();
      return resolveContradiction(userId, body);
    }
    if (action === 'scan') {
      return runScan(userId);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────
// Get cached results from contradictions table
// ──────────────────────────────────────────────────────────────

async function getResults(userId: string) {
  const results = await db.execute(sql`
    SELECT 
      c.id, c.topic, c.description, c.detected_at,
      c.memory_a_id, c.memory_b_id,
      a.content as a_content, a.source_type as a_source, a.source_title as a_title, a.created_at as a_created,
      b.content as b_content, b.source_type as b_source, b.source_title as b_title, b.created_at as b_created
    FROM contradictions c
    JOIN memories a ON a.id = c.memory_a_id
    JOIN memories b ON b.id = c.memory_b_id
    WHERE c.user_id = ${userId}::uuid
    ORDER BY c.detected_at DESC
  `);

  const contradictions = (results as any[]).map(r => ({
    id: r.id,
    topic: r.topic,
    description: r.description,
    detectedAt: r.detected_at,
    memoryA: {
      id: r.memory_a_id,
      content: r.a_content,
      source: r.a_source,
      sourceTitle: r.a_title,
      createdAt: r.a_created,
    },
    memoryB: {
      id: r.memory_b_id,
      content: r.b_content,
      source: r.b_source,
      sourceTitle: r.b_title,
      createdAt: r.b_created,
    },
  }));

  return NextResponse.json({ contradictions, count: contradictions.length });
}

// ──────────────────────────────────────────────────────────────
// Run a contradiction scan
// ──────────────────────────────────────────────────────────────

async function runScan(userId: string) {
  // Step 1: Find candidate pairs — memories that are semantically similar (same topic)
  // but from different sources or different time periods
  // This is where contradictions live: similar topic, different claims
  
  const candidateResults = await db.execute(sql`
    SELECT 
      a.id as a_id, a.content as a_content, a.source_type as a_source, 
      a.source_title as a_title, a.created_at as a_created,
      b.id as b_id, b.content as b_content, b.source_type as b_source, 
      b.source_title as b_title, b.created_at as b_created,
      1 - (a.embedding <=> b.embedding) as similarity
    FROM memories a, memories b
    WHERE a.user_id = ${userId}::uuid AND b.user_id = ${userId}::uuid
      AND a.id < b.id
      AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
      AND vector_dims(a.embedding) = vector_dims(b.embedding)
      AND 1 - (a.embedding <=> b.embedding) BETWEEN 0.60 AND 0.95
      AND a.content != b.content
      AND LENGTH(a.content) > 50 AND LENGTH(b.content) > 50
    ORDER BY 1 - (a.embedding <=> b.embedding) DESC
    LIMIT 80
  `);

  const candidates = candidateResults as any[];
  
  if (candidates.length === 0) {
    return NextResponse.json({
      contradictions: [],
      count: 0,
      scanned: 0,
      message: 'No candidate pairs found. Import more knowledge to discover contradictions.',
    });
  }

  // Step 2: Get AI config
  const settings = await db.execute(
    sql`SELECT key, value FROM settings WHERE key IN (
      'openai_api_key', 'gemini_api_key', 'ollama_url',
      'openrouter_api_key', 'custom_api_key', 'custom_api_url', 'custom_api_model',
      'chat_provider'
    )`
  );
  const config: Record<string, string> = {};
  for (const row of settings as any[]) {
    config[row.key] = row.value;
  }

  const aiConfig = getAIConfig(config);
  
  if (!aiConfig) {
    // Fallback to keyword-based detection if no AI available
    return runKeywordScan(userId, candidates);
  }

  // Step 3: Batch AI verification — check each candidate pair for actual contradictions
  // Process in batches of 5 to stay within rate limits
  const BATCH_SIZE = 5;
  const verified: any[] = [];
  
  for (let i = 0; i < candidates.length && verified.length < 20; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(c => verifyContradiction(c, aiConfig))
    );
    
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        verified.push({
          ...result.value,
          candidate: batch[j],
        });
      }
    }
  }

  // Step 4: Store verified contradictions in DB (deduplicate by memory pair)
  let newCount = 0;
  for (const v of verified) {
    const c = v.candidate;
    // Check if this pair already exists
    const existing = await db.execute(sql`
      SELECT id FROM contradictions 
      WHERE user_id = ${userId}::uuid
        AND ((memory_a_id = ${c.a_id}::uuid AND memory_b_id = ${c.b_id}::uuid)
          OR (memory_a_id = ${c.b_id}::uuid AND memory_b_id = ${c.a_id}::uuid))
    `);

    if ((existing as any[]).length === 0) {
      await db.execute(sql`
        INSERT INTO contradictions (user_id, memory_a_id, memory_b_id, topic, description)
        VALUES (
          ${userId}::uuid,
          ${c.a_id}::uuid,
          ${c.b_id}::uuid,
          ${v.topic},
          ${v.description}
        )
      `);
      newCount++;
    }
  }

  // Step 5: Return fresh results
  const freshResults = await getResults(userId);
  const data = await freshResults.json();

  // Send notification if contradictions found
  if (newCount > 0) {
    try {
      const { notifyAnalysisReady } = await import('@/server/notifications');
      await notifyAnalysisReady(
        'contradiction-finder',
        `${newCount} contradiction${newCount > 1 ? 's' : ''} found`,
        `Scanned ${candidates.length} memory pairs and found potential conflicts in your knowledge.`,
        '/app/insights'
      );
    } catch (e) { /* non-fatal */ }
  }

  return NextResponse.json({
    ...data,
    scanned: candidates.length,
    newFound: newCount,
    message: newCount > 0
      ? `Found ${newCount} new contradiction${newCount > 1 ? 's' : ''} across ${candidates.length} memory pairs.`
      : `Scanned ${candidates.length} memory pairs. No new contradictions found.`,
  });
}

// ──────────────────────────────────────────────────────────────
// Resolve a contradiction
// ──────────────────────────────────────────────────────────────

async function resolveContradiction(userId: string, body: any) {
  const { contradictionId, resolution } = body;
  // resolution: 'dismiss' | 'keep-a' | 'keep-b'

  if (!contradictionId) {
    return NextResponse.json({ error: 'contradictionId required' }, { status: 400 });
  }

  // Verify ownership
  const existing = await db.execute(sql`
    SELECT id, memory_a_id, memory_b_id FROM contradictions 
    WHERE id = ${contradictionId}::uuid AND user_id = ${userId}::uuid
  `);

  if ((existing as any[]).length === 0) {
    return NextResponse.json({ error: 'Contradiction not found' }, { status: 404 });
  }

  const record = (existing as any[])[0];

  if (resolution === 'keep-a') {
    // Delete memory B
    await db.execute(sql`DELETE FROM memories WHERE id = ${record.memory_b_id}::uuid AND user_id = ${userId}::uuid`);
  } else if (resolution === 'keep-b') {
    // Delete memory A
    await db.execute(sql`DELETE FROM memories WHERE id = ${record.memory_a_id}::uuid AND user_id = ${userId}::uuid`);
  }
  // For 'dismiss' — just remove the contradiction record

  // Remove the contradiction entry
  await db.execute(sql`DELETE FROM contradictions WHERE id = ${contradictionId}::uuid AND user_id = ${userId}::uuid`);

  return NextResponse.json({ success: true, resolution });
}

// ──────────────────────────────────────────────────────────────
// AI verification — ask AI if two texts actually contradict
// ──────────────────────────────────────────────────────────────

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

  // Prefer fast/cheap models for analysis tasks
  if (preferred === 'openrouter' && openrouterKey) {
    return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  }
  if (preferred === 'custom' && customKey && customUrl) {
    return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  }
  if (preferred === 'gemini' && geminiKey) {
    return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash-lite' };
  }
  if (preferred === 'openai' && openaiKey) {
    return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  }
  if (preferred === 'ollama' && ollamaUrl) {
    return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };
  }

  // Auto-detect chain
  if (geminiKey) return { type: 'gemini', url: '', key: geminiKey, model: 'gemini-2.0-flash-lite' };
  if (openaiKey) return { type: 'openai-compatible', url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: 'gpt-4o-mini' };
  if (openrouterKey) return { type: 'openai-compatible', url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'anthropic/claude-3.5-haiku', extraHeaders: { 'HTTP-Referer': 'https://mindstore.app', 'X-Title': 'MindStore' } };
  if (customKey && customUrl) return { type: 'openai-compatible', url: customUrl, key: customKey, model: customModel || 'default' };
  if (ollamaUrl) return { type: 'ollama', url: ollamaUrl, model: 'llama3.2' };
  
  return null;
}

async function verifyContradiction(candidate: any, aiConfig: AIConfig): Promise<{ topic: string; description: string; severity: string } | null> {
  const prompt = `You are a contradiction analyzer. Given two text passages from the same person's knowledge base, determine if they contain a genuine contradiction, conflicting belief, or inconsistency.

TEXT A (from "${candidate.a_title || candidate.a_source}"):
"${candidate.a_content.slice(0, 600)}"

TEXT B (from "${candidate.b_title || candidate.b_source}"):
"${candidate.b_content.slice(0, 600)}"

Analyze carefully:
1. Do these passages express genuinely conflicting views, contradictory facts, or inconsistent beliefs?
2. Is this a real contradiction or just different aspects/contexts of the same topic?
3. Evolution of thought over time is NOT a contradiction — if one clearly supersedes the other, that's growth.

Respond with ONLY valid JSON (no markdown, no explanation):
- If a genuine contradiction exists:
  {"contradiction": true, "topic": "brief topic (3-5 words)", "description": "Clear description of what conflicts, e.g. 'Says X values remote work here but advocates for office-first culture there'", "severity": "high|medium|low"}
- If no real contradiction:
  {"contradiction": false}`;

  try {
    const response = await callAI(aiConfig, prompt);
    if (!response) return null;

    // Parse JSON response — handle markdown code fences
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    
    const parsed = JSON.parse(cleaned);
    if (!parsed.contradiction) return null;

    return {
      topic: parsed.topic || 'Unknown topic',
      description: parsed.description || 'Potential contradiction detected',
      severity: parsed.severity || 'medium',
    };
  } catch (e) {
    // If AI call fails for this pair, skip it
    return null;
  }
}

async function callAI(config: AIConfig, prompt: string): Promise<string | null> {
  try {
    if (config.type === 'gemini') {
      return callGemini(config, prompt);
    } else if (config.type === 'ollama') {
      return callOllama(config, prompt);
    } else {
      return callOpenAICompatible(config, prompt);
    }
  } catch (e) {
    return null;
  }
}

async function callOpenAICompatible(config: AIConfig, prompt: string): Promise<string | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.key}`,
    ...(config.extraHeaders || {}),
  };

  const res = await fetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 300,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

async function callGemini(config: AIConfig, prompt: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callOllama(config: AIConfig, prompt: string): Promise<string | null> {
  const res = await fetch(`${config.url}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      options: { temperature: 0.1 },
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.response || null;
}

// ──────────────────────────────────────────────────────────────
// Keyword-based fallback (when no AI provider available)
// ──────────────────────────────────────────────────────────────

function runKeywordScan(userId: string, candidates: any[]) {
  const contradictionSignals = [
    ['always', 'never'], ['best', 'worst'], ['love', 'hate'],
    ['agree', 'disagree'], ['should', 'should not'],
    ['important', 'unimportant'], ['easy', 'difficult'],
    ['recommend', 'avoid'], ['prefer', 'dislike'],
    ['efficient', 'inefficient'], ['useful', 'useless'],
    ['true', 'false'], ['right', 'wrong'],
    ['increase', 'decrease'], ['better', 'worse'],
    ['positive', 'negative'], ['success', 'failure'],
  ];

  const found: any[] = [];

  for (const r of candidates) {
    const aLower = r.a_content.toLowerCase();
    const bLower = r.b_content.toLowerCase();
    for (const [pos, neg] of contradictionSignals) {
      if ((aLower.includes(pos) && bLower.includes(neg)) || (aLower.includes(neg) && bLower.includes(pos))) {
        found.push({
          memoryA: { id: r.a_id, content: r.a_content, source: r.a_source, sourceTitle: r.a_title, createdAt: r.a_created },
          memoryB: { id: r.b_id, content: r.b_content, source: r.b_source, sourceTitle: r.b_title, createdAt: r.b_created },
          topic: extractBridgeConcept(r.a_content, r.b_content),
          description: `Potential tension: one mentions "${pos}" while the other mentions "${neg}"`,
        });
        break;
      }
    }
    if (found.length >= 15) break;
  }

  return NextResponse.json({
    contradictions: found,
    count: found.length,
    scanned: candidates.length,
    aiPowered: false,
    message: found.length > 0
      ? `Found ${found.length} potential contradiction${found.length > 1 ? 's' : ''} using keyword analysis. Connect an AI provider for deeper analysis.`
      : 'No contradictions detected via keyword analysis. Connect an AI provider for deeper analysis.',
  });
}

function extractBridgeConcept(textA: string, textB: string): string {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'not', 'with', 'this', 'that', 'from', 'by', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their', 'me', 'him', 'us', 'them', 'about', 'just', 'also', 'than', 'then', 'when', 'what', 'how', 'which', 'where', 'more', 'some', 'very', 'much', 'only', 'other', 'each', 'most', 'such', 'well', 'because', 'while', 'after', 'before']);
  const wordsA = new Set(textA.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w)));
  const wordsB = new Set(textB.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w)));
  const common = [...wordsA].filter(w => wordsB.has(w));
  return common.slice(0, 3).join(', ') || 'related concepts';
}
