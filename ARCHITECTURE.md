# MindStore Architecture v2 — Server-First

## Why Server-Side
- Cross-device access (phone, laptop, tablet — same mind)
- PostgreSQL + pgvector = industrial-strength vector search with SQL power
- Multi-modal storage (images, audio, video metadata)
- Community can build plugins, importers, retrieval methods
- OAuth for AI providers — users bring their own keys
- Proper API for any client (web, mobile, CLI, MCP)

## Stack
- **Runtime:** Node.js + TypeScript
- **Framework:** Next.js 16 (App Router) — serves both UI and API
- **Database:** PostgreSQL + pgvector extension
- **Search:** Triple-layer retrieval:
  1. BM25 full-text (pg_trgm + tsvector)
  2. Vector similarity (pgvector, cosine distance)
  3. Hierarchical tree index (PageIndex-inspired reasoning paths)
  4. Reciprocal Rank Fusion to combine all three
- **Embeddings:** OpenAI text-embedding-3-small (default), pluggable
- **Storage:** PostgreSQL for structured data, S3-compatible for files/media
- **Auth:** NextAuth.js with OAuth (Google, GitHub, email)
- **MCP:** Server component, stdio + HTTP transport

## Database Schema

### memories
- id UUID PK
- user_id UUID FK
- content TEXT
- embedding vector(1536)
- content_type ENUM('text', 'image', 'audio', 'video', 'code', 'conversation')
- source_type TEXT (obsidian, notion, chatgpt, claude, text, url, image, audio)
- source_id TEXT
- source_title TEXT
- metadata JSONB
- parent_id UUID (for hierarchical indexing)
- tree_path TEXT (materialized path for tree traversal)
- created_at TIMESTAMPTZ
- imported_at TIMESTAMPTZ
- tsvector tsvector (auto-generated for BM25)

### tree_index (PageIndex-inspired hierarchical TOC)
- id UUID PK
- user_id UUID FK
- title TEXT
- summary TEXT
- level INT (0=root, 1=section, 2=subsection, etc.)
- parent_id UUID
- memory_ids UUID[] (which memories belong to this node)
- embedding vector(1536) (embedding of the summary)

### profile
- id UUID PK
- user_id UUID FK
- key TEXT
- value TEXT
- category TEXT
- confidence REAL
- source TEXT
- updated_at TIMESTAMPTZ
- UNIQUE(user_id, key)

### facts
- id UUID PK
- user_id UUID FK
- fact TEXT
- category TEXT
- entities TEXT[] (extracted named entities)
- learned_at TIMESTAMPTZ

### connections (cross-pollination cache)
- id UUID PK
- user_id UUID FK
- memory_a_id UUID FK
- memory_b_id UUID FK
- similarity REAL
- surprise REAL
- bridge_concept TEXT
- discovered_at TIMESTAMPTZ

### contradictions (cached)
- id UUID PK
- user_id UUID FK
- memory_a_id UUID FK
- memory_b_id UUID FK
- topic TEXT
- description TEXT
- detected_at TIMESTAMPTZ

### media
- id UUID PK
- user_id UUID FK
- memory_id UUID FK
- file_type TEXT
- file_path TEXT
- file_size BIGINT
- metadata JSONB (EXIF, dimensions, duration, etc.)
- transcript TEXT (for audio/video)
- created_at TIMESTAMPTZ

## Retrieval Pipeline (our innovation)

### Triple-Layer Fusion Retrieval
1. **BM25 Layer:** PostgreSQL full-text search with tsvector + ts_rank_cd
2. **Vector Layer:** pgvector cosine similarity on embeddings
3. **Tree Layer:** Navigate hierarchical index (PageIndex-inspired) — find the right "section" first, then drill into memories
4. **Fusion:** Reciprocal Rank Fusion (RRF) combines all three scores:
   `score = Σ 1/(k + rank_i)` for each layer

### Why This Is Better Than Everything Else
- BM25 alone misses semantic meaning
- Vector alone misses exact keywords and structure
- Tree alone is slow for simple queries
- RRF fusion gets the best of all three — handles both "find exact phrase" and "find conceptually similar" queries
- The tree layer adds REASONING about document structure that no other personal knowledge tool has

## Community Extension Points
- **Importers:** npm packages that implement ImporterInterface
- **Retrievers:** plug in new retrieval methods
- **Analyzers:** custom insight engines (like our cross-pollination, forgetting curve)
- **MCP Tools:** community can add new MCP tools
- **UI Widgets:** dashboard cards via plugin system

## Multi-Modal Support
- **Images:** stored in media table, embeddings via CLIP or caption-then-embed
- **Audio:** transcribe via Whisper, store transcript + audio file
- **Video:** extract keyframes + audio transcript
- **Code:** language-aware chunking, AST-based
- **Conversations:** preserve turn structure, not just flat text
