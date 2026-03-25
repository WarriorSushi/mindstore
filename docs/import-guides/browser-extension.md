# Browser Extension

Use MindStore Everywhere when you want fast capture from any page without switching back to the app.

## What It Can Capture

- Selected text from the current page.
- A cleaned page excerpt from articles or main content areas.
- Conversation transcripts from supported AI web apps when the DOM exposes message roles clearly.

## Supported Sources Right Now

- Generic web pages
- ChatGPT web UI
- Claude web UI
- OpenClaw web UI

## Load The Extension

1. Open your Chromium-based browser extension settings.
2. Turn on developer mode.
3. Load `extensions/mindstore-everywhere` as an unpacked extension.
4. Set the MindStore base URL in the popup.

## Recommended First Run

1. Open a page with real text content.
2. Highlight one paragraph.
3. Open the extension and leave capture mode on `Smart capture`.
4. Save it to MindStore.
5. Search for a phrase from the captured text inside MindStore.

## What The Extension Sends

- `POST /api/v1/capture` for saving captures
- `POST /api/v1/capture/query` for lightweight popup search

## Current Limits

- No hosted auth flow yet
- Site adapters are heuristic and should keep improving
- Query results are short excerpts, not full chat responses
