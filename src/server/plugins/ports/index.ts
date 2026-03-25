/**
 * Plugin Ports — Shared logic extracted from route files.
 *
 * Each port module contains the pure business logic for a plugin,
 * free of HTTP/NextRequest concerns. Routes become thin adapters.
 *
 * See: docs/build/plugin-porting-guide.md
 */

export * as kindleImporter from './kindle-importer';
export * as contradictionFinder from './contradiction-finder';
