import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { sql } from 'drizzle-orm';
import { getUserId } from '@/server/user';

/**
 * GET /api/v1/memories/[id]/analysis — deep analysis of a single memory
 * 
 * Returns: reading time, word count, key terms, related topics,
 * readability score, content age, and more.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;

    const result = await db.execute(sql`
      SELECT id, content, source_type, source_title, metadata, created_at, imported_at
      FROM memories WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
    `);

    const memory = (result as any[])[0];
    if (!memory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    const content = memory.content || '';
    const words = content.split(/\s+/).filter((w: string) => w.length > 0);
    const wordCount = words.length;
    const charCount = content.length;
    const sentenceCount = (content.match(/[.!?]+\s/g) || []).length + 1;
    const paragraphCount = content.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0).length;

    // Reading time (average 238 words per minute)
    const readingTimeMinutes = Math.max(1, Math.round(wordCount / 238));

    // Average word length
    const avgWordLength = wordCount > 0 
      ? Math.round((words.reduce((s: number, w: string) => s + w.length, 0) / wordCount) * 10) / 10
      : 0;

    // Average sentence length
    const avgSentenceLength = sentenceCount > 0 
      ? Math.round(wordCount / sentenceCount) 
      : 0;

    // Simple readability score (Flesch-Kincaid-ish approximation)
    // Lower = harder to read, higher = easier
    const readability = Math.round(
      206.835 - (1.015 * avgSentenceLength) - (84.6 * (avgWordLength / 5))
    );
    const readabilityLabel = readability >= 70 ? 'Easy' 
      : readability >= 50 ? 'Moderate' 
      : readability >= 30 ? 'Difficult' 
      : 'Very difficult';

    // Extract key terms (most frequent non-stop-words, 4+ chars)
    const stopWords = new Set([
      'this', 'that', 'with', 'have', 'will', 'from', 'they', 'been',
      'were', 'said', 'each', 'which', 'their', 'would', 'there',
      'about', 'could', 'other', 'than', 'then', 'some', 'when',
      'what', 'your', 'more', 'very', 'just', 'also', 'into',
    ]);
    const wordFreq = new Map<string, number>();
    for (const w of words) {
      const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.length >= 4 && !stopWords.has(clean)) {
        wordFreq.set(clean, (wordFreq.get(clean) || 0) + 1);
      }
    }
    const keyTerms = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term, count]) => ({ term, count }));

    // Content age
    const createdAt = new Date(memory.created_at);
    const ageMs = Date.now() - createdAt.getTime();
    const ageDays = Math.floor(ageMs / 86400000);
    const ageLabel = ageDays === 0 ? 'Today' 
      : ageDays === 1 ? 'Yesterday'
      : ageDays < 7 ? `${ageDays} days ago`
      : ageDays < 30 ? `${Math.floor(ageDays / 7)} weeks ago`
      : ageDays < 365 ? `${Math.floor(ageDays / 30)} months ago`
      : `${Math.floor(ageDays / 365)} years ago`;

    // Check if it has embedding
    const embCheck = await db.execute(sql`
      SELECT embedding IS NOT NULL as has_embedding FROM memories WHERE id = ${id}::uuid
    `);
    const hasEmbedding = (embCheck as any[])[0]?.has_embedding || false;

    // Count related memories (by embedding similarity if available)
    let relatedCount = 0;
    if (hasEmbedding) {
      try {
        const related = await db.execute(sql`
          SELECT COUNT(*)::int as c FROM memories
          WHERE user_id = ${userId}::uuid AND id != ${id}::uuid AND embedding IS NOT NULL
          AND 1 - (embedding <=> (SELECT embedding FROM memories WHERE id = ${id}::uuid)) > 0.3
        `);
        relatedCount = (related as any[])[0]?.c || 0;
      } catch { /* vector ops may fail */ }
    }

    return NextResponse.json({
      id: memory.id,
      title: memory.source_title,
      source: memory.source_type,
      
      stats: {
        wordCount,
        charCount,
        sentenceCount,
        paragraphCount,
        readingTimeMinutes,
        avgWordLength,
        avgSentenceLength,
      },

      readability: {
        score: readability,
        label: readabilityLabel,
      },

      keyTerms,

      age: {
        days: ageDays,
        label: ageLabel,
        createdAt: memory.created_at,
        importedAt: memory.imported_at,
      },

      embedding: {
        hasEmbedding,
        relatedCount,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
