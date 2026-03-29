# 2026-03-30 — Auth and Diagnostics Hardening

## What changed

- Added a real `/login` page for public multi-user deployments.
- Split the `/app` shell into a client component and wrapped it in a server layout gate.
- Redirects now send unauthenticated users to `/login` when Google OAuth is enabled.
- Public deployments with `ALLOW_SINGLE_USER_MODE=false` but missing OAuth now land on a clear configuration message instead of silently sharing a workspace.
- Health and settings APIs now expose sanitized database connection diagnostics such as pooler/direct host kind, port, SSL requirement, and prepared statement mode.
- Updated landing, README, and deploy docs to stop implying that public shared single-user mode is acceptable.

## Why it matters

MindStore cannot be considered a real multi-user product until the app itself enforces identity boundaries. This slice converts the current auth implementation from “present in the codebase” to “visible and enforceable in the product”.
