# MindStore

**Your Mind, Connected to Every AI.**

MindStore is a personal mind layer — import your knowledge from anywhere, and connect it to any AI via MCP (Model Context Protocol). Your ChatGPT, Claude, VS Code Copilot, Cursor — they all get full context about you.

## What Makes MindStore Different

| Feature | MindStore | Mem.ai | Khoj | Rewind |
|---------|-----------|--------|------|--------|
| Universal AI connector (MCP) | ✅ | ❌ | ❌ | ❌ |
| Import Obsidian/Notion/ChatGPT | ✅ | ❌ | Partial | ❌ |
| BYOM (Bring Your Own Model) | ✅ | ❌ | ✅ | ❌ |
| Self-hostable | ✅ | ❌ | ✅ | ❌ |
| AI that learns about you | ✅ | Partial | ❌ | ❌ |
| Privacy-first | ✅ | ❌ | ✅ | ❌ |

## Quick Start

```bash
# Clone and install
git clone https://github.com/altcorp/mindstore.git
cd mindstore
npm install

# Run locally
npm run dev
# Open http://localhost:3000
```

## Connect to Your AI

Add MindStore to any MCP-compatible AI client:

### Claude Desktop
```json
{
  "mcpServers": {
    "mindstore": {
      "command": "npx",
      "args": ["mindstore-mcp"]
    }
  }
}
```

### VS Code / Cursor
```json
{
  "mcp": {
    "servers": {
      "mindstore": {
        "command": "npx",
        "args": ["mindstore-mcp"]
      }
    }
  }
}
```

## Features

### 📥 Import Everything
- **Obsidian** vaults (.md files with frontmatter, tags, wiki-links)
- **Notion** exports (markdown, CSV)
- **ChatGPT** conversation exports (conversations.json)
- **Claude** conversation exports
- **Any text** — markdown, plain text, CSV

### 🧠 AI Learning Engine
- Talk to your MindStore — it learns about you from conversation
- Extracts facts, preferences, goals, relationships automatically
- Builds a living profile that grows over time

### 🔍 Hybrid Search
- **Semantic search** — find by meaning, not just keywords
- **Full-text search** — SQLite FTS5 for fast keyword matching
- **Temporal search** — find knowledge by time period
- **Context assembly** — automatically builds coherent context from top results

### 🔗 MCP Server
MindStore exposes 6 tools, 1 resource, and 2 prompts via MCP:

**Tools:**
- `search_mind` — Search across all stored knowledge
- `get_context` — Get assembled context for a query
- `get_profile` — Get user profile and preferences
- `learn_fact` — Store a new fact about the user
- `get_mind_stats` — Statistics about stored knowledge
- `get_timeline` — Recent knowledge entries

**Resources:**
- `profile://summary` — Full profile summary

**Prompts:**
- `introduce_user` — Generate user introduction for AI context
- `provide_context` — Assemble relevant context for a query

### 🖥️ Web Dashboard
- Beautiful dark-mode interface
- Drag & drop file import
- Chat interface for AI learning
- MCP connection setup guides
- Knowledge statistics

## Architecture

- **Runtime:** Node.js + TypeScript
- **Framework:** Next.js 15 (App Router)
- **Database:** SQLite (portable, zero-config)
- **Search:** Hybrid vector + FTS5 full-text
- **Embeddings:** OpenAI text-embedding-3-small (with local fallback)
- **MCP:** @modelcontextprotocol/sdk
- **Storage:** Memvid SDK for advanced memory management

## API

```
GET  /api/search?q=query     — Semantic search
GET  /api/profile             — Get user profile
GET  /api/stats               — Mind statistics
POST /api/import              — Upload & import files
POST /api/profile             — Set profile facts
POST /api/chat                — Chat with your mind
```

## Self-Hosting

```bash
# Build for production
npm run build

# Start
npm start

# Or use Docker
docker-compose up
```

## Environment Variables

```env
# Optional — for better embeddings (falls back to local if not set)
OPENAI_API_KEY=sk-...

# Database path (default: ./data/mindstore.db)
MINDSTORE_DB_PATH=./data/mindstore.db
```

## License

MIT

---

Built by [AltCorp](https://altcorp.frain.cloud) — Making AI personal.
