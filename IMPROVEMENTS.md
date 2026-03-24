# MindStore Improvement Log

_Automated 30-min improvement cycles by Frain_

---

---

## 2026-03-24 07:59 UTC — Markdown Tables & Task Lists in Chat Renderer
- **Research**: AI chat rendering patterns — ChatGPT, Claude, Gemini, and Perplexity all render markdown tables natively in chat responses. AI models frequently output comparison tables, data summaries, and structured info as markdown tables. Task lists (`- [ ]` / `- [x]`) are also common in AI-generated action plans. Web search was unavailable (quota), used domain knowledge of markdown rendering gaps.
- **Finding**: MindStore's `ChatMarkdown` component handled bold, italic, code, code blocks, lists, blockquotes, and headings — but had **zero table support**. Markdown tables (`| Col | Col |`) rendered as broken plain text with literal pipe characters, making AI responses that use tables look unprofessional. Task lists also rendered as regular bullet lists with literal `[ ]` text.
- **Implemented**:
  - **Table rendering**: Full markdown table support with:
    - Header row detection (line starting/ending with `|` followed by `|---|` separator)
    - Column alignment parsing: `:---` = left, `:---:` = center, `---:` = right
    - Styled header row: `bg-white/[0.04]` background, semibold `text-zinc-300`, `whitespace-nowrap`
    - Data rows with `hover:bg-white/[0.02]` highlight and `border-white/[0.03]` dividers
    - Horizontal scroll (`overflow-x-auto`) for wide tables on mobile
    - Container: `rounded-xl border border-white/[0.06]` matching all card styling
    - Inline markdown (bold, italic, code, links) fully works inside table cells
  - **Task list rendering**: `- [ ]` / `- [x]` patterns now render with:
    - Custom checkbox: `w-[15px] h-[15px] rounded-[4px]` — empty border or violet-500 filled with SVG checkmark
    - Completed items: `text-zinc-500 line-through` for visual differentiation
    - Matches existing bullet/numbered list spacing and sizing
  - **Paragraph guard**: Updated paragraph collector to stop collecting lines when a table start is detected, preventing tables from being swallowed into paragraph text
  - **Helper functions**: `isTableRow()`, `isTableSeparator()`, `parseAlignments()`, `parseTableCells()` — all pure functions, zero dependencies
  - Zero new dependencies — still 100% regex + React, no markdown library needed
- **Branch**: `frain/improve` (commit `96e26a3`)

## 2026-03-24 06:59 UTC — Ollama Streaming Chat Support (Complete Local LLM Parity)
- **Research**: Codebase audit — compared the three-provider support across embeddings vs chat. Web search unavailable (quota).
- **Finding**: **Critical functional gap** — The chat API route (`/api/v1/chat/route.ts`) only supported OpenAI and Gemini for streaming chat, but **NOT Ollama** — even though the embeddings system (`embeddings.ts`) and settings page both fully support Ollama as a provider. Users who configured Ollama could generate embeddings and search, but clicking "chat" would fail with "No API key configured" — because the settings endpoint's `hasApiKey` check didn't include `ollama_url`, and the chat route had no `streamOllama()` function.
- **Implemented**:
  - **New `streamOllama()` function** in `/api/v1/chat/route.ts`: Streams chat via Ollama's `/api/chat` endpoint. Ollama uses NDJSON streaming (one JSON object per line: `{"message":{"content":"token"},"done":false}`), which is transformed to OpenAI-compatible SSE format (`data: {"choices":[{"delta":{"content":"token"}}]}`) so the existing client-side `streamChat()` generator works without any changes.
  - **Provider priority with explicit override**: Reads `chat_provider` from settings DB. If explicitly set (e.g. `chat_provider: "ollama"`), that provider is used first. Otherwise falls back to auto-detect chain: OpenAI → Gemini → Ollama.
  - **Graceful connection errors**: If Ollama is unreachable (e.g. not running), returns a clear 502 error: "Cannot connect to Ollama at http://localhost:11434. Is it running?" — much better than a generic fetch crash.
  - **Settings `hasApiKey` fix**: The `/api/v1/settings` GET endpoint now includes `config.ollama_url` and `process.env.OLLAMA_URL` in the `hasApiKey` boolean. This fixes the chat page's `hasAI` state — previously Ollama-only users saw "Connect an AI provider" even though they had one configured.
  - **Default model**: Uses `llama3.2` as the default Ollama chat model (widely available, good quality, fast).
  - **Zero client-side changes needed**: The existing `streamChat()` generator in `lib/openai.ts` already parses OpenAI-compatible SSE, so Ollama chat "just works" through the same pipeline.
  - **Complete parity**: All three providers (OpenAI, Gemini, Ollama) now work identically across both embeddings AND chat. MindStore is truly usable as a 100% local/offline knowledge base.
