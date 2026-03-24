import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/server/db';
import { sql, eq } from 'drizzle-orm';

/**
 * Knowledge Gaps Analyzer Plugin
 * 
 * GET /api/v1/plugins/knowledge-gaps
 * 
 * Identifies blind spots in your knowledge by:
 * 1. Clustering all memories into topics via k-means
 * 2. Analyzing topic density, coherence, and interconnectedness
 * 3. Detecting sparse regions (thin coverage)
 * 4. Finding "bridge gaps" — topics that SHOULD connect but don't
 * 5. AI-powered adjacent topic suggestions (what you're missing)
 * 6. Building a coverage map for visualization
 * 
 * Query params:
 *   ?action=analyze   — run full gap analysis (default)
 *   ?action=suggest   — get AI-suggested topics to explore
 *   ?maxTopics=12     — max topics to cluster (default 12)
 */

const PLUGIN_SLUG = 'knowledge-gaps';

interface Memory {
  id: string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  embedding: number[];
  createdAt: string;
}

interface Cluster {
  centroid: number[];
  members: Memory[];
}

interface Topic {
  id: string;
  label: string;
  keywords: string[];
  memoryCount: number;
  coherence: number;
  density: 'deep' | 'moderate' | 'thin' | 'sparse';
  sourceTypes: Record<string, number>;
  avgAge: number; // days since avg creation
  recentActivity: boolean; // any memory in last 30 days?
  previewMemories: { id: string; title: string; preview: string; sourceType: string }[];
}

