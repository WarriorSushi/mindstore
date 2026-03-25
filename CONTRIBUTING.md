# Contributing to MindStore

MindStore is evolving into a personal knowledge layer for AI with a strong open plugin ecosystem. Contributions are welcome across product, docs, testing, platform, and plugin work.

## Working Norms

- Never merge directly to `main`.
- Use topic branches such as `codex/*`, `feat/*`, or `fix/*`.
- Keep changes decision-documented when they affect architecture, security, or extension contracts.
- Update docs for any user-visible or builder-visible behavior change.

## License And Contribution Origin

- This repository is currently licensed under [LICENSE](./LICENSE).
- Contributions are accepted under the repository's current outbound license unless a subdirectory says otherwise.
- Contributors should add a `Signed-off-by:` line to commits in line with [DCO.md](./DCO.md).
- Branding rights are separate from code rights; see [TRADEMARKS.md](./TRADEMARKS.md).

## Good First Contribution Areas

- Documentation improvements
- Importer polish and edge cases
- Plugin SDK/runtime ergonomics
- Tests, CI, and reliability work
- Accessibility and onboarding UX

## Development Loop

1. Install dependencies with `npm install`
2. Configure `.env`
3. Run `npm run migrate`
4. Start the app with `npm run dev`
5. Run `npm run typecheck`
6. Run `npm run test`
7. Run `npm run lint:ci`

## Pull Request Expectations

- Explain the problem and user impact clearly
- Include screenshots or terminal output for UI or DX changes when helpful
- Add or update docs
- Add or update tests for non-trivial behavior
- Call out assumptions, tradeoffs, and follow-up work
- Confirm contribution origin with a DCO sign-off where possible

## Plugin and Platform Changes

If you touch plugin contracts, MCP behavior, or config surfaces:

- Update the relevant docs in `docs/`
- Add or update an ADR in `docs/adr/` when the decision is architectural
- Keep backward compatibility in mind for plugin slugs and manifests

## Code of Conduct

By participating, you agree to uphold the standards in [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