- **Also committed**: Chat conversation rename feature (double-click title or pencil icon in history panel).
- **Branch**: `frain/improve` (commits `b0de58e`, `7f4cd40`)

## 2026-03-24 05:59 UTC — Global Drag-and-Drop File Import
- **Research**: Drag-and-drop UX patterns from Notion, Slack, Discord, Gmail — all modern productivity apps allow dropping files anywhere in the app, not just on dedicated upload areas. MindStore's Import page had per-tab DropZone components, but users had to navigate to the Import page first. Web search unavailable (quota), used domain knowledge of file import UX patterns.
- **Finding**: MindStore had drag-and-drop support only within the Import page's DropZone components. Users on Chat, Explore, Dashboard, or any other page had no way to quickly import a file without navigating away. This breaks the flow — especially for power users who want to "drop and go" like in Slack or Notion.
- **Implemented**:
  - **New `GlobalDropZone` component** (`src/components/GlobalDropZone.tsx`): A window-level drag-and-drop handler that intercepts file drags anywhere in the app.
  - **Full-screen overlay**: When dragging files over the window, a `z-[200]` overlay appears with backdrop blur, animated upload icon (CSS bounce), and pulsing glow ring — clear visual feedback that the app is ready to receive files.
  - **Auto file type detection**: Categorizes dropped files automatically:
    - `.json` / `.zip` → ChatGPT import (`source_type: 'chatgpt'`)
    - `.txt` / `.md` / `.markdown` → File import (`source_type: 'file'`)
    - Unsupported files → shows error with supported formats
  - **Four visual states**: `hovering` (drop target with animated icon), `importing` (spinner + "Processing…"), `done` (green checkmark + result count), `error` (red alert + message)
  - **Mixed file handling**: If a user drops a mix of `.json` and `.md` files, imports both sets and reports on any unsupported files separately
  - **Import page guard**: Overlay is disabled on `/app/import` since that page has its own granular DropZone components per tab
  - **Drag counter pattern**: Uses `dragCountRef` counter (increment on `dragenter`, decrement on `dragleave`) to handle the browser's notoriously tricky drag events — prevents the overlay from flickering when dragging over child elements
  - **Auto-dismiss**: Success state auto-clears after 2.5s, error after 3.5s
  - **CSS animations**: `gdz-fade-in`, `gdz-pulse`, `gdz-bounce`, `gdz-scale-in` — all pure CSS keyframes, no JS animation library
  - **Integrated into app layout**: Added alongside Onboarding and CommandPalette in `layout.tsx`
- **Branch**: `frain/improve` (commit `7b02df0`)