interface Gap {
  id: string;
  type: 'sparse-topic' | 'bridge-gap' | 'stale-knowledge' | 'single-source' | 'isolated-topic';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  relatedTopics: string[];
  suggestion: string;
}

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

    const memories: Memory[] = (memoriesResult as any[]).map(m => ({
      id: m.id,
      content: m.content,
      sourceType: m.source_type,
      sourceTitle: m.source_title || 'Untitled',
      embedding: parseEmbedding(m.embedding),
      createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
    })).filter(m => m.embedding.length > 0);

    if (memories.length < 5) {
      return NextResponse.json({
        topics: [],
        gaps: [],
        coverageMap: [],
        stats: {
          totalMemories: memories.length,
          topicCount: 0,
          gapCount: 0,
          overallCoverage: 0,
          insufficientData: true,
        },
        suggestions: [],
      });
    }

    // ─── Cluster into topics ──────────────────────────────────
    const numClusters = Math.min(maxTopics, Math.max(3, Math.floor(memories.length / 4)));
    const clusters = kMeansClustering(memories, numClusters, 20);

    // ─── Build topic metadata ─────────────────────────────────
    const now = Date.now();
    const topics: Topic[] = [];

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      if (cluster.members.length === 0) continue;

      const label = extractTopicLabel(cluster.members);
      const keywords = extractKeywords(cluster.members, 5);
      const coherence = computeCoherence(cluster.centroid, cluster.members);
      const sourceTypes = countSourceTypes(cluster.members);
      
      const ages = cluster.members.map(m => (now - new Date(m.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;
      const recentActivity = ages.some(a => a < 30);

      const density = getDensityLevel(cluster.members.length, memories.length, coherence);

      const previewMemories = cluster.members.slice(0, 5).map(m => ({
        id: m.id,
        title: m.sourceTitle,
        preview: m.content.slice(0, 120).trim(),
        sourceType: m.sourceType,
      }));

      topics.push({
        id: `topic-${i}`,
        label,
        keywords,
        memoryCount: cluster.members.length,
        coherence,
        density,
        sourceTypes,
        avgAge,
        recentActivity,
        previewMemories,
      });
    }

    // Sort by memory count descending
    topics.sort((a, b) => b.memoryCount - a.memoryCount);

    // ─── Detect gaps ──────────────────────────────────────────
    const gaps: Gap[] = [];

    // 1. Sparse topics — clusters with very few memories relative to total
    for (const topic of topics) {
      if (topic.density === 'sparse') {
        gaps.push({
          id: `gap-sparse-${topic.id}`,
          type: 'sparse-topic',
          severity: 'medium',
          title: `Thin coverage: ${topic.label}`,
          description: `You have only ${topic.memoryCount} ${topic.memoryCount === 1 ? 'memory' : 'memories'} about "${topic.label}" — this area needs more depth.`,
          relatedTopics: [topic.id],
          suggestion: `Import more content about ${topic.keywords.slice(0, 3).join(', ')}. Consider reading articles, saving bookmarks, or taking notes on this topic.`,
        });
      }
    }

    // 2. Bridge gaps — topics that are close in embedding space but have no connection records
    const bridgeGaps = findBridgeGaps(clusters, topics);
    gaps.push(...bridgeGaps);

    // 3. Stale knowledge — topics with no recent activity
    for (const topic of topics) {
      if (!topic.recentActivity && topic.avgAge > 60) {
        gaps.push({
          id: `gap-stale-${topic.id}`,
          type: 'stale-knowledge',
          severity: 'low',
          title: `Stale: ${topic.label}`,
          description: `Your knowledge about "${topic.label}" hasn't been updated in ${Math.round(topic.avgAge)} days. It may be outdated.`,
          relatedTopics: [topic.id],
          suggestion: `Revisit this topic. Has anything changed? New developments, updated thinking, or evolving opinions?`,
        });
      }
    }

    // 4. Single-source topics — knowledge from only one source type
    for (const topic of topics) {
      const sourceKeys = Object.keys(topic.sourceTypes);
      if (sourceKeys.length === 1 && topic.memoryCount >= 3) {
        const src = sourceKeys[0];
        const srcLabel = { chatgpt: 'ChatGPT', file: 'files', url: 'URLs', text: 'notes', kindle: 'Kindle', obsidian: 'Obsidian', reddit: 'Reddit', document: 'documents' }[src] || src;
        gaps.push({
          id: `gap-source-${topic.id}`,
          type: 'single-source',
          severity: 'low',
          title: `One perspective: ${topic.label}`,
          description: `All ${topic.memoryCount} memories about "${topic.label}" come from ${srcLabel}. Diverse sources create stronger understanding.`,
          relatedTopics: [topic.id],
          suggestion: `Try finding different perspectives on ${topic.keywords[0] || topic.label} — articles, books, discussions, or your own notes.`,
        });
      }
    }

    // 5. Isolated topics — topics with low similarity to everything else
    const isolatedGaps = findIsolatedTopics(clusters, topics);
    gaps.push(...isolatedGaps);

    // Sort gaps by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // ─── Build coverage map (for visualization) ───────────────
    const totalMemories = memories.length;
    const coverageMap = topics.map(t => ({
      id: t.id,
      label: t.label,
      size: t.memoryCount,
      proportion: t.memoryCount / totalMemories,
      coherence: t.coherence,
      density: t.density,
      hasGap: gaps.some(g => g.relatedTopics.includes(t.id)),
      gapTypes: gaps.filter(g => g.relatedTopics.includes(t.id)).map(g => g.type),
    }));

    // ─── AI suggestions (if action=suggest) ───────────────────
    let suggestions: { topic: string; reason: string; relatedTo: string }[] = [];
    if (action === 'suggest') {
      suggestions = await generateAISuggestions(topics, gaps, userId);
    }

    // ─── Overall stats ────────────────────────────────────────
    const deepTopics = topics.filter(t => t.density === 'deep').length;
    const overallCoverage = Math.round((deepTopics / Math.max(topics.length, 1)) * 100);

    return NextResponse.json({
      topics,
      gaps,
      coverageMap,
      stats: {
        totalMemories,
        topicCount: topics.length,
        gapCount: gaps.length,
        overallCoverage,
        deepTopics,
        moderateTopics: topics.filter(t => t.density === 'moderate').length,
        thinTopics: topics.filter(t => t.density === 'thin').length,
        sparseTopics: topics.filter(t => t.density === 'sparse').length,
        staleTopics: topics.filter(t => !t.recentActivity).length,
        avgCoherence: Math.round((topics.reduce((a, t) => a + t.coherence, 0) / Math.max(topics.length, 1)) * 100) / 100,
      },
      suggestions,
    });

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

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

function computeCoherence(centroid: number[], members: Memory[]): number {
  if (members.length <= 1) return 1;
  const sims = members.map(m => cosineSimilarity(centroid, m.embedding));
  return Math.round((sims.reduce((a, b) => a + b, 0) / sims.length) * 100) / 100;
}

function getDensityLevel(clusterSize: number, totalMemories: number, coherence: number): 'deep' | 'moderate' | 'thin' | 'sparse' {
  const proportion = clusterSize / totalMemories;
  
  // Factor in both size and coherence
  if (clusterSize >= 10 && proportion >= 0.08 && coherence >= 0.7) return 'deep';
  if (clusterSize >= 5 && proportion >= 0.04) return 'moderate';
  if (clusterSize >= 3) return 'thin';
  return 'sparse';
}

// ─── K-Means++ Clustering ───────────────────────────────────────

function kMeansClustering(memories: Memory[], k: number, iterations: number): Cluster[] {
  const dim = memories[0].embedding.length;
  
  // K-Means++ initialization
  const centroids: number[][] = [];
  const firstIdx = Math.floor(Math.random() * memories.length);
  centroids.push([...memories[firstIdx].embedding]);

  for (let c = 1; c < k; c++) {
    const distances = memories.map(m => {
      const minDist = centroids.reduce((min, cent) => {
        const sim = cosineSimilarity(m.embedding, cent);
        const dist = 1 - sim;
        return Math.min(min, dist);
      }, Infinity);
      return minDist * minDist;
    });
    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) break;
    let r = Math.random() * totalDist;
    let idx = 0;
    for (let i = 0; i < distances.length; i++) {
      r -= distances[i];
      if (r <= 0) { idx = i; break; }
    }
    centroids.push([...memories[idx].embedding]);
  }

  // Iterate
  let assignments = new Array(memories.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    // Assign each memory to nearest centroid
    const newAssignments = memories.map(m => {
      let bestCluster = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const sim = cosineSimilarity(m.embedding, centroids[c]);
        if (sim > bestSim) { bestSim = sim; bestCluster = c; }
      }
      return bestCluster;
    });

    // Check for convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) break;

    // Update centroids
    for (let c = 0; c < centroids.length; c++) {
      const members = memories.filter((_, i) => assignments[i] === c);
      if (members.length === 0) continue;
      const newCentroid = new Array(dim).fill(0);
      for (const m of members) {
        for (let d = 0; d < dim; d++) newCentroid[d] += m.embedding[d];
      }
      for (let d = 0; d < dim; d++) newCentroid[d] /= members.length;
      centroids[c] = newCentroid;
    }
  }

  // Build clusters
  return centroids.map((centroid, c) => ({
    centroid,
    members: memories.filter((_, i) => assignments[i] === c),
  }));
}

