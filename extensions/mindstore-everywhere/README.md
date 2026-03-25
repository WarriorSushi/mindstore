# MindStore Everywhere

This is the first working browser extension for capturing content into MindStore and querying your memory from the current page.

## What It Does

- Captures the current text selection or page excerpt
- Detects supported AI chat surfaces and captures conversation transcripts when available
- Sends captures to `POST /api/v1/capture`
- Queries saved knowledge via `POST /api/v1/capture/query`
- Supports API key auth via `Authorization: Bearer`
- Works against a local or remote MindStore instance

## Load It

1. Open Chromium-based browser extensions
2. Enable developer mode
3. Load this folder as an unpacked extension
4. Set the base URL to your MindStore instance
5. Add an API key from MindStore Settings if your deployment is not single-user local mode

## Current Scope

- Smart capture with selection, page, and conversation modes
- Lightweight "Ask MindStore" query box in the popup
- API key auth for hosted or shared deployments
- First site adapters for ChatGPT, Claude, Gemini, and OpenClaw

## Next Improvements

- Add signed auth for hosted instances
- Add richer metadata and source typing
- Add source-specific query shortcuts and richer result cards
