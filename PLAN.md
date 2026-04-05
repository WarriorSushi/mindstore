# MindStore — Master Build Plan

**Last Updated:** 2026-04-06  
**Branch:** amadeus/p0-improvements → main  
**Status:** Feature-complete codebase. Product not yet production-ready.

---

## Reality Check

The codebase is massive and technically excellent:
- 35 pages, 65+ API routes, 36 plugins, 336 tests, 103 docs
- Triple-layer retrieval (BM25 + vectors + tree), multi-provider AI, MCP server
- All pages have empty states, animations, accessibility

The product is NOT ready for real users:
- Production has zero AI providers configured → all AI features dead
- Only 1 test memory in DB → looks empty to visitors
- No Google OAuth → can't grow beyond single-user
- Onboarding exists but has gaps
- Landing page over-sells ChatGPT import, under-sells the broader vision

---

## What's Fully Built ✅

| Area | Status |
|------|--------|
| 35 app pages | ✅ Full UI, animations, empty states |
| 36 plugin port modules | ✅ All logic extracted, reusable |
| 65+ API routes | ✅ All wired |
| Triple-layer retrieval | ✅ BM25 + pgvector + tree index |
| Multi-provider AI client | ✅ OpenAI, Gemini, Ollama, OpenRouter |
| Auth (NextAuth v5) | ✅ Google OAuth + single-user fallback |
| MCP server | ✅ Claude Desktop, Cursor compatible |
| Database schema | ✅ 12 tables, pgvector, pg_trgm |
| Landing page | ✅ Exists but needs conversion work |
| Onboarding wizard | ✅ Exists but needs polish |
| 336 unit tests | ✅ All passing |
| Browser extension setup | ✅ Endpoints exist |

---

## What's Half-Baked 🟡

| Area | Issue |
|------|-------|
| **Knowledge Fingerprint** | 3D WebGL canvas exists but stub/empty; not wired to real graph data |
| **Demo mode** | Pre-loaded demo data exists but is sparse (1 memory); doesn't showcase all features |
| **Onboarding flow** | Wizard pages exist; SetupStep AI provider config needs live validation |
| **Landing page CTA** | Exists; needs to showcase MORE features (analysis, graph, MCP) not just ChatGPT import |
| **Error handling** | Some silent catches; graceful "no AI provider" messaging inconsistent |
| **Search suggestions** | Route exists; debounce/UX integration incomplete in explore page |
| **Import indexing** | Made durable in last commit; verify background job reliability |
| **Duplicate detection** | Page + route exist; confirm live embedding-based detection works |
| **Job runner** | `jobs:run-due` and `jobs:run-indexing` scripts exist but no scheduler (cron/vercel) set up |

---

## What's Missing Entirely ❌

| Area | Notes |
|------|-------|
| **`.mind` file format** | 632-line spec written, zero implementation |
| **Team workspaces** | Single-user only |
| **Payment system** | No Pro tier, no Dodo Payments |
| **Analytics** | No Plausible/Umami integration |
| **P2P sync / CRDT** | Planned for Phase C |
| **Browser extension code** | Setup endpoints exist; extension itself not in repo |
| **Community knowledge bases** | No sharing/merging |
| **OG image generation** | Meta tags exist; dynamic OG generation incomplete |
| **Vercel cron jobs** | No `vercel.json` cron config for job runners |
| **Rate limiting** | Per-user limits not enforced at route level |

---

## Production Blockers (Owner: Irfan) 🚨

These require env vars set in Vercel — can't be done in code:

