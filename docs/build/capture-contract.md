# Capture Contract

The capture contract is the bridge between MindStore and lightweight clients like browser extensions.

## Goals

- Accept raw client capture payloads with minimal ceremony.
- Normalize them into importable documents on the server.
- Preserve source metadata for later search, analysis, and plugin behavior.

## Contract Shape

A capture payload may include:

- `title`
- `url`
- `sourceApp`
- `captureMode`
- `selection`
- `pageText`
- `conversationText`
- `metadata`
- `capturedAt`

## Server Responsibilities

- Choose the best available content for the requested capture mode.
- Canonicalize `sourceType`.
- Preserve metadata in the `memories.metadata` column.
- Route the normalized document through the shared import pipeline.
- Allow active plugins to transform or enrich capture batches before indexing.

## Why This Matters

Without a dedicated capture contract, every client would need to know too much about import internals. The contract keeps thin clients simple and keeps MindStore's indexing rules centralized.
