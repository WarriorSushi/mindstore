# Image-to-Memory

Upload images, get AI analysis, save descriptions as searchable memories.

## What It Does

- Accepts image uploads (JPEG, PNG, GIF, WebP, BMP, TIFF up to 20MB)
- Sends images to configured vision AI (OpenAI GPT-4o, Gemini, Ollama LLava, OpenRouter)
- 8 context modes: general, screenshot, whiteboard, document, diagram, photo, chart, meme
- Extracts structured descriptions with tags (TAGS: ["tag1", "tag2"] format)
- Stores analyses in `image_analyses` table with thumbnail
- Save any analysis as a full embedded memory
- Supports re-analysis with different context or custom prompt
- Gallery view with stats

## How To Use It

1. Configure a vision-capable AI provider in Settings
2. Upload an image in the Image-to-Memory page
3. Select context type (screenshot, whiteboard, etc.)
4. View the AI analysis and tags
5. Save as a memory for future retrieval

## Port Architecture

- Prompts, tag extraction, request builders in `src/server/plugins/ports/image-to-memory.ts`
- Vision API calls + route handling at `src/app/api/v1/plugins/image-to-memory/route.ts`
- Test at `tests/unit/image-to-memory.test.ts`
