# Voice-to-Memory

Voice-to-Memory lets you speak a thought and turn it into searchable knowledge inside MindStore.

## What It Does

- records audio in the browser
- transcribes it with OpenAI Whisper or Gemini
- stores the transcript as a voice recording
- lets you save that recording into your main memory base

## How To Use It

1. Open `/app/voice`.
2. Start recording.
3. Stop when you are done speaking.
4. Review the transcript and edit the title if needed.
5. Save it to your knowledge base.

## Requirements

- a browser with microphone access
- an OpenAI or Gemini API key configured in MindStore settings

## What Gets Stored

- recording title
- transcript text
- provider and model metadata
- duration, language, and word count
- whether the transcript has been saved as a memory

## Why This Port Matters

Voice-to-Memory is the second major `frain` feature ported into the codex architecture.

It is the reference example for media-aware AI plugins because it combines:

- browser capture
- transcription provider selection
- reusable server-side business logic
- save-to-memory integration
- codex docs and tests