// ─── Topic Labeling ─────────────────────────────────────────────

function extractTopicLabel(members: Memory[]): string {
  // If >60% from same source, use source title
  const sourceCount: Record<string, number> = {};
  for (const m of members) {
    sourceCount[m.sourceTitle] = (sourceCount[m.sourceTitle] || 0) + 1;
  }
  const topSource = Object.entries(sourceCount).sort((a, b) => b[1] - a[1])[0];
  if (topSource && topSource[1] / members.length > 0.6) {
    const title = topSource[0];
    if (title && title !== 'Untitled' && title.length <= 40) return title;
  }

  // Extract keywords
  const keywords = extractKeywords(members, 3);
  if (keywords.length > 0) return keywords.slice(0, 2).map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(' & ');
  
  return `Topic ${Math.floor(Math.random() * 100)}`;
}

function extractKeywords(members: Memory[], count: number): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'about',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'over', 'then', 'than', 'so', 'no', 'not', 'only',
    'very', 'just', 'also', 'more', 'most', 'other', 'some', 'such', 'any',
    'each', 'every', 'all', 'both', 'few', 'many', 'much', 'own', 'same',
    'this', 'that', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we',
    'us', 'our', 'you', 'your', 'he', 'his', 'she', 'her', 'they', 'them',
    'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
    'if', 'because', 'while', 'although', 'though', 'since', 'until',
    'like', 'well', 'back', 'even', 'still', 'already', 'really', 'here',
    'there', 'now', 'up', 'out', 'way', 'new', 'one', 'two', 'first',
    'last', 'next', 'good', 'great', 'make', 'think', 'know', 'get',
    'see', 'come', 'go', 'want', 'use', 'find', 'give', 'tell', 'work',
    'say', 'take', 'need', 'look', 'try', 'ask', 'let', 'keep', 'help',
    'start', 'show', 'might', 'set', 'put', 'end', 'does', 'another',
    'something', 'things', 'thing', 'people', 'time', 'year', 'years',
    'day', 'days', 'part', 'long', 'used', 'able', 'using', 'different',
    'however', 'example', 'based', 'important', 'actually', 'often',
    'going', 'right', 'dont', 'sure', 'point', 'always',
  ]);

  const wordCounts: Record<string, number> = {};
  const docFreq: Record<string, number> = {};

  for (const m of members) {
    const words = m.content.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    const seen = new Set<string>();
    for (const w of words) {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
      if (!seen.has(w)) { docFreq[w] = (docFreq[w] || 0) + 1; seen.add(w); }
    }
  }

  // TF-IDF-like: words that appear in many docs within cluster but not EVERY doc
  const scored = Object.entries(wordCounts)
    .filter(([_, c]) => c >= 2)
    .map(([word, count]) => {
      const df = docFreq[word] || 1;
      const idf = Math.log(members.length / df) + 1;
      return { word, score: count * idf };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map(s => s.word);
}

function countSourceTypes(members: Memory[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of members) counts[m.sourceType] = (counts[m.sourceType] || 0) + 1;
  return counts;
}

// ─── Gap Detection: Bridge Gaps ─────────────────────────────────

function findBridgeGaps(clusters: Cluster[], topics: Topic[]): Gap[] {
  const gaps: Gap[] = [];
  
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const sim = cosineSimilarity(clusters[i].centroid, clusters[j].centroid);
      
      // Topics are moderately similar (0.55-0.75) but not the same
      // This range indicates they SHOULD be connected but might have a gap between them
      if (sim >= 0.55 && sim <= 0.75) {
        const topicA = topics.find(t => t.id === `topic-${i}`);
        const topicB = topics.find(t => t.id === `topic-${j}`);
        if (!topicA || !topicB) continue;

        // Check if there's truly a gap — if both are well-covered, no gap
        if (topicA.density === 'deep' && topicB.density === 'deep') continue;

        gaps.push({
          id: `gap-bridge-${i}-${j}`,
          type: 'bridge-gap',
          severity: 'high',
          title: `Missing bridge: ${topicA.label} ↔ ${topicB.label}`,
          description: `"${topicA.label}" and "${topicB.label}" are related topics (${Math.round(sim * 100)}% similar) but lack connecting knowledge. Bridging these areas could unlock deeper insights.`,
          relatedTopics: [topicA.id, topicB.id],
          suggestion: `Explore how ${topicA.keywords[0] || topicA.label} connects to ${topicB.keywords[0] || topicB.label}. Look for cross-disciplinary articles, write notes connecting these ideas, or ask yourself: "How does my understanding of one inform the other?"`,
        });
      }
    }
  }

  return gaps.slice(0, 5); // Cap at 5 bridge gaps
}

