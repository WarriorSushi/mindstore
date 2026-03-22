import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL || 'postgres://mindstore:mindstore123@localhost:5432/mindstore';

async function migrate() {
  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log('Running MindStore database migrations...');

  // Enable extensions
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

  // Create enum
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE content_type AS ENUM ('text', 'image', 'audio', 'video', 'code', 'conversation', 'webpage', 'document');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$
  `);

  // Users table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE,
      name TEXT,
      image TEXT,
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Memories table — the core
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS memories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      content TEXT NOT NULL,
      embedding vector(1536),
      content_type content_type DEFAULT 'text',
      source_type TEXT NOT NULL,
      source_id TEXT,
      source_title TEXT,
      metadata JSONB DEFAULT '{}',
      parent_id UUID,
      tree_path TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      imported_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Tree index (PageIndex-inspired)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tree_index (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      level INT DEFAULT 0,
      parent_id UUID,
      memory_ids UUID[],
      embedding vector(1536),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Profile
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS profile (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      confidence REAL DEFAULT 0.5,
      source TEXT DEFAULT 'manual',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, key)
    )
  `);

  // Facts
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS facts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      fact TEXT NOT NULL,
      category TEXT,
      entities TEXT[],
      learned_at TIMESTAMPTZ DEFAULT NOW(),
      source TEXT DEFAULT 'conversation'
    )
  `);

  // Connections cache
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      memory_a_id UUID REFERENCES memories(id),
      memory_b_id UUID REFERENCES memories(id),
      similarity REAL,
      surprise REAL,
      bridge_concept TEXT,
      discovered_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Contradictions cache
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS contradictions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      memory_a_id UUID REFERENCES memories(id),
      memory_b_id UUID REFERENCES memories(id),
      topic TEXT,
      description TEXT,
      detected_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Media
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS media (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      memory_id UUID REFERENCES memories(id),
      file_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INT,
      metadata JSONB DEFAULT '{}',
      transcript TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // API Keys
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      key TEXT UNIQUE NOT NULL,
      name TEXT,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Indexes for performance
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(user_id, source_type)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_memories_tree ON memories(user_id, tree_path)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(user_id, created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tree_user ON tree_index(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_facts_user ON facts(user_id)`);

  // pgvector index for fast similarity search (IVFFlat)
  // Only create if there are enough rows (IVFFlat needs data)
  const memCount = await db.execute(sql`SELECT COUNT(*)::int as c FROM memories`) as any;
  const mc = (memCount.rows?.[0] as any)?.c || 0;
  if (mc > 100) {
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories 
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    `);
  }

  // Full-text search index
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_memories_fts ON memories 
    USING gin(to_tsvector('english', content))
  `);

  // Trigram index for fuzzy search
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_memories_trgm ON memories 
    USING gin(content gin_trgm_ops)
  `);

  // Create default user
  await db.execute(sql`
    INSERT INTO users (id, email, name) 
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'default@mindstore.local', 'Default User')
    ON CONFLICT (email) DO NOTHING
  `);

  console.log('✅ Migration complete!');
  await client.end();
}

migrate().catch(console.error);
