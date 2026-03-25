# 2026-03-25: Mind Map Generator Port

## Summary

- Ported Mind Map Generator into the codex runtime-first architecture.
- Reused the shared vector/clustering helper for topic and sub-topic generation.
- Kept the existing `/app/mindmap` experience while replacing the route with a thin wrapper.
