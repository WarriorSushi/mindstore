import { getUserId } from '@/server/user';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { generateEmbeddings } from '@/server/embeddings';
import { sql } from 'drizzle-orm';

/**
 * Image-to-Memory Plugin — Upload images → AI describes → save as searchable memory
 *
 * Supports: photos, screenshots, whiteboards, diagrams, documents, charts
 * Vision providers: OpenAI GPT-4o / Gemini Flash / Ollama (llava)
 *
 * GET  ?action=images          — List all analyzed images (recent first)
 * GET  ?action=stats           — Image analysis stats
 * GET  ?action=check           — Check available vision providers
 * POST ?action=analyze         — Upload image → AI describes → return description
 * POST ?action=save            — Save analysis as a searchable memory
 * POST ?action=reanalyze       — Re-analyze with different prompt/provider
 * POST ?action=delete          — Delete an image analysis
 * POST ?action=update          — Update title of an image analysis
 */

const PLUGIN_SLUG = 'image-to-memory';

// ─── Auto-install ────────────────────────────────────────────

async function ensurePluginInstalled() {
  const existing = await db.execute(sql`SELECT id FROM plugins WHERE slug = ${PLUGIN_SLUG}`);
  if ((existing as any[]).length === 0) {
    await db.execute(sql`
      INSERT INTO plugins (slug, name, description, type, status, icon, category)
      VALUES (
        ${PLUGIN_SLUG},
        'Image-to-Memory',
        'Upload images → AI describes → save as searchable memory. Photos, screenshots, whiteboards.',
        'extension',
        'active',
        'Image',
        'ai'
      )
    `);
  }
}

// ─── Ensure image_analyses table ─────────────────────────────

async function ensureImageTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS image_analyses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      title TEXT,
      description TEXT,
      image_data TEXT,
      image_size INTEGER,
      image_format TEXT DEFAULT 'png',
      image_width INTEGER,
      image_height INTEGER,
      tags TEXT[] DEFAULT '{}',
      context_type TEXT DEFAULT 'general',
      provider TEXT,
      model TEXT,
      word_count INTEGER,
      saved_as_memory BOOLEAN DEFAULT false,
      memory_id UUID,
      custom_prompt TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ─── AI Config ───────────────────────────────────────────────

interface VisionConfig {
  type: 'openai' | 'gemini' | 'ollama' | 'openrouter' | 'custom';
  key: string;
  model: string;
  url?: string;
}

async function getVisionConfig(): Promise<VisionConfig | null> {
  const settings = await db.execute(
    sql`SELECT key, value FROM settings WHERE key IN (
      'openai_api_key', 'gemini_api_key', 'ollama_url',
      'openrouter_api_key', 'custom_api_key', 'custom_api_url',
      'chat_provider'
    )`
  );
  const config: Record<string, string> = {};
  for (const row of settings as any[]) {
    config[row.key] = row.value;
  }

  const preferred = config.chat_provider;

  // Priority: explicit preference → OpenAI → Gemini → OpenRouter → Ollama
  if (preferred === 'openai' && (config.openai_api_key || process.env.OPENAI_API_KEY)) {
    return { type: 'openai', key: config.openai_api_key || process.env.OPENAI_API_KEY!, model: 'gpt-4o' };
  }
  if (preferred === 'gemini' && (config.gemini_api_key || process.env.GEMINI_API_KEY)) {
    return { type: 'gemini', key: config.gemini_api_key || process.env.GEMINI_API_KEY!, model: 'gemini-2.0-flash-lite' };
  }
  if (preferred === 'openrouter' && (config.openrouter_api_key || process.env.OPENROUTER_API_KEY)) {
    return { type: 'openrouter', key: config.openrouter_api_key || process.env.OPENROUTER_API_KEY!, model: 'google/gemini-2.0-flash-001', url: 'https://openrouter.ai/api/v1/chat/completions' };
  }
  if (preferred === 'ollama' && (config.ollama_url || process.env.OLLAMA_URL)) {
    return { type: 'ollama', key: '', model: 'llava', url: config.ollama_url || process.env.OLLAMA_URL };
  }

  // Auto-detect
  if (config.openai_api_key || process.env.OPENAI_API_KEY) {
    return { type: 'openai', key: config.openai_api_key || process.env.OPENAI_API_KEY!, model: 'gpt-4o' };
  }
  if (config.gemini_api_key || process.env.GEMINI_API_KEY) {
    return { type: 'gemini', key: config.gemini_api_key || process.env.GEMINI_API_KEY!, model: 'gemini-2.0-flash-lite' };
  }
  if (config.openrouter_api_key || process.env.OPENROUTER_API_KEY) {
    return { type: 'openrouter', key: config.openrouter_api_key || process.env.OPENROUTER_API_KEY!, model: 'google/gemini-2.0-flash-001', url: 'https://openrouter.ai/api/v1/chat/completions' };
  }
  if (config.ollama_url || process.env.OLLAMA_URL) {
    return { type: 'ollama', key: '', model: 'llava', url: config.ollama_url || process.env.OLLAMA_URL };
  }

  return null;
}

