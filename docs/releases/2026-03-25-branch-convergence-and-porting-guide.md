# 2026-03-25: Branch Convergence and Plugin Porting Guide

## What Changed

- synced `IMPROVEMENTS.md` from `origin/frain/improve`
- restored `MIND_FILE_SPEC.md` from `origin/frain/improve`
- added a branch convergence plan for `codex` and `frain`
- added a plugin porting guide for adapting route-based plugins into the codex runtime model
- linked the new guidance into builder docs and roadmap docs

## Why It Matters

MindStore currently has two strong branches with different strengths:

- `codex`: runtime, docs, tests, MCP, scheduling, extension foundation
- `frain`: plugin breadth, UI breadth, feature polish

This release documents how those two lines should converge without destroying either one.

## Convergence Decision

- `codex` is the destination branch
- `frain` feature logic and UI should be ported into codex in slices
- first example ports should be `kindle-importer`, `flashcard-maker`, and `voice-to-memory`