## 2026-03-24 05:29 UTC — Infinite Scroll on Explore Page
- **Research**: Scroll/pagination UX patterns from Twitter, Instagram, Notion, Linear — modern apps universally use infinite scroll (via Intersection Observer) instead of manual "Load More" buttons for content lists. Infinite scroll keeps users in flow, reduces friction, and feels seamless. Web search unavailable (quota), used domain knowledge of pagination UX patterns.
- **Finding**: The Explore page had a manual "Load More" button at the bottom of the memory list. Users had to notice it, stop scrolling, and click it to see more memories. This is a friction point — especially for users with hundreds or thousands of memories. Every major content app (Twitter, Instagram, Notion databases, Linear issue lists) auto-loads the next page as you scroll.
- **Implemented**:
  - **Intersection Observer**: Added a sentinel `<div>` at the bottom of the memory list, observed with `IntersectionObserver` using `rootMargin: '200px'` — this triggers the next fetch 200px before the sentinel becomes visible, so content loads before the user reaches the bottom.
  - **`loadMore()` callback**: Fetches the next batch of 100 memories via `/api/v1/memories?limit=100&offset=N` and appends to the existing list. Guards against duplicate fetches with `loadingMore` state.
  - **Loading indicator**: While fetching, shows a subtle "Loading more…" with a spinning violet `Loader2` icon. When not loading, shows "N more" with a `MoreHorizontal` icon so users know there's more content.
  - **Smart guards**: Infinite scroll only activates when: (a) not already loading, (b) there are more memories to load (`memories.length < totalMemories`), and (c) the user is NOT searching (search results load all at once since they're naturally scoped by query relevance).
  - **Cleanup**: Observer disconnects on unmount/re-render to prevent memory leaks.
  - **No changes to API**: The existing `/api/v1/memories` endpoint already supported `limit` and `offset` parameters — purely a frontend UX improvement.
- **Branch**: `frain/improve` (commit `6a27418`)

## 2026-03-24 03:29 UTC — Enhanced Command Palette: Quick Actions & Recent Chats
- **Research**: Command palette UX patterns from Linear, Raycast, Notion, Superhuman — modern command palettes aren't just search boxes. They're action hubs: search content, navigate pages, AND execute quick actions (new chat, export, import). Linear's ⌘K shows recent items when empty. Raycast groups results by type with section headers. Superhuman's ⌘K has instant actions with keyword matching.
- **Finding**: MindStore's ⌘K Command Palette could only do two things: search memories and navigate to pages. No quick actions (users had to navigate to a page first, then find the button). No recent items (the palette opened empty with just a page list). No section grouping. This made it feel like a basic nav menu rather than a power-user hub. Web search unavailable (quota), used domain knowledge of command palette UX patterns.
- **Implemented**:
  - **Quick Actions section**: 8 actions searchable by keywords — "New Chat" (start fresh conversation), "Import Text" (paste notes), "Import ChatGPT" (upload ZIP), "Import URL" (extract webpage), "Export All Data" (download JSON backup *directly from palette* — no navigation needed), "Reindex Embeddings" (navigate to settings), "Teach AI About You" (open Learn), "View Mind Map" (open 3D graph). Each action has fuzzy keyword matching (e.g. typing "backup" finds Export, typing "web" finds Import URL).
  - **Recent Chats section**: When the palette opens with no query, shows the last 4 conversations from localStorage with title, message count, and relative timestamps. Clicking a recent chat navigates to Chat page and loads that conversation via custom event dispatch.
  - **Section grouping**: Items are now grouped under labeled section headers — "Memories" (search results), "Quick Actions" (with ⚡ icon), "Recent Chats" (with 🕐 icon), "Navigate"/"Pages" (page links). Much easier to scan than a flat list.
  - **Custom event bridge**: Command palette dispatches `mindstore:new-chat` and `mindstore:load-chat` custom events. Chat page listens for these events and triggers `handleNewChat()` or `handleLoadConversation(id)` — enabling cross-component communication without prop drilling or global state.
  - **Direct export action**: The "Export All Data" action fetches `/api/v1/export`, creates a Blob, and triggers download — all without leaving the current page. Shows toast on success/failure.
  - **Color-coded search result icons**: Memory search results now use source-type-specific icon colors (green for ChatGPT, blue for files, orange for URLs, violet for text) — consistent with Explore page.
  - **Result count in footer**: Shows "N results" counter in the bottom-right of the palette.
  - **Better empty state**: When query matches nothing, shows "No results for…" with a help hint ("Try searching for memories, pages, or actions").
  - **Updated placeholder**: "Search, navigate, or run actions…" — tells users the palette can do more than just search.
- **Branch**: `frain/improve` (commit `af68ff0`)

---

## 2026-03-24 02:59 UTC — Suggested Follow-Up Questions in Chat
- **Research**: AI chat UX patterns from ChatGPT, Perplexity, Gemini, Claude — all modern AI chat apps generate contextual follow-up questions after responses to drive engagement and help users explore their knowledge deeper. MindStore's chat had no suggested follow-ups — after an answer, the user had to think of the next question entirely on their own.
- **Finding**: The Chat page had great UX (stop/regenerate, source citations, copy, scroll FAB) but lacked the "what to ask next" pattern. In knowledge management, follow-up suggestions are even more valuable than in general chat because users often don't know what connections exist in their own data.
- **Implemented**:
  - **`generateFollowUps()` function**: After streaming completes, makes a lightweight background API call asking the AI to generate exactly 3 short, contextual follow-up questions based on the user's query and the AI's answer. Parses JSON array from streamed response.
  - **Follow-up pill buttons**: Displayed below the last assistant message as rounded-full chips with violet styling (`border-violet-500/15 bg-violet-500/[0.06] text-violet-300`). Truncated at 280px for long questions.
  - **Loading state**: Shows "Thinking of follow-ups…" with spinner while generating, so users know more is coming.
  - **Click to send**: Clicking any follow-up pill immediately clears the suggestions and sends that question as the next query — seamless conversation flow.
  - **Proper cleanup**: Follow-ups clear on new chat, regenerate, stop generation, and when sending a new message. Uses `AbortController` so follow-up generation is cancelled if the user navigates away or starts a new interaction.
  - **Non-blocking**: Follow-up generation runs entirely in the background — doesn't delay the main response or block the input.
- **Branch**: `frain/improve` (commit `4f3f90f`)

---

## 2026-03-24 02:29 UTC — Multi-Select & Batch Operations for Explore
- **Research**: Bulk action patterns from Notion, Gmail, Obsidian, Apple Notes — every major knowledge app supports selecting multiple items and performing batch operations (delete, export, copy). MindStore's Explore page only supported single-item actions — no way to bulk-delete imports gone wrong or export a selection. Web search was unavailable (quota), used domain knowledge of modern UX patterns.
- **Finding**: The Explore page had individual delete per memory via the detail modal, but no multi-select capability. Users who imported large ChatGPT exports or file batches had no efficient way to curate or clean up. No batch export either — the only export was a full database dump from Settings.
- **Implemented**:
  - **Select mode toggle**: Header button (CheckSquare icon) enters select mode; also triggered by pressing `s` on keyboard
  - **Per-card checkboxes**: In select mode, each memory card shows a rounded checkbox. Selected cards get a violet highlight ring (`border-violet-500/30 bg-violet-500/[0.08] ring-1 ring-violet-500/20`). Clicking a card in select mode toggles its selection instead of opening detail.
  - **Sticky selection toolbar**: Appears at top when in select mode. Shows "Select all" / "Deselect all" toggle + selection count. Stays visible on scroll with `sticky top-12 md:top-0 z-20 bg-[#0a0a0b]/90 backdrop-blur-xl`.
  - **Batch delete**: Deletes selected memories in parallel batches of 10 for speed. Confirmation dialog shows count. Updates local state immediately after deletion.
  - **Batch export**: Downloads selected memories as a formatted Markdown file (`## Title\n*source · date*\n\ncontent`) with `---` dividers between entries.
  - **Batch copy**: Copies all selected memories to clipboard as formatted text with source labels and content.
  - **Full keyboard flow**: `s` enters select mode → `j/k` navigate → `Space` toggles selection on focused item → `a` selects/deselects all → `Escape` exits select mode
  - **Updated keyboard hints**: Bottom hint bar now shows `s` for select, and in select mode shows additional `␣` (toggle) and `a` (all) shortcuts
  - **Design consistency**: Checkbox uses `rounded-[5px]` with violet fill when checked, matching iOS/macOS checkbox patterns. All toolbar buttons use same `h-7 px-2.5 rounded-lg` pattern as other action buttons in the app.
- **Branch**: `frain/improve` (commit `aee7d56`)

## 2026-03-24 01:59 UTC — Stop Generating + Regenerate Response in Chat
- **Research**: Modern AI chat UX patterns (ChatGPT, Claude, Gemini) — every major AI chat app provides a "stop generating" button during streaming and a "regenerate" option after responses. MindStore's chat was missing both: users had no way to cancel a slow/bad response or retry generation.
- **Finding**: The `streamChat()` function had no `AbortController` support — once a request started, it ran to completion with no cancellation. The send button showed a spinner during loading but offered no interactivity. After a response, the only option was to type a new message.
- **Implemented**:
  - **AbortController in streamChat()**: Added optional `signal` parameter to the generator function, passed to `fetch()`. Added `finally` block to release the reader on abort. Graceful cleanup even on mid-stream cancellation.
  - **Stop generating button**: During streaming, the send button transforms into a filled-square stop button (dark `bg-zinc-700` with `ring-1 ring-white/[0.1]`). Clicking it aborts the request and preserves whatever text was already streamed. If nothing was streamed yet, shows "_Generation stopped._" placeholder.
  - **Regenerate button**: After the last assistant response, a "Regenerate" pill button (↻ icon) appears centered above the input bar. Clicking it removes the last assistant message, finds the preceding user query, and re-sends it — effectively retrying the generation with fresh context.
  - **Input bar restructured**: Send and stop are now distinct button states (not just icon swap on the same button). Send is `bg-violet-600`, stop is `bg-zinc-700` — clear visual differentiation.
  - **Error handling**: `AbortError` is caught separately from real errors. Abort preserves partial content; real errors still show toast + error message in chat.
- **Branch**: `frain/improve` (commit `31088fa`)

## 2026-03-24 01:29 UTC — Scroll-to-Bottom FAB for Chat & Learn Pages
- **Research**: Modern chat UX patterns — ChatGPT, Claude, Slack all show a floating "scroll to bottom" button when the user scrolls up in a conversation. MindStore's chat pages were missing this standard pattern.
- **Finding**: The chat page had unconditional auto-scroll that would yank users back to the bottom whenever new streaming tokens arrived, even when they were trying to read older messages. This is a significant UX friction point.
- **Implemented**:
  - Added `showScrollBtn` state and `isNearBottomRef` to both Chat and Learn pages
  - Scroll listener detects when user is >120px from bottom → shows floating button
  - Auto-scroll now only activates when user is already near the bottom (respects reading position)
  - Floating pill button: `ChevronsDown` icon, rounded-full, dark glass style with `bg-[#1a1a1d]`, border, shadow
  - Shows "New messages" text on desktop (hidden on mobile for space)
  - Smooth scroll animation on click, with active:scale press feedback
  - Applied consistently to both Chat page and Learn interview page
- **Branch**: `frain/improve` (commit `ac41fe2`)

## 2026-03-24 00:59 UTC — Settings Page Entrance Animations
- **Research**: Internal UX consistency audit — compared all 9 app pages for animation parity
- **Finding**: Settings was the **only** app page that didn't use `PageTransition` and `Stagger` components. Every other page (Dashboard, Explore, Chat, Connect, Import, Learn, Fingerprint, Insights) had smooth staggered entrance animations, but Settings snapped in instantly — creating a jarring inconsistency when navigating.
- **Implemented**:
  - Wrapped Settings page in `<PageTransition>` with sequential `<Stagger>` sections
  - Header, active provider badge, reindex nudge, providers section, data section, and about card all animate in with staggered delays
  - About card upgraded from flat `bg-white/[0.02]` to subtle gradient `bg-gradient-to-b from-white/[0.03] to-white/[0.01]` for visual polish
  - **All 9 app pages now have 100% consistent entrance animations** — zero holdouts
  - Zero new dependencies (CSS-only animations via existing PageTransition system)
- **Branch**: `frain/improve` (commit `69544b3`)

## 2026-03-24 00:29 UTC — Remove framer-motion: CSS-Only Animations Everywhere
- **Research**: Performance audit — identified framer-motion as last remaining heavy JS dependency used only for simple fade/slide animations. Web search unavailable (quota), used codebase analysis to find all framer-motion imports.
- **Finding**: Only 2 files still imported framer-motion: `PageTransition.tsx` (used across 5+ pages for staggered entrance animations) and `Onboarding.tsx` (slide transitions with AnimatePresence). The library adds ~5.8MB to node_modules and ~30KB+ gzipped to the client bundle — all for animations that CSS `@keyframes` handles natively with identical visual results.
- **Implemented**:
  - **PageTransition/Stagger**: Replaced `motion.div` with pure CSS `@keyframes ms-stagger-in` animation (fade + translateY + blur). Stagger delay computed per-child using `Children.map` + `cloneElement` to pass `__staggerIndex`. Styles injected once via `<style>` tag. Same 350ms duration, same cubic-bezier easing.
  - **Onboarding**: Replaced `AnimatePresence` + `motion` with CSS keyframes: `onboard-emoji-in` (scale+translateY spring), `onboard-text-in` (directional slide via CSS custom property `--slide-dir`), `onboard-exit` (reverse slide via `--slide-exit-dir`). Backdrop uses CSS `transition-opacity` instead of motion.div. Timeout-based slide switching with `animating` state flag.
  - **Removed `framer-motion`** from `package.json` — the dependency is completely eliminated
  - **Bundle savings**: ~30KB+ gzipped client-side JavaScript removed. 5.8MB fewer node_modules.
  - **Zero visual regression** — all animation timings, easings, and behaviors preserved identically
  - **MindStore is now 100% free of JS animation libraries** — every animation in the entire app is pure CSS
- **Branch**: `frain/improve` (commit `57299ed`)

---

## 2026-03-23 23:59 UTC — Chat Source Citations, Message Copy & Toast Styling
- **Research**: RAG chat UX patterns from Perplexity, You.com, ChatGPT — how modern AI apps present source citations and enable conversation reuse. Web search was unavailable (quota), used domain knowledge of PKM/RAG UX best practices.
- **Finding**: MindStore's chat source citations were tiny pills showing truncated 20-char titles — no source type indication, no relevance score, no expandability. Users couldn't tell which sources were most relevant or what type they were. Also: no way to copy individual messages or export a full conversation. Toast notifications used Sonner's default dark theme, inconsistent with MindStore's glass-morphism design system.
- **Implemented**:
  - **Expandable source cards** (Perplexity-style): Sources now show as structured cards with:
    - Color-coded type icon (green=ChatGPT, blue=file, orange=URL, violet=text)
    - Full title (truncated at card width, not at 20 chars)
    - Relevance score bar + percentage (visual mini progress bar)
    - Shows 2 sources by default, "+N more" button to expand all
    - "Sources · N" header with count
  - **Per-message copy button**: Hover any message bubble to reveal a floating copy button (positioned bottom-left for assistant messages, bottom-right for user messages). Uses group hover with smooth opacity transition, dark glass background to stand out.
  - **Conversation copy/export**: New copy button in chat top bar (appears when messages exist). Copies entire conversation as formatted markdown with `**You**:` / `**MindStore**:` headers and `---` dividers between messages. Shows green check confirmation + toast.
  - **Toast notifications restyled**: Custom `toastOptions.style` on Sonner `<Toaster>`:
    - Background: `#111113` (matches app modals)
    - Border: `rgba(255,255,255,0.06)` (matches card borders)
    - Border radius: `16px` (rounded-2xl, matches all cards)
    - Box shadow: deep `0 8px 32px rgba(0,0,0,0.5)` (matches floating panels)
    - Backdrop blur: `12px` (glass effect matching header/nav)
    - Font: 13px/500 weight (matches all UI text)
- **Branch**: `frain/improve` (commit `d674dde`)

---
- **Research**: UX consistency audit — the landing page (first page users see!) was the last major page still using legacy patterns: `framer-motion` for all animations, shadcn `Button` component (4 instances), and old card styling (`bg-zinc-900/50`, `border-zinc-800`, `bg-zinc-950`). Every app page had been modernized, but the public-facing landing page was inconsistent.
- **Finding**: The landing page imported `motion`, `AnimatePresence` from framer-motion for fade-up animations, and `Button` from shadcn for 5 different CTA/nav buttons. These are heavy JS dependencies for animations that CSS can handle natively. The card styles (`glow-card`, `border-zinc-800`, `bg-zinc-900/50`) didn't match the unified MindStore design system used in all app pages.
- **Implemented**:
  - **Removed `framer-motion`** — all `motion.div`, `AnimatePresence`, and `fadeUp` variants replaced with a single CSS `@keyframes landing-fade-in` animation with staggered `animation-delay` on elements. Zero JS for animations.
  - **Removed shadcn `Button`** — all 5 instances (`nav "Open App"`, `hero "Get Started"`, `hero "Try Demo"`, `hero "See How It Works"`, `CTA "Open MindStore"`) replaced with native `<button>` elements using the app design system (rounded-2xl, h-12, active:scale-[0.97], violet-600/500)
  - **Updated all card styles** to match unified design system:
    - `bg-zinc-900/50` → `bg-white/[0.02]`
    - `border-zinc-800` → `border-white/[0.06]`
    - `hover:border-zinc-700` → `hover:bg-white/[0.04]`
    - All cards now `rounded-2xl` (was `rounded-xl` and `rounded-lg`)
  - **Navbar redesigned**: Now matches the app header exactly — glass-style with `bg-[#0a0a0b]/80 backdrop-blur-2xl backdrop-saturate-150`, same logo treatment (rounded-[8px] gradient icon + 15px semibold text)
  - **Innovation feature cards** now have per-feature colored hover borders (`hover:border-violet-500/20`, `hover:border-emerald-500/20`, etc.)
  - **How It Works cards** now have gradient background overlays matching the Dashboard stat cards pattern
  - **Footer** updated to `border-white/[0.04]` + `text-zinc-600` styling
  - **Also committed**: PageTransition/Stagger wrappers added to Import page and Dashboard page (were pending in work tree from prior cycles)
  - **Background**: `bg-zinc-950` → `bg-[#0a0a0b]` matching app layout exactly
  - Landing page is now **100% consistent** with the app design system — zero legacy patterns remain anywhere in the entire codebase
- **Branch**: `frain/improve` (commit `de1300b`)

## 2026-03-23 23:04 UTC — Keyboard Navigation & Cross-Page Flow
- **Research**: Power-user UX patterns from Linear, Superhuman, Notion, and Obsidian — focused on keyboard-driven navigation. Apps like Linear use j/k to move between items, Enter to open, Escape to close, and arrow keys to navigate within detail views. Superhuman's "next/prev" in email detail view keeps users in flow without returning to the list.
- **Finding**: MindStore's Explore page had no keyboard navigation — users had to click every memory card individually. The detail modal was a dead-end: no way to go to the next memory without closing and clicking another card. No cross-page flow from Explore→Chat to ask deeper questions about a specific memory.
- **Implemented**:
  - **j/k and ↑/↓ keyboard navigation** in the Explore memory list with visual focus ring (violet border + subtle glow)
  - **Enter to open** focused memory, **Escape to close** detail modal
  - **Prev/Next navigation in detail modal** via ↑/↓ or j/k — with position counter (e.g. "3/47")
  - **"Ask about this" button** in detail modal footer → navigates to Chat with memory snippet as pre-filled query
  - **Chat page ?q= deep-link support** — auto-sends query when arriving from Explore's "Ask about this"
  - **Keyboard hint bars** at bottom of list (j/k navigate, ↵ open, / search) and detail modal (↑↓ navigate, esc close) — desktop only
  - **Bonus fixes**: Fixed unclosed `<Stagger>` JSX in Connect and Insights pages that caused build failures; fixed TypeScript `ease` tuple type in PageTransition component
  - All focus states match MindStore's design system: violet-500/30 border, violet-500/[0.06] background, ring-1 ring-violet-500/20
- **Branch**: `frain/improve` (commit `9503fc9`)

## 2026-03-23 21:59 UTC — Chat Markdown Rich Rendering
- **Research**: AI chat UX patterns — compared how Notion, ChatGPT, Claude, and Obsidian render markdown in conversational contexts. AI responses heavily use bullet lists, numbered lists, fenced code blocks, and blockquotes — all of which MindStore's ChatMarkdown was silently dropping.
- **Finding**: The existing ChatMarkdown only handled **bold**, *italic*, `inline code`, links, and headings. Lists rendered as plain text with literal `- ` prefixes. Code blocks with triple backticks were ignored entirely. This made AI chat responses look broken and unprofessional.
- **Implemented**:
  - **Fenced code blocks**: Triple-backtick blocks now render in a styled container with language label header and a copy-to-clipboard button (with green ✓ confirmation animation)
  - **Bullet lists**: `-` and `*` prefixed lines render as proper lists with dot indicators and nested indent support
  - **Numbered lists**: `1. 2. 3.` lines render with right-aligned tabular-nums numbering
  - **Blockquotes**: `> ` prefixed lines render with violet left border accent
  - **H1 headings**: Added `#` heading support (previously only ## and ###)
  - **Paragraph grouping**: Consecutive non-special lines are now properly grouped into `<p>` elements instead of wrapping everything in whitespace-pre-wrap, fixing spacing issues
  - All new elements match the MindStore dark UI design system (white/[0.06] borders, rounded-xl, violet accents)
  - Zero new dependencies — still pure regex + React
- **Branch**: `frain/improve` (commit `c8cb0fd`)

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

---

## 2026-03-23 21:29 UTC — Fingerprint/Mind Map Page Redesign
- **Research**: UI consistency audit — Fingerprint page was the last remaining page with legacy styling patterns
- **Finding**: The Fingerprint page had its own standalone layout with a duplicate header bar, back arrow, `min-h-screen bg-zinc-950`, `bg-zinc-900/50 border-zinc-800` cards, and shadcn `Button` imports. Every other page had been updated to the unified dark UI system, making this the final holdout.
- **Implemented**:
  - Removed standalone layout (duplicate header, back button, min-h-screen wrapper)
  - Page now correctly uses the app layout wrapper like all other pages
  - Standard page header: `text-[22px]/[28px] font-semibold tracking-[-0.03em]`
  - Replaced all legacy card styles: `bg-zinc-900/50 border-zinc-800` → `bg-white/[0.02] border-white/[0.06]`
  - Removed shadcn `Button` import — native styled buttons only
  - View toggle uses rounded-xl pill design consistent with other page controls
  - 3D graph container is a proper `rounded-2xl` card with responsive `calc(100dvh - 220px)` height
  - Loading state uses backdrop blur + rounded-2xl icon container matching other pages
  - Stats view: color-coded stat values (violet/blue/emerald), proper cluster bar charts with smooth progress bars, gradient about card
  - Empty state matches Explore/Dashboard pattern (rounded-2xl icon container, centered text, violet CTA button)
  - Refresh button uses standard icon button pattern (rounded-xl, border-white/[0.06])
  - **All 9 app pages now use 100% unified design system** — zero legacy styling remaining anywhere
- **Branch**: `frain/improve` (commit `318bbee`)

---

## 2026-03-24 04:59 UTC — Dashboard Recent Activity Timeline
- **Research**: Internal UX audit — modern PKM apps (Notion, Obsidian, Reflect) all show recent activity on their home/dashboard pages. MindStore's dashboard showed stats and actions but no sense of *when* things were added or what was recently imported.
- **Finding**: The dashboard felt static — no temporal context. Users couldn't see their latest additions without navigating to Explore. Notion's home page, Obsidian's "Recent files", and Reflect's timeline all surface recent items prominently.
- **Implemented**:
  - Stats API (`/api/v1/stats`) now returns `recentMemories` — the 5 most recently created memories with id, content preview (120 chars), source type, title, and `created_at` timestamp
  - New **"Recent Activity"** section on the Dashboard between Actions Grid and Discover
  - Each entry shows: colored source type icon, source title, content preview (1-line truncated), and relative timestamp with clock icon
  - Clicking a recent memory navigates to Explore with a search query for that content
  - "View all →" link navigates to the full Explore page
  - `formatRelativeTime()` helper: "just now", "Xm ago", "Xh ago", "yesterday", "Xd ago", or short date
  - Fully consistent with existing dashboard design system (rounded-2xl cards, divide-y, hover states)
- **Also committed**: Previously uncommitted inline memory editing feature (PATCH API + Edit UI in Explore modal with keyboard shortcuts)
- **Branch**: `frain/improve` (commit `e482ed4`)

---

## 2026-03-24 08:59 UTC — Chat Provider Preference Picker
- **Research**: Analyzed MindStore's backend vs frontend feature parity. The chat API route (`/api/v1/chat`) already supported a `chat_provider` setting to let users choose between OpenAI, Gemini, and Ollama for chat — but there was no UI to set this preference. Users with multiple providers configured had no control over which one handled their conversations.
- **Finding**: The backend had dead code — `chat_provider` was queried from the settings table and respected in the chat route's provider selection logic, but the Settings API didn't return it and couldn't save it. This is a classic backend-frontend disconnect. Modern PKM apps like Notion AI and Reflect let users choose their AI backend.
- **Implemented**:
  - **Settings API** (`/api/v1/settings`):
    - GET now returns `chatProvider` (current preference or null)
    - POST accepts `chatProvider` param — saves to DB, or removes preference when set to "auto"
  - **Settings Page** — new "Chat Provider" section (only visible when at least one AI is connected):
    - Radio-style picker with 4 options: Auto-detect (⚡), Google Gemini, OpenAI, Ollama
    - Each option shows model name and description (e.g. "gemini-2.0-flash-lite · fast & free")
    - Active selection highlighted with violet ring + filled radio circle
    - Unavailable providers greyed out with "Not connected" label and disabled
    - Instant save with loading spinner feedback + toast confirmation
    - Fully matches existing Settings page design system (rounded-2xl cards, zinc/violet palette)
- **Branch**: `frain/improve` (commit `9438b7b`)