// ─── Context type prompts ────────────────────────────────────

const CONTEXT_PROMPTS: Record<string, string> = {
  general: 'Describe this image in detail. Include: what you see, any text visible, key objects, people, colors, mood, and context. If there are diagrams or charts, describe their structure and data.',
  screenshot: 'This is a screenshot. Describe: what application/website is shown, the content/text visible, any UI elements of note, and the purpose or context of what is being shown.',
  whiteboard: 'This is a whiteboard or handwritten notes. Transcribe all visible text exactly. Describe any diagrams, arrows, connections, or visual organization. Explain the likely topic and key ideas being discussed.',
  document: 'This is a scanned or photographed document. Transcribe all visible text as accurately as possible. Note any formatting, headers, signatures, stamps, or other document elements.',
  diagram: 'This is a diagram, flowchart, or technical drawing. Describe the structure, connections, flow, labels, and overall purpose. Explain what system or concept it represents.',
  photo: 'This is a photograph. Describe: the scene, subjects, setting, lighting, mood, and any notable details. If there are people, describe what they are doing without identifying them.',
  chart: 'This is a chart or graph. Describe: the type of chart, axes/labels, data trends, key data points, and what insight or conclusion the chart conveys.',
  meme: 'This is a meme or social media image. Describe the visual content, any text/captions, the cultural reference or joke being made, and the tone/humor.',
};

// ─── Vision API calls ────────────────────────────────────────

async function analyzeWithOpenAI(
  config: VisionConfig,
  base64Image: string,
  mimeType: string,
  prompt: string,
): Promise<{ description: string; tags: string[] }> {
  const endpoint = config.url || 'https://api.openai.com/v1/chat/completions';
  const extraHeaders: Record<string, string> = {};
  if (config.type === 'openrouter') {
    extraHeaders['HTTP-Referer'] = 'https://mindstore.app';
    extraHeaders['X-Title'] = 'MindStore';
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.key}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'You are a precise image analyst for a personal knowledge management system. Your descriptions will become searchable memories. Be detailed but organized. After your description, provide a JSON array of 3-8 relevant tags on the last line, formatted as: TAGS: ["tag1", "tag2", "tag3"]',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' },
            },
          ],
        },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Vision API failed (${res.status})`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return extractTagsFromResponse(text);
}

async function analyzeWithGemini(
  config: VisionConfig,
  base64Image: string,
  mimeType: string,
  prompt: string,
): Promise<{ description: string; tags: string[] }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${prompt}\n\nAfter your description, provide a JSON array of 3-8 relevant tags on the last line, formatted as: TAGS: ["tag1", "tag2", "tag3"]` },
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1500,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini Vision failed (${res.status})`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return extractTagsFromResponse(text);
}

async function analyzeWithOllama(
  config: VisionConfig,
  base64Image: string,
  _mimeType: string,
  prompt: string,
): Promise<{ description: string; tags: string[] }> {
  const baseUrl = (config.url || 'http://localhost:11434').replace(/\/$/, '');

  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt: `${prompt}\n\nAfter your description, provide a JSON array of 3-8 relevant tags on the last line, formatted as: TAGS: ["tag1", "tag2", "tag3"]`,
      images: [base64Image],
      stream: false,
      options: { temperature: 0.3 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama vision failed (${res.status}). Is '${config.model}' model pulled?`);
  }

  const data = await res.json();
  const text = data.response || '';
  return extractTagsFromResponse(text);
}

