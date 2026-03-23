# MindStore Improvement Log

_Automated 30-min improvement cycles by Frain_

---

## 2026-03-23 17:59 UTC — Chat Conversation History
- **Research**: Chat UX patterns in knowledge management apps (ChatGPT, Notion AI, Mem, Reflect)
- **Finding**: Every modern chat-based knowledge app persists conversations. MindStore was losing all chat history on navigation or refresh — a major UX pain point. Users expect to pick up where they left off.
- **Implemented**:
  - New `src/lib/chat-history.ts` utility module with full CRUD for conversations
  - localStorage persistence — conversations auto-saved on each message with 300ms debounce
  - Auto-generated titles from first user message (truncated at 40 chars)
  - Top bar with "New chat" button and "History" toggle
  - Slide-over history panel from right side with:
    - All past conversations with relative timestamps ("2m ago", "yesterday")
    - Message count per conversation
    - Active conversation highlighting
    - Delete individual conversations (hover to reveal trash icon)
    - "Clear all" button for bulk deletion
  - Empty state shows 3 most recent conversations for quick access
  - Supports up to 50 conversations (oldest auto-pruned)
  - Fully matches MindStore dark UI (violet accents, rounded cards, backdrop blur)
- **Branch**: `frain/improve` (commit `db5c086`)

---

## 2026-03-23 17:29 UTC — ⌘K Command Palette
- **Research**: Modern knowledge management UX patterns (Notion, Linear, Raycast, Obsidian)
- **Finding**: Command palette (⌘K) is the #1 power-user UX pattern across all modern knowledge apps — instant access to search + navigation from anywhere
- **Implemented**:
  - New `CommandPalette` component (`src/components/CommandPalette.tsx`)
  - Cmd+K / Ctrl+K keyboard shortcut opens full-app overlay
  - Searches memories via `/api/v1/search` with 200ms debounce
  - Navigate to any page by typing its name (fuzzy filter on 9 pages)
  - Full keyboard navigation: ↑↓ arrows, Enter to select, Esc to close
  - Search icon added to mobile header for touch access
  - ⌘K hint button in desktop sidebar footer
  - Matches MindStore dark UI (violet accents, rounded cards, backdrop blur)
- **Branch**: `frain/improve` (commit `ffb66a6`)

## 2026-03-23 — Log Created
- Set up autonomous improvement cron (every 30 min)
- Research → Analyze → Implement → Report cycle
- All work on `frain/improve` branch, never main
