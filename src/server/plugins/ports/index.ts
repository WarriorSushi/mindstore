/**
 * Plugin Ports — Portable logic modules for convergence with codex runtime
 * 
 * Each port extracts the core business logic from a plugin's route file,
 * making it framework-agnostic and ready for Codex's SDK/runtime.
 * 
 * AI calling is injected (will use Codex's shared ai-client.ts).
 * Route wiring is NOT included — each port is pure logic.
 */

export * from './kindle-importer';
export * from './voice-to-memory';
export * from './contradiction-finder';
export * from './blog-draft';
export * from './conversation-prep';
export * from './writing-style';
export * from './newsletter-writer';
