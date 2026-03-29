# 2026-03-30 — Supabase SSL Hardening

## What changed

- MindStore now forces `ssl: "require"` automatically for Supabase direct and pooler hosts.
- Supabase transaction pooler hosts still disable prepared statements automatically.
- Added unit coverage for Supabase URL detection, SSL forcing, and diagnostics.

## Why it matters

Production was using a valid Supabase pooler URL shape, but without `?sslmode=require` in the environment variable. That left the deployment in a broken state even though the same database worked locally when the query param was present. This slice removes that configuration footgun from the runtime itself.
