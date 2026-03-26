# MindStore Everywhere

MindStore Everywhere is the browser companion for MindStore. It lets you capture what you are reading now and ask your saved memory questions without leaving the page.

## What It Can Capture

- Text selections from any page.
- Page excerpts from normal websites.
- Conversation transcripts from supported AI UIs such as ChatGPT, Claude, Gemini, and OpenClaw-style apps.

## Setup

1. Open MindStore and go to `/app/settings`.
2. In `MindStore Everywhere`, generate an API key if your deployment is hosted or shared.
3. Download the packaged extension from `/api/v1/extension/package`, or load `extensions/mindstore-everywhere` as an unpacked extension in a Chromium browser.
4. Paste your MindStore base URL into the popup.
5. Paste the API key if you created one.
6. Use the popup's `Test connection` button before your first capture.

## What The Connection Check Verifies

- The extension setup endpoint is reachable.
- The capture and query URLs are the ones the extension should use.
- A provided API key is accepted by the MindStore server.
- The extension can open the right documentation and package URLs for the current deployment.

## Capture Modes

- `Smart capture`: prefers a text selection, then a supported conversation transcript, then the page excerpt.
- `Conversation first`: useful on supported AI chat pages.
- `Selection first`: best for article snippets, code blocks, and quoted passages.
- `Page excerpt`: captures the main visible content from the page.

## Ask MindStore

The extension popup also includes a lightweight query box. It sends your question to MindStore and returns the top saved memories for that topic.

## Troubleshooting

- If capture works locally but not on a hosted instance, add an API key.
- If the `Test connection` button fails, verify the base URL includes the correct protocol and host, for example `https://your-mindstore.example.com`.
- If a conversation page falls back to page capture, switch to `Conversation first`.
- If a page saves too much chrome or sidebar text, try selecting the exact content and use `Selection first`.
