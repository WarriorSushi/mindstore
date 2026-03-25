/**
 * Plugin Ports — Portable logic modules for convergence with codex runtime
 * 
 * Each port extracts the core business logic from a plugin's route file,
 * making it framework-agnostic and ready for Codex's SDK/runtime.
 * 
 * AI calling is injected (will use Codex's shared ai-client.ts).
 * Route wiring is NOT included — each port is pure logic.
 * 
 * Shared utilities:
 *   shared-vectors — k-means clustering, cosine similarity, keyword extraction
 *   (used by topic-evolution, knowledge-gaps, mind-map-generator, sentiment-timeline)
 */

// Shared utilities
export * from './shared-vectors';

// Import plugins
export * from './kindle-importer';
export * from './voice-to-memory';

// Analysis plugins  
export * from './contradiction-finder';
export * from './writing-style';
export * from './topic-evolution';
export * from './sentiment-timeline';
export * from './knowledge-gaps';
export * from './mind-map-generator';

// Action plugins
export * from './blog-draft';
export * from './conversation-prep';
export * from './flashcard-maker';
export * from './learning-paths';
export * from './newsletter-writer';
export * as ResumeBuilder from './resume-builder';

// Export plugins
export * as AnkiExport from './anki-export';

// Import plugins (extended)
export * as YouTubeTranscript from './youtube-transcript';
