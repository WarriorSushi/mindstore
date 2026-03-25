# YouTube Transcript

The YouTube Transcript importer turns a single video URL into structured, timestamped memory chunks.

## What It Does

- validates and normalizes common YouTube URL formats
- fetches lightweight video metadata
- downloads transcript segments through `youtube-transcript`
- groups transcript text into topic-ish chunks using pause-aware splitting
- stores each chunk as its own MindStore memory

## Codex Port Notes

- portable logic lives in `src/server/plugins/ports/youtube-transcript.ts`
- the route is now a thin wrapper at `src/app/api/v1/plugins/youtube-transcript/route.ts`
- chunk boundaries are preserved during import via `preChunked` import documents

## Response Shape

- preview returns `video` plus `transcript`
- import returns `imported.video`, `totalWords`, `chunks`, `embedded`, and `chunkDetails`
