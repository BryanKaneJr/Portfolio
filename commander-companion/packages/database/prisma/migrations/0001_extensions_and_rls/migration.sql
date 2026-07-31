-- Manual migration: capabilities Prisma cannot express natively.
-- Applied alongside Prisma-generated migrations. See docs/DATABASE.md + ADR-0003.
-- This file is illustrative scaffolding; the concrete DDL is finalized once the
-- Prisma-generated baseline migration exists (backlog: CC-DB-002).

-- 1. Required Postgres extensions -------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector: embeddings
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- trigram fuzzy card-name search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- uuid_generate_v4()

-- 2. Embedding column + ANN index -------------------------------------------
-- Dimension MUST match OPENAI_EMBEDDING_MODEL (e.g. 1536 for text-embedding-3-small).
-- Adjust the literal below when the model is finalized in Phase 0.
-- ALTER TABLE rule_embeddings ALTER COLUMN embedding TYPE vector(1536);
-- CREATE INDEX rule_embeddings_ann
--   ON rule_embeddings USING hnsw (embedding vector_cosine_ops);

-- 3. Trigram + full-text indexes (blueprint Appendix B) ---------------------
-- CREATE INDEX oracle_cards_name_trgm
--   ON oracle_cards USING gin (normalized_name gin_trgm_ops);
-- CREATE INDEX oracle_cards_text_fts
--   ON oracle_cards USING gin (to_tsvector('english', coalesce(oracle_text, '')));

-- 4. Row-Level Security on user-owned data ----------------------------------
-- Prisma does not manage RLS; it is enforced here so per-user isolation holds
-- even for direct DB access (blueprint §10.2). Policies bind to the Supabase
-- JWT subject via auth.uid(). Enable once auth wiring lands (backlog: CC-AUTH-003).
-- ALTER TABLE decks            ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE deck_cards       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE collections      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY decks_owner ON decks
--   USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
