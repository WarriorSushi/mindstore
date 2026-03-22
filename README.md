# 🧠 MindStore — Your Mind, Searchable

**Import your ChatGPT conversations, notes, and knowledge. Ask anything. Get answers from your own brain.**

[![Live Demo](https://img.shields.io/badge/Try%20It-mindstore.frain.cloud-violet?style=for-the-badge)](https://mindstore.frain.cloud)

---

## What is MindStore?

MindStore is a personal knowledge layer. You import everything — ChatGPT exports, notes, files, URLs — and MindStore makes it all **searchable by meaning**, not just keywords.

Ask your mind a question. Get synthesized answers with citations from your own knowledge.

## ✨ Features

- **📥 Import Everything** — ChatGPT conversation exports (JSON), text, markdown, files, URLs
- **🔍 Semantic Search** — Find ideas by meaning using AI embeddings
- **💬 Ask Your Mind** — Natural language Q&A with RAG (Retrieval-Augmented Generation)
- **🧠 AI Interview** — Talk to AI that learns about you through conversation
- **🔌 MCP Server** — Connect your mind to any AI (Claude, ChatGPT, Cursor) via Model Context Protocol
- **🔒 100% Private** — Everything stays in your browser. No servers. No tracking.
- **⚡ Instant Setup** — No account needed. Add your OpenAI API key and go.

## 🚀 Quick Start

```bash
git clone https://github.com/WarriorSushi/mindstore.git
cd mindstore
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000), add your OpenAI API key, and start importing.

## 🏗️ Architecture

- **Next.js 16** (App Router) — Static export, zero backend
- **IndexedDB** (Dexie) — All data stays in your browser
- **OpenAI Embeddings** — `text-embedding-3-small` for semantic indexing
- **Cosine Similarity** — Client-side vector search
- **GPT-4o-mini** — RAG chat with streaming responses
- **Framer Motion** — Smooth animations throughout

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx          # Landing page
│   └── app/
│       ├── page.tsx      # Dashboard
│       ├── import/       # Import ChatGPT, files, text, URLs
│       ├── chat/         # Ask your mind (RAG)
│       ├── explore/      # Browse knowledge
│       ├── learn/        # AI interview
│       ├── connect/      # MCP server setup
│       └── settings/     # API key, data management
├── components/ui/        # Reusable UI components
└── lib/
    ├── db.ts             # IndexedDB schema & helpers
    ├── openai.ts         # Embeddings & chat streaming
    ├── search.ts         # Vector search & RAG prompt
    ├── parsers.ts        # ChatGPT JSON, text, file parsers
    └── utils.ts          # Utilities
```

## 🔌 MCP Integration (Coming Soon)

MindStore will expose your knowledge as an MCP server, so any MCP-compatible AI client can access your mind:

```json
{
  "mcpServers": {
    "mindstore": {
      "url": "https://your-mindstore-instance/api/mcp"
    }
  }
}
```

**Tools exposed**: `search_mind`, `get_profile`, `get_context`

## 🛣️ Roadmap

- [x] ChatGPT export import
- [x] Semantic search with embeddings
- [x] RAG-based chat
- [x] AI interview/learning system
- [x] File & URL import
- [ ] MCP server endpoint
- [ ] Obsidian vault import
- [ ] Notion export import
- [ ] Knowledge graph visualization
- [ ] Self-hosted backend option
- [ ] Browser extension

## 📜 License

MIT

## 🙏 Credits

Built by [WarriorSushi](https://github.com/WarriorSushi) — part of [AltCorp](https://altcorp.frain.cloud).