// ─── Tag extraction ──────────────────────────────────────────

function extractTagsFromResponse(text: string): { description: string; tags: string[] } {
  let description = text;
  let tags: string[] = [];

  // Try to extract TAGS: ["tag1", "tag2"] from the last lines
  const tagMatch = text.match(/TAGS:\s*\[([^\]]+)\]/i);
  if (tagMatch) {
    try {
      tags = JSON.parse(`[${tagMatch[1]}]`);
      description = text.replace(/TAGS:\s*\[([^\]]*)\]/i, '').trim();
    } catch {
      // Fall back to comma-separated
      tags = tagMatch[1]
        .split(',')
        .map((t) => t.replace(/["\s]/g, '').trim())
        .filter(Boolean);
      description = text.replace(/TAGS:\s*\[([^\]]*)\]/i, '').trim();
    }
  }

  // Clean up tags
  tags = tags
    .map((t) => String(t).toLowerCase().trim())
    .filter((t) => t.length > 0 && t.length < 40)
    .slice(0, 10);

  return { description, tags };
}

// ─── GET Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensurePluginInstalled();
    await ensureImageTable();

    const action = req.nextUrl.searchParams.get('action') || 'images';

    // ─── List images ──────────────────────────────────────────
    if (action === 'images') {
      const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');
      const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');

      const images = await db.execute(sql`
        SELECT id, title, description, image_format, image_size, image_width, image_height,
               tags, context_type, provider, model, word_count,
               saved_as_memory, memory_id, created_at
        FROM image_analyses
        WHERE user_id = ${userId}::uuid
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM image_analyses WHERE user_id = ${userId}::uuid
      `);

      return NextResponse.json({
        images,
        total: parseInt((countResult as any[])[0]?.total || '0'),
      });
    }

    // ─── Stats ────────────────────────────────────────────────
    if (action === 'stats') {
      const stats = await db.execute(sql`
        SELECT
          COUNT(*) as total_images,
          COUNT(*) FILTER (WHERE saved_as_memory = true) as saved_count,
          COALESCE(SUM(word_count), 0) as total_words,
          COALESCE(SUM(image_size), 0) as total_size,
          COALESCE(AVG(word_count), 0) as avg_words
        FROM image_analyses
        WHERE user_id = ${userId}::uuid
      `);

      const row = (stats as any[])[0] || {};
      return NextResponse.json({
        totalImages: parseInt(row.total_images || '0'),
        savedCount: parseInt(row.saved_count || '0'),
        totalWords: parseInt(row.total_words || '0'),
        totalSize: parseInt(row.total_size || '0'),
        avgWords: Math.round(parseFloat(row.avg_words || '0')),
      });
    }

    // ─── Check available providers ────────────────────────────
    if (action === 'check') {
      const config = await getVisionConfig();
      return NextResponse.json({
        available: !!config,
        provider: config?.type || null,
        model: config?.model || null,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Image plugin GET error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 });
  }
}

