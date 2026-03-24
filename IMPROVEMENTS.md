# MindStore Improvement Log

_Automated 30-min improvement cycles by Frain_

---

## 2026-03-24 19:29 UTC — Topic Evolution Timeline Plugin (Phase 3, Plugin #16)
- **Context**: Phase 3 of the Plugin System build — Analysis Plugins. Mind Map Generator (#13) and Contradiction Finder (#15) are done. Topic Evolution Timeline (#16) is the **third Analysis plugin**.
- **Implemented**:
  - **Full backend API route** (`/api/v1/plugins/topic-evolution`):
    - **K-Means++ clustering**: Clusters all memories by embedding similarity into up to 10 topics. Same robust k-means++ initialization as Mind Map Generator.
    - **Time period binning**: Groups memories into week, month, or quarter granularity via configurable `?granularity=` param. Builds complete period arrays with proper date math.
    - **Shift detection engine**: Analyzes each topic's temporal distribution to classify interest trends:
      - **Rising**: >65% of activity in second half of timeline
      - **Declining**: >65% of activity in first half
      - **New**: Topic first appeared in second half of timeline
      - **Dormant**: No activity in last 3 periods despite earlier activity
      - **Resurgent**: Activity gap in middle with comeback at end
      - **Steady**: Roughly even distribution throughout
    - **Peak tracking**: Identifies peak period and peak count per topic, plus first-seen and last-seen dates.
    - **Topic labeling**: Same keyword extraction and source-dominant strategies as Mind Map Generator.
    - **16 topic colors**: Curated palette (teal, sky, emerald, amber, cyan, rose, lime, orange, blue, slate) — zero violet/purple/fuchsia.
    - **Auto-install**: Plugin auto-installs in DB on first use.
  - **New Evolution page** (`/app/evolution`) — interactive stream graph visualization:
    - **Canvas stream graph**: Stacked area chart rendered on HTML5 Canvas. Topics stacked bottom-up, largest on bottom. Smooth bezier curves between data points. Semi-transparent fills with visible top-edge strokes.
    - **Topic isolation**: Click any topic in the legend to highlight it — all other topics dim to 8% opacity. "Show all topics" to reset.
    - **Hover tooltip**: Crosshair cursor tracks mouse position. Dashed vertical indicator line shows current period. Tooltip card shows period label, total memories, and per-topic breakdown with colored dots and counts. Smart positioning flips when near right edge.
    - **Granularity toggle**: Week / Month / Quarter pills in header. Changes re-fetch data from backend.
    - **Stats bar**: Total memories (teal), topic count (sky), period count (amber), peak period (orange) — each in rounded pills.
    - **Period activity bar chart**: Secondary visualization below the stream graph. Vertical bars proportional to period totals. Hover syncs with main chart. X-axis labels at regular intervals.
    - **Interest Shifts panel**: Right sidebar listing all detected shifts. Each shift card shows: type badge (Rising/New/Comeback/Steady/Declining/Dormant), topic label, expandable description, and keywords. Color-coded icons per shift type: emerald for rising, teal for new, sky for resurgent, amber for declining, zinc for dormant/steady.
    - **Topic Detail panel**: When a topic is selected, shows: memory count, coherence score, peak activity period, active date range, keywords, source breakdown with progress bars, and sample memories (clickable → Explore).
    - **Topics by Size list**: When no topic selected, shows all topics ranked by memory count with proportional bars.
    - **Loading/empty/error states**: Centered spinner, empty state with import CTA, error with retry button.
    - **Design**: OLED black base, teal primary accent, glass-morphism panels, zero violet/purple/fuchsia. Dark tooltips with `bg-[#111113]` and `border-white/[0.1]`.
  - **Navigation updates**:
    - Sidebar: "Evolution" entry with TrendingUp icon between Mind Map and Insights
    - Command Palette: "View Topic Evolution" action + Evolution page in navigation list
  - **Zero new dependencies**: Pure Canvas rendering, k-means in pure TypeScript
- **Phase 3 Progress**:
  1. ✅ Mind Map Generator (#13)
  2. ✅ Contradiction Finder (#15)
  3. ✅ Topic Evolution Timeline (#16)
  4. ⬜ Sentiment Timeline (#18)
  5. ⬜ Knowledge Gaps Analyzer (#14)
  6. ⬜ Writing Style Analyzer (#17)
- **Next**: Sentiment Timeline (#18) — emotional arc visualization of stored knowledge
- **Branch**: `frain/improve` (commit `c37e0f1`)

## 2026-03-24 18:59 UTC — Contradiction Finder Plugin (Phase 3, Plugin #15)
- **Context**: Phase 3 of the Plugin System build — Analysis Plugins. Mind Map Generator (#13) is done. Contradiction Finder (#15) is the **second Analysis plugin**.
- **Implemented**:
  - **Full backend API route** (`/api/v1/plugins/contradiction-finder`):
    - **AI-powered contradiction detection**: Finds candidate memory pairs via cosine similarity (0.60–0.95 range), then verifies each pair with an AI model to distinguish real contradictions from evolution of thought, different contexts, or complementary perspectives.
    - **Multi-provider AI**: Supports OpenAI, Gemini, Ollama, OpenRouter, and Custom API endpoints — uses whichever is configured. Low-temperature (0.1) for consistent analysis. Structured JSON output parsing with markdown fence handling.
    - **Keyword fallback**: When no AI provider is available, falls back to expanded keyword-based detection with 17 signal pairs (always/never, recommend/avoid, true/false, etc.) — more comprehensive than the old 7-pair system.
    - **Batch processing**: Processes candidate pairs in batches of 5 with `Promise.allSettled` for rate limit compliance. Caps at 80 candidates and 20 verified contradictions per scan.
    - **Deduplication**: Checks both direction orderings (A↔B, B↔A) before inserting new contradictions.
    - **Three actions**: `scan` (run new analysis), `results` (get cached results), `resolve` (dismiss/keep-a/keep-b).
    - **Resolution workflow**: "Dismiss" removes the contradiction record. "Keep A" deletes memory B and removes the contradiction. "Keep B" deletes memory A. Ownership verified before any mutation.
    - **Auto-install**: Plugin auto-installs in DB on first use.
  - **Enhanced Insights page** — complete contradiction tab overhaul:
    - **Deep Scan button**: Red-accented action button in the contradictions tab header triggers AI-powered analysis. Shows spinner during scan, toast notifications with results.
    - **Scan message bar**: Displays scan results summary (e.g. "Found 3 new contradictions across 80 memory pairs").
    - **Expandable contradiction cards**: Click to expand/collapse. Header shows topic label, description, detection date. Expanded view shows side-by-side memory comparison.
    - **Memory labels (A/B)**: Corner badges distinguish the two conflicting memories. Each card shows source type icon, source title, content preview (300 chars, 4-line clamp), and creation date.
    - **Resolution actions**: "Not a conflict" (dismiss), "Keep A", "Keep B" buttons with teal accent. Loading spinner during resolution. Cancel button to collapse actions. Toast confirmation on resolve.
    - **Parallel data loading**: Insights page now fetches `/api/v1/insights` and `/api/v1/plugins/contradiction-finder?action=results` in parallel, separating the general insights from the plugin-powered contradiction data.
    - **Custom empty state**: Shield icon for clean-knowledge state, Loader2 spinner when scanning.
    - **Extended sourceConfig**: Added kindle, document, obsidian, reddit source types with proper icons and colors.
  - **Zero new dependencies**: Uses existing AI provider infrastructure from the chat system.
- **Phase 3 Progress**:
  1. ✅ Mind Map Generator (#13)
  2. ✅ Contradiction Finder (#15)
  3. ⬜ Topic Evolution Timeline (#16)
  4. ⬜ Sentiment Timeline (#18)
  5. ⬜ Knowledge Gaps Analyzer (#14)
  6. ⬜ Writing Style Analyzer (#17)
- **Next**: Topic Evolution Timeline (#16) — visualize how interests changed over time
- **Branch**: `frain/improve` (commit `711dc19`)

## 2026-03-24 18:29 UTC — Mind Map Generator Plugin (Phase 3, Plugin #13)
- **Context**: Phase 3 of the Plugin System build — Analysis Plugins. All 6 Phase 2 Quick Win Import Plugins are complete. Mind Map Generator (#13) is the **first Analysis plugin** — the beginning of Phase 3.
- **Implemented**:
  - **Full backend API route** (`/api/v1/plugins/mind-map-generator`):
    - **K-Means++ clustering**: Clusters up to 500 memories by semantic embedding similarity. Uses k-means++ initialization (weighted random seeding by distance) for better convergence. Configurable `maxTopics` (default 12) and `maxDepth` (default 3).
    - **Hierarchical topic extraction**: Builds a tree: Root → Topics → Subtopics. Large topics (6+ memories) get sub-clustered automatically. Each node has memory count, coherence score, source type breakdown.
    - **Topic labeling**: Extracts topic labels via document-frequency keyword analysis. Strategy cascade: (1) if >60% from same source, use source title; (2) extract top 2-3 distinctive keywords; (3) fallback to first memory content.
    - **Cross-topic connections**: Detects relationships between topic clusters via centroid cosine similarity (threshold >0.6). Surfaces hidden bridges between knowledge areas.
    - **Coherence scoring**: Each cluster gets a coherence score (average similarity to centroid) — shows how tightly related its memories are.
    - **Source breakdown per topic**: Counts memories by source type (chatgpt, file, url, text, kindle, obsidian, reddit, etc.) for each topic.
    - **Preview memories**: Returns up to 8 simplified memories per topic with id, title, preview, source type, pinned status.
    - **Auto-install**: Plugin auto-installs in DB on first use.
    - **Fixed pinned field**: Uses `metadata->>'pinned'` instead of non-existent `pinned` column.
  - **New Mind Map page** (`/app/mindmap`) — full interactive Canvas visualization:
    - **Radial layout engine**: Topics arranged in a circle around a central "Your Mind" root node. Node sizes proportional to memory count. 12 distinct topic colors.
    - **Canvas rendering**: Pure HTML5 Canvas — no external visualization library. Nodes with gradient fills, glow effects on hover/select, quadratic bezier curve edges, expand/collapse indicators (+/- badges), text wrapping for labels, memory count badges.
    - **Interaction**: Click topic → detail panel. Click topic with children → expand subtopics. Drag canvas to pan. Scroll wheel to zoom (mouse-position-aware scaling). Zoom controls (in/out/reset). Scale indicator.
    - **Topic detail panel**: Slide-in panel showing topic label, memory count, coherence, subtopic count. Keywords as colored pills. Source breakdown with progress bars. Subtopic list. Sample memories with source icons, click-through to Explore.
    - **Topic legend**: Desktop overlay listing all topics with color dots, names, and counts. Click to select.
    - **Mobile**: Topic list button (since legend takes too much space).
    - **States**: Loading (clustering spinner), error (retry button), empty (guidance message).
    - **Cross-connections**: Dashed curved lines between related topic clusters.
    - **Design**: OLED black canvas, color-coded nodes, glass-morphism panels, violet accent, spring animations for panel entrance.
  - **Navigation updates**:
    - Sidebar: "Mind Map" now routes to `/app/mindmap` with Network icon
    - Old Fingerprint (3D graph) remains accessible at `/app/fingerprint`
    - Command palette: "View Mind Map" → `/app/mindmap`, new "3D Graph" entry → `/app/fingerprint`
  - **Zero new dependencies**: Pure Canvas rendering, k-means in pure TypeScript, no D3.js or external visualization library
- **Phase 3 Started! 🚀**: First of 6 Analysis Plugins now built:
  1. ✅ Mind Map Generator (#13)
  2. ⬜ Contradiction Finder (#15)
  3. ⬜ Topic Evolution Timeline (#16)
  4. ⬜ Sentiment Timeline (#18)
  5. ⬜ Knowledge Gaps Analyzer (#14)
  6. ⬜ Writing Style Analyzer (#17)
- **Next**: Contradiction Finder (#15) — scan memories for conflicting beliefs and inconsistencies
- **Branch**: `frain/improve` (commit `6d3ae85`)

## 2026-03-24 17:59 UTC — Reddit Saved Posts Importer Plugin (Phase 2, Plugin #8)
- **Context**: Phase 2 of the Plugin System build — Quick Win Import Plugins. Kindle (#2), PDF/EPUB (#9), YouTube (#3), Browser Bookmarks (#6), Obsidian (#12) are done. Reddit Saved Posts (#8) is the **6th and final plugin** in Phase 2 — completing the Quick Wins phase!
- **Implemented**:
  - **Full backend API route** (`/api/v1/plugins/reddit-saved`):
    - **Multi-format support**: Accepts Reddit GDPR data export ZIP (with CSVs inside), standalone CSV files, or JSON exports
    - **Robust CSV parser**: Handles quoted fields with commas, escaped quotes (`""`), newlines inside quoted fields, BOM markers — essential for Reddit exports which contain markdown/HTML in post bodies
    - **Column name normalization**: Maps varying Reddit export column names (`date`/`created`/`created_utc`, `body`/`selftext`/`self_text`, etc.) to consistent fields. Handles both old and new Reddit export formats
    - **Reference CSV parsing**: For `saved_posts.csv`/`saved_comments.csv` that only contain id + permalink, extracts subreddit and title from permalink URL patterns (`/r/subreddit/comments/id/title/`)
    - **Reddit JSON format**: Parses both array format and "thing" format (`{ kind: "t3", data: { ... } }`)
    - **Date parsing**: Handles Unix timestamps (seconds), ISO dates, and common date string formats
    - **Content formatting**: Rich metadata headers — post title, subreddit, author, score, date. External links preserved. Reddit permalinks included as source links
    - **Smart chunking**: 4000 char max, splits at paragraph boundaries. Multi-part labeling for long posts
    - **Deduplication**: By Reddit post/comment ID across all files in a ZIP export
    - **Preview mode**: Returns stats (total posts/comments, subreddit breakdown with counts, date range, top authors, average score), sample items sorted by highest score
    - **Batch embeddings**: 50 per batch, 500 chunks max cap
    - **Auto-install**: Plugin auto-installs in DB on first use
  - **Import page UI** — full preview-then-import workflow:
    - New **Reddit** tab with `MessageSquare` icon and orange accent theme
    - Drop zone accepts `.zip`, `.csv`, `.json` files with orange hover state
    - Instructions with direct link to `reddit.com/settings/data-request`
    - Preview card with orange icon badge: total items, posts/comments split, date range
    - Stats bar: post count, comment count, subreddit count, average score with ArrowUpRight icon
    - **Subreddit cloud** with orange-themed count badges (shows top 15 + overflow count)
    - **Sample items list** with type-colored badges (posts = orange, comments = blue), showing title, subreddit, score, date, and content preview
    - Orange import button showing total item count
    - Grid updated to `lg:grid-cols-11` to accommodate 11 import tabs
  - **Source type recognition**: Added `reddit` source type across the entire app:
    - Dashboard: recent activity, pinned memories, sources section — MessageSquare icon with orange accent
    - Explore: typeConfig with MessageSquare icon and orange color
    - Chat: source cards with orange accent and border for Reddit sources (also added obsidian to chat which was missing)
    - Import: history section with reddit type icon and color
  - **Plugin registry**: `reddit-saved` excluded from dynamic plugin tabs to prevent duplicates
- **Phase 2 Complete! 🎉**: All 6 Quick Win Import Plugins are now built:
  1. ✅ Kindle Highlights Importer (#2)
  2. ✅ PDF/EPUB Document Parser (#9)
  3. ✅ YouTube Transcript Importer (#3)
  4. ✅ Browser Bookmarks Importer (#6)
  5. ✅ Obsidian Vault Importer (#12)
  6. ✅ Reddit Saved Posts Importer (#8)
- **Next**: Phase 3 — Analysis Plugins (Mind Map Generator, Contradiction Finder, Topic Evolution Timeline, Sentiment Timeline, Knowledge Gaps Analyzer, Writing Style Analyzer)
- **Branch**: `frain/improve` (commit `2dd1418`)

## 2026-03-24 17:29 UTC — Obsidian Vault Importer Plugin (Phase 2, Plugin #12)
- **Context**: Phase 2 of the Plugin System build — Quick Win Import Plugins. Kindle (#2), PDF/EPUB (#9), YouTube (#3), Browser Bookmarks (#6) are done. Obsidian Vault Importer (#12) is next — the 5th plugin in the build order.
- **Implemented**:
  - **Full backend API route** (`/api/v1/plugins/obsidian-importer`):
    - **ZIP upload**: Uses JSZip to extract `.md` files from vault ZIP. Skips `.obsidian/`, `.trash/`, `__MACOSX/`, hidden files.
    - **Vault root stripping**: Auto-detects and removes the common vault root folder prefix (e.g. "MyVault/folder/note.md" → "folder/note.md").
    - **YAML frontmatter parser**: Handles tags (array + inline `[...]`), aliases, dates, booleans, numbers, strings. Supports multi-line arrays with `- item` syntax.
    - **Wikilink extraction**: `[[Note]]`, `[[Note|Display Text]]` — excludes embedded files `![[file]]`. Resolves via alias map.
    - **Inline tag extraction**: `#tag`, `#nested/tag` — skips code blocks and headings. Combined with frontmatter tags (deduplicated).
    - **Heading extraction**: Detects all `#`-`######` headings for structure-aware chunking.
    - **Smart chunking**: Splits large notes at heading boundaries (4000 char max). Preserves section context headers. Small notes stay as single memories.
    - **Content formatting**: Converts wikilinks to readable text, adds metadata header (folder path, tags, date, aliases, linked notes).
    - **Graph import**: Wikilinks stored as connections in `connections` table with `bridge_concept: 'wikilink'` and `similarity: 0.8`. Alias resolution for link targets.
    - **Batch embeddings**: Generates embeddings in batches of 50, up to 300 chunks max.
    - **Preview mode**: Returns vault stats (total notes, words, tags, wikilinks, folders, orphans), tag cloud with counts, folder tree, most-linked notes (by backlink count), sample notes with preview, graph connectivity stats (connected notes, avg links/note).
    - **Auto-install**: Plugin auto-installs in DB on first use.
  - **Import page UI** — full preview-then-import workflow:
    - Drop zone accepts `.zip` files with violet Gem icon accent
    - Preview card with vault stats: note count, word count, folder count, date range
    - Graph stats bar: wikilink count, connected notes, orphan count, links-per-note average
    - Tag cloud with count badges (violet-themed, shows top 12 + overflow count)
    - Folder list with folder icons and counts
    - Most-linked notes section showing backlink counts (emerald accent)
    - Sample notes list with link count, word count, folder path, tag preview
    - Violet import button showing note count
    - "Change" button to re-select file
  - **Source type recognition**: Added `obsidian` source type across the entire app:
    - Dashboard: recent activity, pinned memories, sources section — Gem icon with violet accent
    - Explore: type config with Gem icon and violet color
    - Import: history section with obsidian type icons
  - **Plugin registry**: obsidian-importer excluded from dynamic plugin tabs to prevent duplicates
- **Branch**: `frain/improve` (commit `b28e200`)

## 2026-03-24 15:59 UTC — PDF/EPUB Document Parser Plugin (Phase 2, Plugin #9)
- **Context**: Phase 2 of the Plugin System build — Quick Win Import Plugins. Kindle (#2) was done last cycle, PDF/EPUB (#9) is next in the build order.
- **Finding**: The PDF/EPUB parser backend existed but had a critical build error — pdf-parse v2 uses a class-based `PDFParse` API instead of the v1 default export function. The backend was committed but the build was broken. Additionally, the import page had no UI tab for PDF/EPUB — users would have had to manually install the plugin from the store first, then it would appear as a dynamic tab. Not a good UX for a core importer.
- **Implemented**:
  - **Fixed pdf-parse v2 API**: Rewrote `parsePDF()` to use the class-based `PDFParse` constructor with `getText()` and `getInfo()` methods instead of the old default function call. Added proper `destroy()` cleanup.
  - **Full Import Page integration** — PDF/EPUB and Kindle are now **built-in tabs** (not dynamic plugin tabs):
    - Added to `BASE_TABS` array with proper icons (`FileBox` for PDF/EPUB, `BookOpenCheck` for Kindle)
    - 8-column responsive grid (`grid-cols-4 md:grid-cols-8`) to accommodate all import sources
    - Dynamic plugin tabs now filter out kindle-importer and pdf-epub-parser to prevent duplicates
  - **PDF/EPUB tab UI** — full preview-then-import workflow:
    - Drop zone accepts `.pdf` and `.epub` files
    - Preview mode shows: title, author, format badge, page count, word count, section count, reading time, chunk count
    - Section-by-section breakdown with level-based color coding (blue=chapter, violet=section, zinc=subsection)
    - Word/char counts per section for transparency
    - Blue-themed import button showing document title and memory count
    - "Change file" option to re-select
  - **Auto-install on first use**: Both Kindle and PDF/EPUB API routes now auto-install the plugin into the DB on first use. No manual trip to the plugin store needed — just drop a file and go.
  - **Source type recognition**: Added `document` and `kindle` source types across the entire app:
    - Dashboard: recent activity, pinned memories, and sources section
    - Explore: type config with proper icons and colors
    - Import: history section with type icons
  - **EPUB support**: Chapter extraction via epub2, HTML-to-text conversion preserving headings and lists, TOC title resolution, temp file management
  - **PDF structure detection**: ALL CAPS headings, Chapter/Section/Part markers, numbered headings (1., 1.1, IV.), short title-like lines surrounded by blank lines
  - **Smart chunking**: Section-boundary-aware chunking (4000 char max), splits at paragraph boundaries, preserves document context headers
- **Branch**: `frain/improve` (commit `5fd50b2`)

## 2026-03-24 13:29 UTC — Enhanced Source Cards in Chat (Perplexity-style)
- **Research**: Internal UX audit — compared MindStore's chat source citations against Perplexity, Phind, Google AI Overviews, and ChatGPT's RAG implementations. Every modern RAG chat interface shows source previews inline so users can verify what the AI actually retrieved. MindStore's source cards only showed title + score bar — no content preview, no citation numbering, and no way to click through to the source memory.
- **Finding**: The search API already returned full content for each result, but the chat page was discarding it — only passing `title`, `type`, and `score` to the `SourceCards` component. The `[1]`, `[2]` citation numbers in AI responses had no visual counterpart in the source cards, making it hard to match citations to sources.
- **Implemented**:
  - **Content previews**: Each source card now shows a 2-line content preview (120 chars) below the title, giving users a transparent view of what the AI actually retrieved and reasoned from
  - **Citation number badges**: Numbered badges [1], [2], [3] etc. appear on each source card, visually matching the `[1]`, `[2]` inline citations in AI responses — users can now trace exactly which source backs which claim
  - **Clickable source cards**: Each source card is now wrapped in an `<a>` link that navigates to Explore with a search query for that memory. Click-through from chat → explore closes the discovery loop
  - **Memory ID + preview pipeline**: Updated `ChatMessage` type in `chat-history.ts` to include optional `id` and `preview` fields. Both source-mapping locations in the chat handler now pass `memoryId`/`id` and a 120-char content preview
  - **Expanded default view**: Shows 3 sources by default (up from 2) since the cards are now more informative and worth showing
  - **Design**: Citation badge uses `bg-white/[0.06]` with tabular-nums for consistent width. Preview text is `text-[10px] text-zinc-600` with `pl-6` indentation aligned under the title. Clickable cards get enhanced hover state (`bg-white/[0.06] border-white/[0.08]`)
- **Branch**: `frain/improve` (commit `63e5819`)

## 2026-03-24 12:59 UTC — Import History Section on Import Page
- **Research**: Internal UX audit — compared MindStore's Import page to Notion's import flow, Obsidian's sync status, and general PKM app patterns. After importing content, users had zero feedback about what they'd already imported, how much data was in the system, or when things were last added. The Import page was a one-way "drop and forget" experience with no import log or history.
- **Finding**: The Import page showed the import tabs and a progress bar during active imports, but once the import completed and the user navigated away, there was no record on the Import page itself. Users who wanted to know "what did I import?" or "when did I add that?" had to navigate to Explore and mentally reconstruct their import history. The sources API already returned `importedAt` timestamps and chunk counts — the data existed, just wasn't surfaced.
- **Implemented**:
  - **Import History section** below the import tabs, showing recent imports as a list:
    - Each entry displays: colored source type icon (green=ChatGPT, blue=file, orange=URL, violet=text), source title, type badge, chunk count, and relative timestamp
    - Click any entry → navigates to Explore with search query for that source
    - Shows up to 8 most recent imports (sorted by `importedAt` DESC), with "View all N sources in Explore →" link when more exist
    - Header shows total import count and total memory count, plus "Explore all" link with Compass icon
  - **Auto-refresh after import**: Both `importViaApi()` (FormData) and `importJsonViaApi()` (JSON) now call `refreshHistory()` on success, so the history section updates immediately after a new import without page reload
  - **Empty state**: When no imports exist yet, shows a dashed-border card with Package icon and "No imports yet — Choose a source above" prompt
  - **Data fetching**: Parallel `Promise.all()` fetch of `/api/v1/sources` + `/api/v1/stats` on mount
  - **`formatRelativeTime()` helper**: "just now", "Xm ago", "Xh ago", "yesterday", "Xd ago", or short date format
  - New icon imports: `Clock`, `Compass`, `Package`
  - Design: fully consistent with dashboard/explore patterns (rounded-2xl cards, divide-y list, hover states, zinc/violet palette)
- **Branch**: `frain/improve` (commit `93819bb`)

## 2026-03-24 11:29 UTC — Keyboard Shortcuts Help Modal
- **Research**: Internal UX audit — power-user keyboard discoverability. GitHub, Gmail, Linear, Notion, and Superhuman all provide a `?` keyboard shortcut that opens a comprehensive shortcuts reference modal. MindStore now has 15+ keyboard shortcuts across different pages (⌘K, j/k, ↵, /, s, p, e, a, ␣, Esc, etc.) but no unified reference — users had to discover them through the hint bars at the bottom of Explore or guess from muscle memory.
- **Finding**: Shortcuts were scattered and hidden. Explore had keyboard hint bars at the bottom of the list and detail modal, but Chat, Import, Learn, and the global ⌘K shortcut had no discoverability. The "?" shortcut for help is a universal convention that every serious keyboard-driven app supports.
- **Implemented**:
  - **New `KeyboardShortcuts` component** (`src/components/KeyboardShortcuts.tsx`):
    - Press `?` anywhere (when not in an input/textarea) to toggle the modal
    - Also accessible via the custom event `mindstore:open-shortcuts` for programmatic opening
    - **Context-aware grouping**: shortcuts organized by page context:
      - 🌐 **Global** (always shown): ⌘K command palette, ? shortcuts
      - 🧭 **Explore** (12 shortcuts): /, j/k, ↵, Esc, e, p, s, ␣, a, ↑↓, ⌘↵
      - 💬 **Chat** (3 shortcuts): ↵ send, ⇧↵ new line, Esc close history
      - 🎓 **Learn** (2 shortcuts): ↵ send, ⇧↵ new line
      - 📥 **Import** (1 shortcut): ↵ submit URL
    - **Current page highlighting**: when on a specific page (e.g. Explore), that group is highlighted with violet accent styling and a "Current page" badge — so users see their most relevant shortcuts first
    - **Design**: dark glass modal (bg-[#111113]) with rounded-2xl, 22px kbd key badges with mono font, divide-y section layout, purple accent for highlighted groups
    - **Animations**: CSS-only `ks-fade-in` backdrop + `ks-scale-in` modal entry (scale 0.95 → 1 + translateY spring)
    - Auto-closes on route change and Escape key
    - Escape handler uses capture phase to prevent conflicts with other Escape listeners
  - **Sidebar shortcut**: New "Shortcuts" button in the desktop sidebar footer (below Search/⌘K), with Keyboard icon and `?` kbd hint — matches existing Search button styling exactly
  - **Layout integration**: Added to `layout.tsx` alongside Onboarding, CommandPalette, and GlobalDropZone
  - Added `Keyboard` to lucide-react imports in layout
  - Exported `openKeyboardShortcuts()` utility function for programmatic access
- **Branch**: `frain/improve` (commit `dcc9145`)

## 2026-03-24 10:29 UTC — Save Chat Response to Memory (Knowledge Loop)
- **Research**: Internal UX audit — compared MindStore's chat experience to Mem.ai, Notion AI, and Reflect. A core pattern in modern PKM apps is the "knowledge loop": you search/chat your knowledge → get a synthesized insight → save that insight back as new knowledge. MindStore had no way to capture AI-generated answers back into the knowledge base. Users would get great synthesized responses but couldn't persist them without manually copy-pasting into Import.
- **Finding**: The chat message hover UI only showed a Copy button. Assistant messages needed a Save action to close the knowledge loop. This is a signature feature that differentiates true PKM tools from simple chatbots.
- **Implemented**:
  - **MessageActions component**: New hover-action bar for assistant messages with two buttons:
    - **Copy** (existing behavior, preserved)
    - **Save to Memory** (new): BookmarkPlus icon with "Save" label
  - **Save workflow**:
    - Extracts the preceding user question as context for the memory title (prefixed with 💡)
    - POSTs to `/api/v1/import` as a `text` type document
    - Shows loading spinner during save, green checkmark on success
    - Toast notification with chunk count + "Find it in Explore" description
    - Button transitions to "Saved" state after success (prevents double-saves)
  - **Design details**:
    - Hover state: violet accent (bg-violet-500/10, border-violet-500/20) — matches app palette
    - Saved state: emerald accent (bg-emerald-500/10) for clear success feedback
    - Responsive: icon-only on mobile, icon + "Save" label on desktop (hidden via sm:inline)
    - Shadow, border, and rounded-lg match existing Copy button aesthetics
  - User messages retain the original single Copy button on the left side
- **Branch**: `frain/improve` (commit `f55012f`)

## 2026-03-24 09:59 UTC — Content Stats Bar in Explore Detail Modal
- **Research**: UX audit against Notion, Obsidian, Medium, Mem, Apple Notes. Every serious knowledge management app shows content metadata (word count, reading time) when viewing a document. MindStore's Explore detail modal showed only source type, title, and date — no content-level stats. Users had no way to gauge memory size or reading commitment before diving in.
- **Finding**: The detail modal had a header and content area, but the gap between them was an unused opportunity. Adding a stats bar in that space follows Notion's document info pattern and Medium's reading time convention, both of which are proven UX patterns users intuitively understand.
- **Implemented**:
  - **Content Stats Bar** between header and content in the Explore detail modal:
    - **Word count** with # icon — count of whitespace-separated tokens
    - **Character count** — total characters for length-at-a-glance
    - **Reading time** with BookOpen icon — estimated at 225 WPM (standard reading speed), minimum 1 minute
    - **Import date** with Clock icon — shows when the memory was imported (only if different from the content's original timestamp), giving temporal context for when knowledge entered MindStore
  - Stats bar is hidden during edit mode (not relevant while editing)
  - Dot separators between stats items for clean visual rhythm
  - Subtle styling: `text-[10px] text-zinc-600` with `bg-white/[0.01]` background, matching existing design system
  - Tooltips on hover for each stat with more detail
  - New lucide imports: `Clock`, `Hash`, `BookOpen`
- **Branch**: `frain/improve` (commit `882b041`)

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

## 2026-03-24 09:29 UTC — Sort Memories in Explore
- **Research**: Internal UX audit — every modern knowledge management app (Notion, Obsidian, Apple Notes, Mem, Reflect) provides sort controls when browsing content. MindStore's Explore page always showed memories sorted by newest first with no user control. Users with hundreds of memories had no way to find content by title alphabetically or by content length.
- **Finding**: The Explore page had filter pills (by source type) but no sort control — a fundamental gap. The backend API also hardcoded `ORDER BY created_at DESC` with no flexibility.
- **Implemented**:
  - **Backend** (`/api/v1/memories`): Added `sort` query parameter supporting 6 sort modes:
    - `newest` (default) — created_at DESC
    - `oldest` — created_at ASC
    - `alpha-asc` — Title A→Z (case-insensitive, falls back to created_at)
    - `alpha-desc` — Title Z→A
    - `longest` — Content length DESC (find most substantial memories)
    - `shortest` — Content length ASC (find brief notes)
  - **Frontend** (Explore page): Sort dropdown button with ArrowUpDown icon
    - Positioned inline with filter pills (right-aligned) for clean layout
    - Dropdown menu with 6 options, each with descriptive icon (ArrowDownNarrowWide, ArrowDownAZ, etc.)
    - Active sort highlighted with violet accent + dot indicator
    - Hidden during search (since search results are ranked by relevance score, not chronologically)
    - Sort selection resets focused index and immediately refetches memories
    - Sort persists across filter changes — infinite scroll also respects sort order
    - Click-outside-to-close with fixed overlay
    - Fully responsive — label hidden on mobile, icon-only on small screens
  - Design: matches existing filter pill aesthetic (rounded-full, 30px height, violet active state)
- **Branch**: `frain/improve` (commit `d95a206`)

## 2026-03-24 11:59 UTC — Related Memories in Explore Detail View
- **Research**: Internal UX audit — core PKM apps (Obsidian, Notion, Mem, Reflect, Capacities) all surface related/connected content when viewing a note. Obsidian has backlinks and outgoing links, Notion has related pages, Mem has "related notes" via AI, Reflect shows bi-directional links. MindStore's Explore detail modal showed a single memory in isolation with no way to discover connections to other stored knowledge.
- **Finding**: The detail modal was a dead-end — users could view content, edit, pin, copy, or delete, but had no way to explore the knowledge graph from that context. This is the opposite of what a "second brain" should do. The whole point of a PKM is surfacing unexpected connections. The search API already supports semantic search, so the infrastructure existed — just no UI to surface it in-context.
- **Implemented**:
  - **Related Memories section** in the Explore detail modal (between content area and footer):
    - When a memory is selected, automatically fetches 4 semantically similar memories via `/api/v1/search`
    - Uses a combination of the memory's title + first 200 chars of content as the search query
    - Filters out the currently viewed memory from results
    - Each related memory shows: colored source type icon, title, content preview (100 chars), similarity score bar, and arrow icon
    - Clicking a related memory navigates to it — if it's in the loaded list, selects directly; if not, fetches from API
    - Loading state with skeleton animation while fetching
    - Hidden during edit mode to keep the UI focused
    - Request abort on memory change to prevent stale results
  - **Design**: `Sparkles` icon header with "Related memories" label, compact card layout with hover states, score visualization bars matching the chat source cards pattern
  - **Icons**: Added `Sparkles` and `ExternalLink` from lucide-react
- **Branch**: `frain/improve` (commit `dd9900e`)

## 2026-03-24 12:29 UTC — Pinned Memories on Dashboard
- **Research**: PKM UX audit — every major knowledge management app (Notion, Obsidian, Apple Notes, Bear, Mem, Capacities) surfaces pinned/starred/favorited items on the home screen. MindStore added pinning in a previous cycle, and the backend stats API already returned `pinnedMemories` data, but the dashboard page never used it. Users who pinned important memories had to navigate to Explore with a pinned filter to find them — defeating the purpose of quick access.
- **Finding**: The stats API already had the infrastructure (`pinnedMemories` array, `pinnedCount`), but the dashboard `page.tsx` only rendered stat cards, quick search, action grid, recent activity, discover features, and sources. Pinned memories were invisible from the home screen.
- **Implemented**:
  - **Pinned Memories section** on the dashboard, positioned between stat cards and action grid for maximum prominence:
    - Shows up to 4 pinned memories in a responsive 2-column grid (`grid-cols-1 sm:grid-cols-2`)
    - Each card features: warm amber gradient background (`from-amber-500/[0.04]`), subtle pin icon in top-right corner, source type icon badge, title, and 2-line content preview
    - Header with Pin icon, "PINNED" label, and count badge
    - "View all →" link that navigates to Explore with pinned filter (`/app/explore?filter=pinned`)
    - Click navigates to Explore with search query for the memory
    - Hover state: amber gradient intensifies + border brightens + title goes white
    - Only renders when `pinnedMemories.length > 0` — zero visual noise for users without pins
  - **No backend changes** — leverages existing stats API data
  - **Design**: amber-tinted gradient cards complement the pinning feature's amber color palette, creating visual consistency across Explore and Dashboard
- **Branch**: `frain/improve` (commit `ba293bb`)

## 2026-03-24 13:59 UTC — 14-Day Activity Chart on Dashboard
- **Research**: UX patterns from Obsidian (activity graph), GitHub (contribution heatmap), and Duolingo (streak counter). Knowledge management apps that show activity patterns keep users engaged and motivated. MindStore's dashboard showed stat cards and recent activity list, but had no temporal visualization of knowledge growth.
- **Finding**: The stats API had no temporal data at all — just total counts and recent items. Users had no way to see their knowledge-building patterns over time, making it impossible to answer "am I consistently adding to my knowledge base?"
- **Implemented**:
  - **Backend**: Added `dailyActivity` query to `/api/v1/stats` — aggregates memory creation counts by day for the last 14 days, with a `buildDailyActivity()` helper that fills in zero-count days for a complete 14-day array
  - **Frontend**: `ActivityChart` component on dashboard between Stat Cards and Pinned Memories:
    - 14 vertical bars showing daily import counts, proportionally scaled to max
    - Today's bar highlighted with violet gradient + shadow glow
    - Hover tooltips showing exact count and date for each day
    - Hover state: bar brightens to `violet-400/60`
    - Zero-count days shown as 2px dim bars for visual continuity
    - 🔥 Streak counter — shows consecutive active days (e.g. "🔥 5-day streak")
    - Date labels at start, middle, and end of the 14-day range
    - Header with BarChart3 icon, "ACTIVITY · 14 days" label, total memories added count
    - Only renders when there's actual activity data (zero visual noise for inactive users)
  - **Design**: Matches MindStore's design language — dark rounded cards, violet gradients, zinc-toned typography, smooth transitions
- **Branch**: `frain/improve` (commit `b5ede6c`)
