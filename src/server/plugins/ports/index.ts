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
export * from './pocket-importer';
export * from './spotify-importer';
export * from './browser-bookmarks';
export * as RedditSaved from './reddit-saved';

// Analysis plugins  
export * from './contradiction-finder';
export * from './writing-style';
export * from './topic-evolution';
export * from './sentiment-timeline';
export * as KnowledgeGaps from './knowledge-gaps';
export * from './mind-map-generator';

// AI plugins
export * as ImageToMemory from './image-to-memory';

// Action plugins
export * from './blog-draft';
export * from './conversation-prep';
export * from './flashcard-maker';
export * as LearningPaths from './learning-paths';
export * from './newsletter-writer';
export * as ResumeBuilder from './resume-builder';

// Export plugins
export * as AnkiExport from './anki-export';
export * as MarkdownBlogExport from './markdown-blog-export';

// Import plugins (extended)
export * as YouTubeTranscript from './youtube-transcript';
export * as ReadwiseImporter from './readwise-importer';
export * as TelegramImporter from './telegram-importer';
export * as TwitterImporter from './twitter-importer';

// Document parsing
export * as PdfEpubParser from './pdf-epub-parser';