// ─── POST Handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensurePluginInstalled();
    await ensureImageTable();

    const contentType = req.headers.get('content-type') || '';

    // ─── Analyze: multipart image upload ──────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('image') as File | null;
      const contextType = (formData.get('context') as string) || 'general';
      const customPrompt = formData.get('prompt') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({
          error: `Unsupported image type: ${file.type}. Supported: JPEG, PNG, GIF, WebP, BMP, TIFF`,
        }, { status: 400 });
      }

      // Size limit: 20MB
      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image too large. Maximum 20MB.' }, { status: 400 });
      }

      // Get vision config
      const config = await getVisionConfig();
      if (!config) {
        return NextResponse.json({
          error: 'No Vision AI provider available. Configure OpenAI, Gemini, or Ollama in Settings.',
        }, { status: 400 });
      }

      // Convert to base64
      const arrayBuffer = await file.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString('base64');

      // Build analysis prompt
      const basePrompt = CONTEXT_PROMPTS[contextType] || CONTEXT_PROMPTS.general;
      const prompt = customPrompt
        ? `${basePrompt}\n\nAdditional context from the user: ${customPrompt}`
        : basePrompt;

      // Run vision analysis
      let result: { description: string; tags: string[] };

      if (config.type === 'gemini') {
        result = await analyzeWithGemini(config, base64Image, file.type, prompt);
      } else if (config.type === 'ollama') {
        result = await analyzeWithOllama(config, base64Image, file.type, prompt);
      } else {
        // OpenAI, OpenRouter, or custom — all use OpenAI-compatible format
        result = await analyzeWithOpenAI(config, base64Image, file.type, prompt);
      }

      // Generate a title from the description
      const firstSentence = result.description.split(/[.!?\n]/)[0]?.trim() || 'Image Analysis';
      const title = firstSentence.length > 60
        ? firstSentence.slice(0, 57) + '...'
        : firstSentence;

      // Word count
      const wordCount = result.description.split(/\s+/).filter(Boolean).length;

      // Store the analysis — save a thumbnail (first 500KB of base64 for display)
      const thumbnailData = base64Image.length > 700000
        ? null  // Don't store full images > ~500KB as base64 in DB
        : `data:${file.type};base64,${base64Image}`;

      const id = crypto.randomUUID();
      const tagsArray = `{${result.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`;

      await db.execute(sql`
        INSERT INTO image_analyses (id, user_id, title, description, image_data, image_size,
          image_format, tags, context_type, provider, model, word_count, custom_prompt)
        VALUES (
          ${id}::uuid, ${userId}::uuid, ${title}, ${result.description},
          ${thumbnailData}, ${file.size}, ${file.type.split('/')[1] || 'png'},
          ${tagsArray}::text[], ${contextType}, ${config.type}, ${config.model},
          ${wordCount}, ${customPrompt}
        )
      `);

      return NextResponse.json({
        id,
        title,
        description: result.description,
        tags: result.tags,
        contextType,
        provider: config.type,
        model: config.model,
        wordCount,
        imageSize: file.size,
        imageFormat: file.type.split('/')[1] || 'png',
      });
    }

    // ─── JSON body actions ────────────────────────────────────
    const body = await req.json();
    const action = body.action;

    // ─── Save as memory ───────────────────────────────────────
    if (action === 'save') {
      const { imageId, customTitle } = body;
      if (!imageId) return NextResponse.json({ error: 'imageId required' }, { status: 400 });

      const images = await db.execute(sql`
        SELECT * FROM image_analyses
        WHERE id = ${imageId}::uuid AND user_id = ${userId}::uuid
      `);
      const image = (images as any[])[0];
      if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });

      if (image.saved_as_memory) {
        return NextResponse.json({ error: 'Already saved as memory', memoryId: image.memory_id }, { status: 409 });
      }

      const memoryTitle = customTitle || image.title || 'Image Analysis';
      const tags = (image.tags || []) as string[];
      const tagLine = tags.length > 0 ? `\nTags: ${tags.join(', ')}` : '';
      const contextLine = image.context_type !== 'general' ? `\nType: ${image.context_type}` : '';
      const content = `# ${memoryTitle}\n\n${image.description}${tagLine}${contextLine}`;

      // Generate embedding
      let embedding: number[] | null = null;
      try {
        const embeds = await generateEmbeddings([content]);
        if (embeds && embeds.length > 0) embedding = embeds[0];
      } catch (e) {
        console.error('Embedding generation failed (non-fatal):', e);
      }

      // Create memory
      const memoryId = crypto.randomUUID();
      if (embedding) {
        const embStr = `[${embedding.join(',')}]`;
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, embedding, source_type, source_title, created_at, imported_at)
          VALUES (${memoryId}::uuid, ${userId}::uuid, ${content}, ${embStr}::vector, 'image', ${memoryTitle}, NOW(), NOW())
        `);
      } else {
        await db.execute(sql`
          INSERT INTO memories (id, user_id, content, source_type, source_title, created_at, imported_at)
          VALUES (${memoryId}::uuid, ${userId}::uuid, ${content}, 'image', ${memoryTitle}, NOW(), NOW())
        `);
      }

      // Update image analysis
      await db.execute(sql`
        UPDATE image_analyses
        SET saved_as_memory = true, memory_id = ${memoryId}::uuid
        WHERE id = ${imageId}::uuid
      `);

      return NextResponse.json({
        memoryId,
        title: memoryTitle,
        wordCount: image.word_count,
        message: 'Image analysis saved as memory',
      });
    }

    // ─── Re-analyze ───────────────────────────────────────────
    if (action === 'reanalyze') {
      const { imageId, context, prompt } = body;
      if (!imageId) return NextResponse.json({ error: 'imageId required' }, { status: 400 });

      const images = await db.execute(sql`
        SELECT * FROM image_analyses
        WHERE id = ${imageId}::uuid AND user_id = ${userId}::uuid
      `);
      const image = (images as any[])[0];
      if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 });

      if (!image.image_data) {
        return NextResponse.json({ error: 'Image data not available for re-analysis' }, { status: 400 });
      }

      const config = await getVisionConfig();
      if (!config) {
        return NextResponse.json({ error: 'No Vision AI provider available' }, { status: 400 });
      }

      // Extract base64 from data URL
      const base64Match = image.image_data.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) {
        return NextResponse.json({ error: 'Invalid stored image data' }, { status: 400 });
      }
      const mimeType = base64Match[1];
      const base64Data = base64Match[2];

      const contextType = context || image.context_type || 'general';
      const basePrompt = CONTEXT_PROMPTS[contextType] || CONTEXT_PROMPTS.general;
      const fullPrompt = prompt ? `${basePrompt}\n\nAdditional: ${prompt}` : basePrompt;

      let result: { description: string; tags: string[] };
      if (config.type === 'gemini') {
        result = await analyzeWithGemini(config, base64Data, mimeType, fullPrompt);
      } else if (config.type === 'ollama') {
        result = await analyzeWithOllama(config, base64Data, mimeType, fullPrompt);
      } else {
        result = await analyzeWithOpenAI(config, base64Data, mimeType, fullPrompt);
      }

      const firstSentence = result.description.split(/[.!?\n]/)[0]?.trim() || 'Image Analysis';
      const title = firstSentence.length > 60 ? firstSentence.slice(0, 57) + '...' : firstSentence;
      const wordCount = result.description.split(/\s+/).filter(Boolean).length;
      const tagsArray = `{${result.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`;

      await db.execute(sql`
        UPDATE image_analyses
        SET title = ${title}, description = ${result.description},
            tags = ${tagsArray}::text[], context_type = ${contextType},
            provider = ${config.type}, model = ${config.model},
            word_count = ${wordCount}, custom_prompt = ${prompt || null}
        WHERE id = ${imageId}::uuid
      `);

      return NextResponse.json({
        id: imageId,
        title,
        description: result.description,
        tags: result.tags,
        contextType,
        provider: config.type,
        model: config.model,
        wordCount,
      });
    }

    // ─── Delete ───────────────────────────────────────────────
    if (action === 'delete') {
      const { imageId } = body;
      if (!imageId) return NextResponse.json({ error: 'imageId required' }, { status: 400 });

      await db.execute(sql`
        DELETE FROM image_analyses
        WHERE id = ${imageId}::uuid AND user_id = ${userId}::uuid
      `);

      return NextResponse.json({ deleted: true });
    }

    // ─── Update title ─────────────────────────────────────────
    if (action === 'update') {
      const { imageId, title } = body;
      if (!imageId || !title) return NextResponse.json({ error: 'imageId and title required' }, { status: 400 });

      await db.execute(sql`
        UPDATE image_analyses
        SET title = ${title}
        WHERE id = ${imageId}::uuid AND user_id = ${userId}::uuid
      `);

      return NextResponse.json({ updated: true, title });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Image plugin POST error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 });
  }
}