// ─── Gap Detection: Isolated Topics ─────────────────────────────

function findIsolatedTopics(clusters: Cluster[], topics: Topic[]): Gap[] {
  const gaps: Gap[] = [];

  for (let i = 0; i < clusters.length; i++) {
    const sims = clusters
      .filter((_, j) => j !== i)
      .map(c => cosineSimilarity(clusters[i].centroid, c.centroid));
    
    if (sims.length === 0) continue;
    const maxSim = Math.max(...sims);
    const avgSim = sims.reduce((a, b) => a + b, 0) / sims.length;

    // Topic is isolated if its max similarity to any other topic is low
    if (maxSim < 0.45 && avgSim < 0.35) {
      const topic = topics.find(t => t.id === `topic-${i}`);
      if (!topic) continue;

      gaps.push({
        id: `gap-isolated-${topic.id}`,
        type: 'isolated-topic',
        severity: 'medium',
        title: `Island: ${topic.label}`,
        description: `"${topic.label}" is isolated from your other knowledge areas. It doesn't connect to anything else in your mind. Consider how it relates to your other interests.`,
        relatedTopics: [topic.id],
        suggestion: `This topic lives on its own island. Try writing about how ${topic.keywords[0] || topic.label} relates to your other interests, or import content that bridges it with adjacent fields.`,
      });
    }
  }

  return gaps;
}

// ─── AI Suggestions ─────────────────────────────────────────────

async function generateAISuggestions(
  topics: Topic[],
  gaps: Gap[],
  userId: string,
): Promise<{ topic: string; reason: string; relatedTo: string }[]> {
  try {
    // Get AI config
    const settingsRows = await db.execute(sql`SELECT key, value FROM settings`);
    const config: Record<string, string> = {};
    for (const row of settingsRows as any[]) config[row.key] = row.value;

    const apiKey = config.openai_api_key || process.env.OPENAI_API_KEY
      || config.gemini_api_key || process.env.GEMINI_API_KEY;
    
    if (!apiKey) return [];

    const topicSummary = topics.map(t => `- ${t.label} (${t.memoryCount} memories, ${t.density} coverage)`).join('\n');
    const gapSummary = gaps.slice(0, 5).map(g => `- ${g.title}`).join('\n');

    const prompt = `Based on this person's knowledge topics and gaps, suggest 5 specific adjacent topics they should explore to strengthen their understanding. Return ONLY a JSON array.

Current knowledge topics:
${topicSummary}

Identified gaps:
${gapSummary}

Return format: [{"topic": "specific topic name", "reason": "why this would help", "relatedTo": "which existing topic it connects to"}]
Return ONLY the JSON array, no markdown fences.`;

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
        }
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
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });
      const data = await res.json();
      responseText = data?.choices?.[0]?.message?.content || '';
    }

    if (!responseText) return [];

    // Parse JSON response
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
