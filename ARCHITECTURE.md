# MindStore — Architecture Design Document

## Product Vision
MindStore is a personal mind layer — a storage and retrieval system for your entire cognitive context. Import everything (Obsidian, Notion, ChatGPT exports), talk to AI that learns about you, and connect your mind layer to ANY AI model via MCP.

## Competitive Landscape
- **Mem.ai** — AI note-taking, but locked to their app. No MCP. No exports.
- **Khoj** — "AI second brain", open source, good but focused on search/automation
- **Rewind.ai** — Records everything on screen. Privacy concerns. No portability.
- **Personal AI** — Chatbot that learns from you. But walled garden.
- **None of them** expose a universal MCP server that works with ANY AI client.

## MindStore's Unique Edge
1. **Universal AI connector via MCP** — works with Claude Desktop, ChatGPT, VS Code, Cursor, any MCP client
2. **Import everything** — not just notes, but conversations, thoughts, preferences
3. **AI that actively learns** — asks questions, fills gaps, builds a living profile
4. **Bring your own AI** — use your existing ChatGPT/Claude subscription
5. **Privacy-first** — self-hostable, local-first option

## Technical Architecture

### Stack
- **Runtime**: Node.js (TypeScript)
- **Framework**: Next.js 15 (App Router) — web frontend + API routes
- **Database**: SQLite (via better-sqlite3) — portable, zero-config
- **Vector Store**: Built-in using sqlite-vss or custom embeddings with cosine similarity
- **Embeddings**: OpenAI text-embedding-3-small (or local via transformers.js)
- **MCP Server**: TypeScript MCP SDK (@modelcontextprotocol/sdk)
- **Deployment**: Docker-ready, self-hostable, or hosted at mindstore.org

### Core Modules

#### 1. Import Pipeline
```
obsidian/ → markdown parser → chunk → embed → store
notion/ → JSON/markdown parser → chunk → embed → store  
chatgpt/ → conversations.json parser → chunk → embed → store
claude/ → conversation parser → chunk → embed → store
text/ → raw text → chunk → embed → store
```

#### 2. Knowledge Store
- **Documents Table**: id, source_type, title, content, metadata, created_at
- **Chunks Table**: id, document_id, content, embedding (vector), position
- **Entities Table**: id, name, type, description (people, places, concepts)
- **Facts Table**: id, subject, predicate, object, confidence, source_chunk_id
- **Profile Table**: id, key, value, category, confidence (learned preferences/traits)

#### 3. AI Learning Engine
- Onboarding conversation that asks key questions
- Passive learning from imported content
- Active inference from conversations
- Profile builder (preferences, personality, knowledge areas, goals)

#### 4. Retrieval Engine
- Semantic search (vector similarity)
- Keyword search (full-text)
- Temporal search (by date range)
- Entity-based retrieval (by person, topic)
- Context assembly (combine relevant chunks into coherent context)

#### 5. MCP Server
Exposes MindStore as an MCP server with:
- **Tools**: search_mind, get_profile, get_context, learn_fact, ask_about
- **Resources**: profile://summary, knowledge://topic/{topic}, timeline://recent
- **Prompts**: introduce_user, provide_context

#### 6. Web Frontend
- Dashboard: mind stats, recent imports, knowledge map
- Import: drag & drop files, connect services
- Chat: talk to your mind, AI learns from conversation
- Profile: view/edit what AI knows about you
- Connect: MCP server config, API keys, integrations

### API Design
```
POST /api/import          — upload files (Obsidian, Notion, ChatGPT)
GET  /api/search          — semantic search across all knowledge
GET  /api/profile         — get user profile/preferences
POST /api/chat            — chat with your mind (AI learns)
GET  /api/context         — get assembled context for a query
POST /api/learn           — manually teach a fact
GET  /api/stats           — mind statistics
```

### MCP Server Interface
```typescript
// Tools
search_mind(query: string, limit?: number) → SearchResult[]
get_profile() → UserProfile
get_context(query: string) → AssembledContext
learn_fact(fact: string) → void
get_timeline(days?: number) → TimelineEntry[]

// Resources  
profile://summary → Full user profile
knowledge://topics → List of known topics
knowledge://topic/{name} → Everything about a topic
timeline://recent → Recent knowledge entries
preferences://all → User preferences

// Prompts
introduce_user → "Here's what I know about {user}..."
provide_context → "Given the query '{query}', here's relevant context..."
```

### File Structure
```
mindstore/
├── package.json
├── tsconfig.json
├── next.config.ts
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── README.md
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Dashboard
│   │   ├── import/page.tsx     # Import interface
│   │   ├── chat/page.tsx       # Chat with your mind
│   │   ├── profile/page.tsx    # View/edit profile
│   │   ├── connect/page.tsx    # MCP config & API keys
│   │   └── api/
│   │       ├── import/route.ts
│   │       ├── search/route.ts
│   │       ├── profile/route.ts
│   │       ├── chat/route.ts
│   │       ├── context/route.ts
│   │       ├── learn/route.ts
│   │       └── stats/route.ts
│   ├── lib/
│   │   ├── db.ts               # SQLite database
│   │   ├── embeddings.ts       # Embedding generation
│   │   ├── chunker.ts          # Document chunking
│   │   ├── search.ts           # Hybrid search engine
│   │   ├── profile.ts          # Profile management
│   │   ├── learning.ts         # AI learning engine
│   │   └── context.ts          # Context assembly
│   ├── importers/
│   │   ├── obsidian.ts         # Obsidian vault parser
│   │   ├── notion.ts           # Notion export parser
│   │   ├── chatgpt.ts          # ChatGPT export parser
│   │   ├── claude.ts           # Claude export parser
│   │   └── text.ts             # Raw text/markdown
│   ├── mcp/
│   │   ├── server.ts           # MCP server implementation
│   │   ├── tools.ts            # MCP tools
│   │   ├── resources.ts        # MCP resources
│   │   └── prompts.ts          # MCP prompts
│   └── components/
│       ├── Dashboard.tsx
│       ├── ImportZone.tsx
│       ├── ChatInterface.tsx
│       ├── ProfileView.tsx
│       ├── KnowledgeGraph.tsx
│       └── ConnectionSetup.tsx
└── data/
    └── mindstore.db            # SQLite database
```
