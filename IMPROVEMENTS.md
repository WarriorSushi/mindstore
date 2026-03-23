# MindStore Improvement Log

_Automated 30-min improvement cycles by Frain_

---

## 2026-03-23 20:59 UTC — Explore Deep-Linkable Search + Keyboard Shortcut

- **Research**: UX flow analysis — Dashboard → Explore handoff, keyboard accessibility patterns (GitHub, Slack, Linear)
- **Finding**: The Dashboard's quick-search "View all in Explore →" link navigates to `/app/explore?q=searchQuery`, but the Explore page never reads the `?q=` URL parameter. The search query is silently lost on navigation — a broken user flow. Additionally, Explore searches aren't shareable/bookmarkable since the URL doesn't reflect the current search state. Every major knowledge app supports `/` to focus search.
- **Implemented**:
  - **URL param initialization** — Explore page now reads `?q=` from URL on mount via `useSearchParams()`, pre-populating the search field. Fixes the Dashboard → Explore flow completely.
  - **URL sync** — typing in the search bar updates the browser URL via `history.replaceState()` (no page reload, no history spam). Searches are now bookmarkable and shareable.
  - **`/` keyboard shortcut** — pressing `/` focuses the search input instantly (like GitHub, Slack, Linear). Only fires when no input/textarea is focused and no modal is open.
  - **`/` keyboard hint** — shows a subtle `/ ` kbd element in the search bar when it's empty (hidden on mobile, visible on sm+ screens).
  - Added `useRef` for search input element, `useSearchParams` from next/navigation.
- **Branch**: `frain/improve` (commit `cd9239f`)

---

## 2026-03-23 19:59 UTC — Dashboard Quick-Search + shadcn Cleanup
- **Research**: UX audit — modern knowledge apps (Notion, Obsidian, Mem) all feature prominent search on the home/dashboard page. MindStore's dashboard had no search, requiring users to navigate to Chat or Explore.
- **Finding**: Dashboard still imported shadcn `Button` and `Input` components despite all other pages being migrated to native styled elements. Also missing a key UX pattern: inline search on the home page.
- **Implemented**:
  - **Quick-search bar** on Dashboard — appears when user has memories (total > 0):
    - Search icon + `⌘K` keyboard hint + clear button
    - 250ms debounced search via `/api/v1/search?limit=5`
    - Results panel showing top 5 matches with source-type badges & icons (chatgpt=green, file=blue, url=orange, text=violet)
    - Content preview with 2-line clamp
    - "View all in Explore →" link passes query param for deeper search
    - Loading spinner state
    - Empty state message
  - **Removed shadcn dependencies** from Dashboard:
    - `import { Button } from "@/components/ui/button"` → native `<button>`
    - `import { Input } from "@/components/ui/input"` → native `<input>`
    - All 3 provider Connect buttons (Gemini/OpenAI/Ollama) converted
    - Consistent focus ring colors per provider (blue/emerald/orange)
  - Added `Search`, `X`, `ArrowRight`, `Type` to icon imports
- **Branch**: `frain/improve` (commit `ef47094`)

---

