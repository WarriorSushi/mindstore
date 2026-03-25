# MindStore Everywhere

MindStore Everywhere is the browser companion for MindStore. It lets you capture what you are reading now and ask your saved memory questions without leaving the page.

## What It Can Capture

- Text selections from any page.
- Page excerpts from normal websites.
- Conversation transcripts from supported AI UIs such as ChatGPT, Claude, and OpenClaw-style apps.

## Setup

1. Open MindStore and go to `/app/settings`.
2. In `MindStore Everywhere`, generate an API key if your deployment is hosted or shared.
3. Open your browser extensions page and enable developer mode.
4. Load the `extensions/mindstore-everywhere` folder as an unpacked extension.
5. Set your MindStore base URL in the popup.
6. Paste the API key if you created one.

## Capture Modes

- `Smart capture`: prefers a text selection, then a supported conversation transcript, then the page excerpt.
- `Conversation first`: useful on supported AI chat pages.
- `Selection first`: best for article snippets, code blocks, and quoted passages.
- `Page excerpt`: captures the main visible content from the page.

## Ask MindStore

The extension popup also includes a lightweight query box. It sends your question to MindStore and returns the top saved memories for that topic.

## Troubleshooting

- If capture works locally but not on a hosted instance, add an API key.
- If a conversation page falls back to page capture, switch to `Conversation first`.
- If a page saves too much chrome or sidebar text, try selecting the exact content and use `Selection first`.
