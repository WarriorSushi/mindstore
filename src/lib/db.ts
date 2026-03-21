import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

const DB_PATH = process.env.MINDSTORE_DB_PATH || path.join(process.cwd(), 'data', 'mindstore.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- Source documents (obsidian notes, notion pages, chatgpt convos, etc.)
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      source_type TEXT NOT NULL, -- 'obsidian' | 'notion' | 'chatgpt' | 'claude' | 'text' | 'manual'
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}', -- JSON metadata
      file_path TEXT, -- original file path if applicable
      hash TEXT, -- content hash for dedup
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Chunks for semantic search
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      embedding TEXT, -- JSON array of floats (vector)
      position INTEGER DEFAULT 0, -- chunk position in document
      token_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Knowledge entities (people, places, concepts, tools)
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL, -- 'person' | 'place' | 'concept' | 'tool' | 'project' | 'organization'
      description TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Facts / knowledge triples
    CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      subject TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      source_chunk_id TEXT REFERENCES chunks(id) ON DELETE SET NULL,
      source_type TEXT DEFAULT 'inferred', -- 'imported' | 'inferred' | 'stated' | 'learned'
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- User profile (learned preferences, traits, goals)
    CREATE TABLE IF NOT EXISTS profile (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      category TEXT NOT NULL, -- 'preference' | 'trait' | 'goal' | 'knowledge' | 'relationship' | 'habit'
      confidence REAL DEFAULT 1.0,
      source TEXT DEFAULT 'learned', -- 'stated' | 'learned' | 'inferred'
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Chat history (AI learning conversations)
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Import jobs
    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      source_type TEXT NOT NULL,
      file_name TEXT,
      status TEXT DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
      documents_count INTEGER DEFAULT 0,
      chunks_count INTEGER DEFAULT 0,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source_type);
    CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(hash);
    CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_facts_subject ON facts(subject);
    CREATE INDEX IF NOT EXISTS idx_facts_object ON facts(object);
    CREATE INDEX IF NOT EXISTS idx_profile_category ON profile(category);
    CREATE INDEX IF NOT EXISTS idx_profile_key ON profile(key);
    CREATE INDEX IF NOT EXISTS idx_conversations_role ON conversations(role);

    -- Full-text search
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      content,
      content='chunks',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
    END;
    CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
      INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
    END;
  `);
}

// Helper functions
export function createDocument(data: {
  source_type: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  file_path?: string;
  hash?: string;
}) {
  const db = getDb();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO documents (id, source_type, title, content, metadata, file_path, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.source_type, data.title, data.content, JSON.stringify(data.metadata || {}), data.file_path || null, data.hash || null);
  return id;
}

export function createChunk(data: {
  document_id: string;
  content: string;
  embedding?: number[];
  position?: number;
  token_count?: number;
}) {
  const db = getDb();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO chunks (id, document_id, content, embedding, position, token_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.document_id, data.content, data.embedding ? JSON.stringify(data.embedding) : null, data.position || 0, data.token_count || 0);
  return id;
}

export function createFact(data: {
  subject: string;
  predicate: string;
  object: string;
  confidence?: number;
  source_chunk_id?: string;
  source_type?: string;
}) {
  const db = getDb();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO facts (id, subject, predicate, object, confidence, source_chunk_id, source_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.subject, data.predicate, data.object, data.confidence || 1.0, data.source_chunk_id || null, data.source_type || 'inferred');
  return id;
}

export function setProfile(key: string, value: string, category: string, confidence = 1.0, source = 'learned') {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM profile WHERE key = ?').get(key) as { id: string } | undefined;
  if (existing) {
    db.prepare('UPDATE profile SET value = ?, category = ?, confidence = ?, source = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(value, category, confidence, source, existing.id);
    return existing.id;
  }
  const id = randomUUID();
  db.prepare('INSERT INTO profile (id, key, value, category, confidence, source) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, key, value, category, confidence, source);
  return id;
}

export function getProfile(): Record<string, { value: string; category: string; confidence: number }> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value, category, confidence FROM profile ORDER BY category, key').all() as Array<{
    key: string; value: string; category: string; confidence: number;
  }>;
  const result: Record<string, { value: string; category: string; confidence: number }> = {};
  for (const row of rows) {
    result[row.key] = { value: row.value, category: row.category, confidence: row.confidence };
  }
  return result;
}

export function searchChunksFTS(query: string, limit = 20): Array<{ id: string; content: string; document_id: string; rank: number }> {
  const db = getDb();
  return db.prepare(`
    SELECT chunks.id, chunks.content, chunks.document_id, chunks_fts.rank
    FROM chunks_fts
    JOIN chunks ON chunks.rowid = chunks_fts.rowid
    WHERE chunks_fts MATCH ?
    ORDER BY chunks_fts.rank
    LIMIT ?
  `).all(query, limit) as Array<{ id: string; content: string; document_id: string; rank: number }>;
}

export function getStats() {
  const db = getDb();
  const docs = (db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number }).count;
  const chunks = (db.prepare('SELECT COUNT(*) as count FROM chunks').get() as { count: number }).count;
  const facts = (db.prepare('SELECT COUNT(*) as count FROM facts').get() as { count: number }).count;
  const profileItems = (db.prepare('SELECT COUNT(*) as count FROM profile').get() as { count: number }).count;
  const conversations = (db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number }).count;
  const sources = db.prepare('SELECT source_type, COUNT(*) as count FROM documents GROUP BY source_type').all() as Array<{ source_type: string; count: number }>;
  
  return { documents: docs, chunks, facts, profileItems, conversations, sources };
}