1. `GEMINI_API_KEY` — free at aistudio.google.com — unblocks ALL AI features
2. `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — unblocks multi-user auth
3. DB migration confirmation — tables should exist; verify via `/api/health`

---

## Build Plan — Prioritized

### P0: Make It Usable (Current Sprint — amadeus/p0-improvements)

**Goal:** A real user lands, signs up, imports something, uses AI chat. Nothing breaks.

#### P0.1 — Graceful "No AI Provider" State
- [ ] In chat page: if no AI provider configured (no env var, no user setting), show clear banner with link to Settings
- [ ] In all plugin pages that call AI: consistent fallback message, not blank failure
- [ ] Settings page `/app/connect` and `/app/settings`: validate API key on save with live test call

#### P0.2 — Import → Index → Search Loop Verification  
- [ ] Verify that after import, the background indexing job triggers correctly
- [ ] Confirm `/api/v1/import` → job queue → `/api/v1/search` flow end-to-end
- [ ] If indexing is async, show "indexing in progress" indicator in Explore

#### P0.3 — Onboarding Polish
- [ ] After completing onboarding, redirect to Explore (not blank dashboard)
- [ ] SetupStep: add live API key validation before proceeding
- [ ] DoneStep: pre-populate 3 sample memories so dashboard isn't empty
- [ ] First-time dashboard: prominent "Import your first knowledge" CTA if 0 memories

#### P0.4 — Landing Page Conversion Fix
- [ ] Add section: Knowledge Analysis Suite (evolution, sentiment, gaps, contradictions)
- [ ] Add section: MCP Integration (Claude Desktop, Cursor, Windsurf)  
- [ ] Add section: Knowledge Graph / Fingerprint visual
- [ ] Reduce prominence of "ChatGPT import" headline — make it one feature of many
- [ ] Ensure all CTAs work and link correctly
- [ ] Server-render the above sections for SEO

#### P0.5 — Dashboard First-Run Experience
- [ ] Empty dashboard: show feature cards with "Try this" links instead of blank stats
- [ ] Stats widgets: handle 0-state gracefully (not NaN/undefined)
- [ ] Quick actions: "Import", "Chat", "Explore" prominent buttons when empty

### P1: Production Hardening

#### P1.1 — Job Scheduling
- [ ] Add Vercel cron config to `vercel.json` for `jobs:run-due` (every 5 min)
- [ ] Add Vercel cron config for `jobs:run-indexing` (every 1 min)
- [ ] Protect cron endpoints with `CRON_SECRET` env var

#### P1.2 — Error Boundaries
- [ ] Audit all plugin pages for unhandled promise rejections
- [ ] Add toast notifications for AI provider errors (not silent failures)
- [ ] Health endpoint `/api/health` — expose in Settings page for user self-diagnosis

#### P1.3 — Performance
- [ ] Bundle size audit — identify heavy imports
- [ ] Lazy load plugin port heavy modules (epub2, pdf-parse) only when needed
- [ ] Image optimization for any assets
- [ ] Add `loading="lazy"` to non-critical images

#### P1.4 — Mobile Audit
- [ ] Test all 35 pages at 375px, 768px viewports
- [ ] Fix any overflow/horizontal scroll issues
- [ ] Bottom nav on mobile: ensure all tabs accessible
- [ ] Touch targets: minimum 44px × 44px

### P2: Growth Features

#### P2.1 — Knowledge Fingerprint 3D Graph
- [ ] Wire `reagraph` WebGL component to real `connections` table data
- [ ] Compute graph layout from memory embeddings and relationships
- [ ] Add filters: by source, by time, by topic cluster
- [ ] Export fingerprint as image

#### P2.2 — `.mind` File Phase 1 (Export Only)
- [ ] Binary encoder for `.mind` format (per MIND_FILE_SPEC.md)
- [ ] Export button in Settings → downloads `.mind` file
- [ ] Import `.mind` file back into MindStore

#### P2.3 — Analytics
- [ ] Add Plausible script to layout (privacy-friendly, GDPR-safe)
- [ ] Track: pageviews, signups, imports, AI queries
- [ ] Dashboard stats page: show real usage metrics

#### P2.4 — Pro Tier Foundation
- [ ] Define free tier limits (e.g., 1000 memories, 3 AI providers)
- [ ] Add usage tracking to memory table
- [ ] Dodo Payments webhook endpoint (stub)
- [ ] Upgrade CTA banners for users near limits

### P3: Vision Features (Future)

| Feature | Description |
|---------|-------------|
| **Team Workspaces** | Shared knowledge bases, role-based access |
| **P2P Sync** | WebRTC + CRDT for offline-first sync |
| **Community Knowledge** | Share, fork, merge public knowledge bases |
| **Browser Extension** | Capture web pages, highlights, YouTube |
| **Adversarial Retrieval** | "Devil's Advocate" mode — finds counterarguments |
| **Forgetting Curve** | Spaced repetition scheduler integrated with flashcards |
| **Mind Diff** | Compare knowledge state across time snapshots |
| **`.mind` Phase 2/3** | Embedded server, P2P sync, encryption |

---

## Branch Strategy

```
main (production)
  └── amadeus/p0-improvements (current sprint — P0 work)
       └── → merge to main when P0 complete
```

- Work on `amadeus/p0-improvements`
- Open PR to `main` after each P0 task group
- Never force-push main

---

## Tech Stack Quick Reference

| Layer | Tech |
|-------|------|
| Framework | Next.js 16.2 (App Router) |
| React | 19.2 |
| DB | PostgreSQL + pgvector + pg_trgm |
| ORM | Drizzle |
| Auth | NextAuth v5 |
| AI | Multi-provider: OpenAI, Gemini, Ollama, OpenRouter |
| MCP | @modelcontextprotocol/sdk |
| UI | Tailwind CSS v4, shadcn/ui, lucide-react |
| Tests | Vitest (336), Playwright (E2E) |
| Deploy | Vercel |

---

## Files to Know

| File | Purpose |
|------|---------|
| `src/server/schema.ts` | Database schema (Drizzle) |
| `src/server/retrieval.ts` | Triple-layer fusion retrieval |
| `src/lib/ai-client.ts` | Multi-provider AI abstraction |
| `src/app/app/layout.tsx` | App shell (sidebar, nav) |
| `src/app/page.tsx` | Landing page (server) |
| `src/app/landing-client.tsx` | Landing page (client) |
| `src/app/app/onboarding/` | Onboarding wizard |
| `src/app/app/chat/` | Chat with AI |
| `src/app/app/explore/` | Search & explore |
| `src/app/api/v1/` | All API routes |
| `src/server/plugins/ports/` | 36 pure plugin logic modules |
| `MIND_FILE_SPEC.md` | .mind format specification |
| `ARCHITECTURE.md` | Architecture overview |
