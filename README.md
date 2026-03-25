<div align="center">

# 🧠 MindStore

**Your Mind, Connected to Every AI.**

Import your ChatGPT conversations, Obsidian vault, Notion pages — then search semantically, discover hidden connections in your own thinking, and plug your knowledge into *any* AI via MCP.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)

[**Try It →**](https://mindstore-sandy.vercel.app) · [**How It Works**](#how-it-works) · [**MCP Setup**](#connect-your-ai) · [**Docs**](./docs/index.md)

</div>

---

## The Problem

Every AI you talk to starts from zero. Your ChatGPT doesn't know what you told Claude. Your Copilot doesn't know your Obsidian notes. Your knowledge is scattered across 15 apps and none of them talk to each other.

**MindStore fixes this.** One place for all your knowledge. One protocol (MCP) to connect it to every AI.

## What Makes MindStore Different

This isn't another note-taking app with a chatbot bolted on:

### 🧬 Knowledge Fingerprint
A 3D WebGL visualization of your mind's topology. See your knowledge clusters, connections between ideas, and blind spots — rendered as an interactive graph.

### ⚡ Cross-Pollination Engine
Discovers unexpected bridges between distant pieces of your knowledge. Works without API keys using PostgreSQL trigram similarity, or with embeddings for deeper semantic connections.

### 🔴 Contradiction Detector
Surfaces places where your own thinking conflicts. Not errors — evolution of thought.

### ⏰ Forgetting Curve
Ebbinghaus spaced repetition across your **entire knowledge base**. Alerts you when knowledge is fading.

### 📊 Mind Diff & Metabolism Score
Track your intellectual growth. A 0-10 fitness tracker for your brain — measures intake rate, connection density, source diversity, and growth velocity.

### 🔌 MCP Server
Connect your MindStore to **any AI** — Claude Desktop, Cursor, VS Code, OpenClaw. Your AI gets full context about you automatically.

### 🌐 MindStore Everywhere
A browser companion for capturing selections, pages, and supported AI conversations straight into MindStore, with lightweight on-page recall.

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Your Data   │────▶│   MindStore   │────▶│   Any AI Client  │
│              │     │              │     │                 │
│ • ChatGPT    │     │ • Chunk      │     │ • Claude Desktop│
│ • Obsidian   │     │ • Embed      │     │ • VS Code       │
│ • Notion     │     │ • Index      │     │ • Cursor        │
│ • Text/URLs  │     │ • Connect    │     │ • OpenClaw      │
└─────────────┘     └──────────────┘     └─────────────────┘
```

1. **Import** — Drop your ChatGPT export (ZIP or JSON), Obsidian vault, Notion pages, or text files
2. **Index** — MindStore chunks, embeds, and indexes everything with triple-layer fusion search
3. **Search & Discover** — Query by meaning, find connections, track your thinking over time
4. **Connect** — Any MCP-compatible AI gets full context about you automatically

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 16+ with [pgvector](https://github.com/pgvector/pgvector) and pg_trgm extensions

That is the real hard requirement. You do **not** need Supabase specifically, and you do **not** need Vercel specifically. Any compatible PostgreSQL host and any Node-capable deployment target work.

### Setup

```bash
git clone https://github.com/WarriorSushi/mindstore.git
cd mindstore
npm install

# Configure
cp .env.example .env
# Edit .env: set DATABASE_URL (required)
# Optionally add GEMINI_API_KEY (free) for embeddings + chat

# Run migrations
npm run migrate

# Start dev server
npm run dev
# Open http://localhost:3000
```

### AI Provider Options (pick one)

| Provider | Cost | Setup |
|----------|------|-------|
| **Google Gemini** | Free | Get key at [aistudio.google.com](https://aistudio.google.com/apikey) |
| **OpenAI** | ~$0.01/10 queries | Get key at [platform.openai.com](https://platform.openai.com/api-keys) |
| **Ollama** | Free (local) | Install from [ollama.ai](https://ollama.ai), run `ollama pull nomic-embed-text` |

Configure via the Settings page or environment variables. **MindStore works for browsing and importing without any AI key** — you only need one for semantic search, chat, and AI-heavy plugin flows.

## What You Actually Need

- Required:
  PostgreSQL with `pgvector` and `pg_trgm`
- Optional:
  Vercel, Supabase, Google OAuth, provider API keys
- AI access today:
  API key or local Ollama
- Subscription-style provider login:
  Planned, not the mainline path yet

## Connect Your AI

MindStore exposes an MCP server at `/api/mcp` that any AI client can connect to.

### Claude Desktop / Cursor / VS Code
```json
{
  "mcpServers": {
    "mindstore": {
      "url": "https://your-mindstore-url.vercel.app/api/mcp"
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `search_mind` | Semantic + keyword search across all knowledge |
| `get_context` | Assembled context for a topic |
| `get_profile` | Knowledge base summary and statistics |

### MCP Resources

| Resource | Description |
|----------|-------------|
| `mindstore://profile` | Knowledge base summary |
| `mindstore://recent` | Recently added memories |

## Deploy to Vercel

```bash
# Push to GitHub, connect repo in Vercel, set env vars:
DATABASE_URL=postgres://...
AUTH_SECRET=your-random-secret
# Optional:
GEMINI_API_KEY=AIza...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

See [PRODUCTION.md](PRODUCTION.md) for full deployment guide.

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Landing page
│   ├── app/                # Main app (9 pages)
│   │   ├── page.tsx        # Dashboard + onboarding
│   │   ├── import/         # ChatGPT ZIP/JSON, files, URLs
│   │   ├── chat/           # RAG chat with source citations
│   │   ├── explore/        # Browse & filter knowledge
│   │   ├── learn/          # AI interview to learn about you
│   │   ├── fingerprint/    # 3D WebGL knowledge graph
│   │   ├── insights/       # Connections, contradictions, metabolism
│   │   ├── connect/        # MCP setup guides
│   │   └── settings/       # Multi-provider config, data management
│   └── api/
│       ├── health/         # Production health check
│       ├── mcp/            # MCP server (JSON-RPC over HTTP)
│       └── v1/             # 12 REST API routes
├── lib/                    # Client utilities
├── server/
│   ├── db.ts               # PostgreSQL (Drizzle ORM + pgvector)
│   ├── schema.ts           # Full schema with vector columns
│   ├── retrieval.ts        # Triple-layer fusion (BM25 + vector + tree + RRF)
│   ├── embeddings.ts       # Multi-provider (OpenAI / Gemini / Ollama)
│   └── migrate.ts          # Idempotent migrations
└── components/ui/          # shadcn/ui
```

## Tech Stack

- **Framework:** Next.js 16 + TypeScript + Tailwind CSS
- **UI:** shadcn/ui, Framer Motion, reagraph (WebGL 3D)
- **Database:** PostgreSQL + pgvector + pg_trgm
- **ORM:** Drizzle ORM (postgres-js)
- **Search:** Triple-layer fusion — BM25 (tsvector) + vector similarity (pgvector) + tree-navigated retrieval, fused with Reciprocal Rank Fusion
- **Embeddings:** OpenAI text-embedding-3-small / Gemini text-embedding-004 / Ollama nomic-embed-text
- **Chat:** Streaming SSE with RAG context injection (OpenAI or Gemini)
- **Auth:** NextAuth v5 with Google OAuth
- **Protocol:** Model Context Protocol (MCP) over HTTP

## Privacy

Self-hosted. Your data stays in your PostgreSQL database. No tracking, no analytics, no data collection. All AI calls go directly from your server to the provider — MindStore never sees your API keys in transit.

## License

MindStore is currently licensed under the [MIT License](./LICENSE).

For the full project policy around licensing direction, contributions, plugins, and commercial use, see [LICENSING.md](./LICENSING.md).

Brand usage is covered separately by [TRADEMARKS.md](./TRADEMARKS.md).

Project governance is described in [GOVERNANCE.md](./GOVERNANCE.md), and contribution-origin policy is described in [DCO.md](./DCO.md).

---

<div align="center">

Built by [AltCorp](https://altcorp.frain.cloud)

**MindStore** — because your AI should know you.

</div>
