<div align="center">

# 🧠 MindStore

**Your Mind, Connected to Every AI.**

Import your ChatGPT conversations, Obsidian vault, Notion pages — then search semantically, discover hidden connections in your own thinking, and plug your knowledge into *any* AI via MCP.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)

[**Try It →**](https://mindstore.org) · [**How It Works**](#how-it-works) · [**MCP Setup**](#connect-your-ai)

</div>

---

## The Problem

Every AI you talk to starts from zero. Your ChatGPT doesn't know what you told Claude. Your Copilot doesn't know your Obsidian notes. Your knowledge is scattered across 15 apps and none of them talk to each other.

**MindStore fixes this.** One place for all your knowledge. One protocol (MCP) to connect it to every AI.

## What Makes MindStore Different

This isn't another note-taking app with a chatbot bolted on. MindStore has features no other knowledge tool offers:

### 🧬 Knowledge Fingerprint
A 3D WebGL visualization of your mind's topology. See your knowledge clusters, connections between ideas, and blind spots — rendered as an interactive graph you can rotate and explore.

### ⚡ Cross-Pollination Engine
Automatically discovers unexpected bridges between distant pieces of your knowledge. *"Your note about Japanese gardening philosophy shares a structural pattern with your ChatGPT conversation about software architecture..."*

### 🔴 Contradiction Detector
Surfaces places where your own thinking conflicts. Not errors — evolution of thought. *"You said X was 'always best' in March, but argued for Y in June."*

### ⏰ Forgetting Curve
Implements Ebbinghaus spaced repetition across your **entire knowledge base**. Alerts you when knowledge is fading. *"You learned about quantum computing 47 days ago and haven't revisited it."*

### 📊 Mind Diff
*"What did I learn this week? How has my thinking on AI changed in the last 3 months?"* Track your intellectual growth over time.

### 💪 Knowledge Metabolism Score
A 0-10 fitness tracker for your brain. Measures intake rate, connection density, source diversity, and growth velocity.

### 😈 Devil's Advocate Mode
Challenges your assumptions using **your own stored knowledge**. Not generic counterarguments — actual contradicting evidence from things you've written and said.

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Your Data   │────▶│   MindStore   │────▶│   Any AI Client  │
│              │     │              │     │                 │
│ • ChatGPT    │     │ • Chunk      │     │ • Claude Desktop│
│ • Obsidian   │     │ • Embed      │     │ • VS Code       │
│ • Notion     │     │ • Index      │     │ • Cursor        │
│ • Text/MD    │     │ • Connect    │     │ • ChatGPT       │
└─────────────┘     └──────────────┘     └─────────────────┘
```

1. **Import** — Drop your ChatGPT export, Obsidian vault, Notion pages, or any text files
2. **Index** — MindStore chunks, embeds, and indexes everything semantically
3. **Search & Discover** — Query by meaning, find hidden connections, track your thinking over time
4. **Connect** — Any MCP-compatible AI gets full context about you automatically

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 16 with [pgvector](https://github.com/pgvector/pgvector) extension
- OpenAI API key (for embeddings + chat)

### Setup

```bash
git clone https://github.com/WarriorSushi/mindstore.git
cd mindstore
npm install

# Create database
createdb mindstore
psql -d mindstore -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Configure
cp .env.example .env
# Edit .env: set DATABASE_URL and optionally OPENAI_API_KEY

# Run migrations
npx tsx src/server/migrate.ts

# Start
npm run dev
# Open http://localhost:3000
```

Add your OpenAI API key in Settings (stored securely server-side in PostgreSQL).

## Connect Your AI

MindStore exposes an MCP server that any AI client can connect to.

### Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "mindstore": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "env": { "MINDSTORE_DB_PATH": "~/.mindstore/mindstore.db" }
    }
  }
}
```

### VS Code / Cursor
Add to your settings:
```json
{
  "mcp": {
    "servers": {
      "mindstore": {
        "command": "npx",
        "args": ["tsx", "src/mcp/server.ts"]
      }
    }
  }
}
```

### MCP Tools Available

| Tool | Description |
|------|-------------|
| `search_mind` | Semantic + keyword search across all knowledge |
| `get_context` | Assembled context for personalizing AI responses |
| `get_profile` | User preferences, traits, goals |
| `learn_fact` | Store new facts during conversation |
| `get_mind_stats` | Knowledge base statistics |
| `get_timeline` | Recent knowledge entries |
| `get_connections` | Cross-pollination discoveries |
| `get_contradictions` | Conflicting beliefs in your data |
| `get_metabolism` | Knowledge metabolism score |

Plus **Devil's Advocate** prompt — challenges your beliefs using your own stored knowledge.

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Landing page
│   ├── app/                # Main app
│   │   ├── page.tsx        # Dashboard
│   │   ├── import/         # File upload & import
│   │   ├── chat/           # RAG chat interface
│   │   ├── explore/        # Browse knowledge
│   │   ├── learn/          # Teach your mind
│   │   ├── fingerprint/    # 3D knowledge graph
│   │   ├── insights/       # Consolidation reports
│   │   ├── connect/        # MCP setup guides
│   │   └── settings/       # API key, data management
│   └── api/v1/             # Server API routes (13 endpoints)
├── lib/
│   ├── openai.ts           # Thin API client (calls server routes)
│   ├── search.ts           # RAG prompt builder
│   ├── parsers.ts          # Import parsers
│   └── demo.ts             # Demo mode with sample data
├── server/
│   ├── db.ts               # PostgreSQL connection (Drizzle ORM)
│   ├── schema.ts           # Database schema with pgvector
│   ├── retrieval.ts        # Triple-layer search (BM25 + vector + tree)
│   ├── apikey.ts           # Server-side API key management
│   └── migrate.ts          # Database migrations
├── mcp/
│   └── server.ts           # MCP server (SQLite + FTS5, standalone)
└── components/ui/          # shadcn/ui components
```

**Architecture:**
- **Web app** — Next.js with server-side API routes, PostgreSQL + pgvector
- **MCP server** — SQLite + FTS5, runs standalone, serves any AI client

## Tech Stack

- **Framework:** Next.js 16, TypeScript, Tailwind CSS
- **UI:** shadcn/ui, Framer Motion, Lucide icons
- **Visualization:** reagraph (WebGL 3D graphs)
- **Database:** PostgreSQL 16 + pgvector (cosine similarity search)
- **ORM:** Drizzle ORM
- **Search:** Triple-layer fusion (BM25 + vector + tree index)
- **Embeddings:** OpenAI text-embedding-3-small (BYO key)
- **Chat:** OpenAI streaming with RAG context injection
- **Protocol:** Model Context Protocol (MCP)

## Privacy

Your data stays on your own server. The web app stores everything in PostgreSQL with pgvector for semantic search. The MCP server uses a local SQLite file. Self-hosted, no tracking.

## License

MIT

---

<div align="center">

Built by [AltCorp](https://altcorp.frain.cloud)

**MindStore** — because your AI should know you.

</div>