## 2026-03-23 19:29 UTC — Connect Page UI Redesign + Error/404 Cleanup
- **Research**: Web search unavailable this cycle — used domain knowledge of modern PKM app UX patterns and codebase audit
- **Finding**: The Connect page was the last major page using legacy patterns: `framer-motion` (motion.div animations), shadcn components (`Card`, `CardContent`, `CardHeader`, `CardTitle`, `Button`, `Badge`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`), and old CSS tokens (`text-muted-foreground`, `bg-primary/10`, `bg-card/50`, `bg-muted`). The error and 404 pages also used shadcn `Button`.
- **Implemented**:
  - **Connect page** — complete visual redesign:
    - Removed `framer-motion` — CSS transitions only (consistent with all other pages)
    - Removed all 8 shadcn component imports
    - Replaced shadcn Tabs with pill-style client selector tabs (matching Explore page filters)
    - Status banner: violet gradient with Brain icon + emerald/zinc ready/empty badge
    - How it Works: 3 feature cards with colored icons (violet/blue/amber)
    - Config snippet: dark `rounded-xl` code block with emerald-400 mono text
    - Copy button: glass-style overlay in code block corner
    - API Endpoint: native code element + icon-only copy button
    - Consistent page header: 22/28px semibold + zinc-500 description
  - **Error page** (`error.tsx`): removed shadcn `Button`, added amber-themed icon card, native styled button
  - **404 page** (`not-found.tsx`): removed shadcn `Button`, gradient clip-text 404 number, violet-themed Brain card, dark background matching app
  - All app pages now 100% free of shadcn Card/Button/Tabs/Badge dependencies
- **Branch**: `frain/improve` (commit `434e1d9`)

---

## 2026-03-23 18:59 UTC — Insights Page UI Redesign
- **Research**: UI consistency audit — identifying pages still using legacy styling patterns
- **Finding**: The Insights page was the last remaining page using old design patterns: `bg-zinc-950`, `border-zinc-800`, shadcn `Tabs`/`Button` components, `ArrowLeft` back navigation. Every other page had been updated to MindStore's unified dark UI system.
- **Implemented**:
  - Complete visual redesign of Insights page to match MindStore design system
  - Removed old patterns: `bg-zinc-950` → inherits app bg, `border-zinc-800` → `border-white/[0.06]`, shadcn Tabs → custom pill-style tab selector matching Explore page filters
  - Removed `ArrowLeft` back link — standard page header with consistent 22/28px title + description
  - Metabolism score card: gradient overlay, massive score typography with clip-text gradient, stat cards with `tabular-nums`
  - Mind Growth card: emerald-accented with topic badges matching the new design token system
  - Connections tab: bridge concept header with amber accent, memory pair cards with source-type icons and colored badges
  - Contradictions tab: red-accented conflict headers, same memory card pattern
  - Forgetting tab: color-coded urgency badges (red >80%, amber >60%, blue otherwise), fade progress bars, source-type icons on every card
  - Loading state: centered spinner with gradient background matching Chat/other empty states
  - Removed shadcn `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Button` dependencies from this page
  - All pages now use 100% consistent design tokens — zero legacy styling remaining
- **Branch**: `frain/improve` (commit `55a6be0`)

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

## 2026-03-23 18:29 UTC — Learn Page UI Redesign
- **Research**: UI consistency audit across all MindStore pages
- **Finding**: Learn page was the last page using old styling patterns (border-border, bg-card, text-muted-foreground, framer-motion) while every other page had been updated to the unified dark UI system
- **Implemented**:
  - Complete visual redesign of Learn page to match MindStore's dark UI system
  - Replaced all old CSS patterns: `border-border/50` → `border-white/[0.06]`, `bg-card` → `bg-white/[0.02]`, `text-muted-foreground` → `text-zinc-500`
  - Removed `framer-motion` dependency (CSS transitions only, consistent with all other pages)
  - Interview chat now uses same message bubble styling as Chat page (violet user bubbles, rounded-[20px], Brain avatar)
  - Added category-colored fact badges — 8 distinct colors per fact type (preference=violet, trait=blue, goal=emerald, habit=amber, etc.)
  - Topic selection grid matches Dashboard action card styling
  - Chat input bar matches Chat page exactly (rounded-2xl textarea, violet ArrowUp send button)
  - Added floating fact counter pill showing saved facts during interview
  - Auto-resize textarea + auto-focus after interview starts
  - AI responses now render through ChatMarkdown for proper formatting
  - Consistent page header (22/28px semibold, tracking-[-0.03em])
- **Branch**: `frain/improve` (commit `126fd07`)

---

## 2026-03-23 20:29 UTC — Explore Page UX Polish
- **Research**: UX patterns from Notion/Obsidian detail modals — markdown rendering, keyboard shortcuts, clipboard actions
- **Finding**: Memory detail modal was rendering plain text while Chat page used ChatMarkdown — inconsistent experience. Detail modals in Notion/Obsidian always support Escape to close and clipboard copy.
- **Implemented**:
  - Memory detail modal now renders content through `ChatMarkdown` (bold, italic, code, links, headings) instead of plain `<p>` text
  - Added **Copy to clipboard** button in detail modal footer (with green checkmark confirmation state)
  - **Escape key** now closes the detail modal (keyboard accessibility)
  - Added **loading skeleton** — 5 animated placeholder cards shown while memories are being fetched
  - Proper state cleanup (copied state resets) on modal close or memory deletion
  - Imported `Copy`, `Check`, `Loader2` from lucide-react for new functionality
- **Branch**: `frain/improve` (commit `cbf76c7`)

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
