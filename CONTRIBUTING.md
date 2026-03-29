# Contributing to MindStore

Thanks for your interest in contributing! MindStore is built by a small team and we value every contribution.

## Quick Start

```bash
git clone https://github.com/WarriorSushi/mindstore.git
cd mindstore
npm install
cp .env.example .env.local  # Configure your database
npm run dev                  # http://localhost:3300
```

## Requirements

- Node.js 20+
- PostgreSQL with pgvector extension
- At least one AI provider key (Gemini is free)

## Development

```bash
npm run dev          # Dev server with hot reload
npm run test         # Run all tests (336)
npm run build        # Production build
npm run typecheck    # TypeScript checking
npm run lint         # ESLint
npm run test:e2e     # Playwright E2E tests
```

## Commit Convention

We use [DCO sign-off](https://developercertificate.org/) on all commits:

```bash
git commit -s -m "feat: add new importer for X"
```

Prefix your commit message:
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `test:` — adding or updating tests
- `chore:` — maintenance

## Pull Requests

1. Fork the repo and create your branch from `main`
2. Make your changes
3. Ensure `npm run build` passes
4. Ensure `npm run test` passes
5. Write a clear PR description
6. Submit!

## Branch Workflow

MindStore now uses `main` as trunk.

- Start all new work from current `main`
- Use a short-lived topic branch for the change
- Land verified work on `main`
- Mirror branches like `codex/local-dev` and `frain/improve` are sync branches, not independent long-lived feature lines

If you are continuing work from an older agent branch, rebase or fast-forward it to `main` before making new changes.

## Building Plugins

MindStore has a plugin system for adding importers, analysis tools, and actions. See [`docs/build/plugin-porting-guide.md`](docs/build/plugin-porting-guide.md) for the full guide.

Quick version:
1. Create your manifest in `src/server/plugins/registry.ts`
2. Add your page in `src/app/app/your-plugin/page.tsx`
3. Add your API route in `src/app/api/v1/plugins/your-plugin/route.ts`
4. Add portable logic in `src/server/plugins/ports/your-plugin.ts`

## Design Guidelines

- OLED black (`#0a0a0b`) base, teal-500 primary, sky secondary
- Lucide icons only (no emojis in UI)
- Follow the design system in `.impeccable.md`
- No violet, purple, or fuchsia colors

## Code of Conduct

We follow the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful.

## License

By contributing, you agree that your contributions will be licensed under the [FSL-1.1-MIT](LICENSE) license.
