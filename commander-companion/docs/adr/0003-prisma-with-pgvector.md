# ADR-0003: Prisma with pgvector

- **Status:** Accepted
- **Date:** 2026-07-31
- **Deciders:** Lead engineer

## Context

STEP 2 mandates Prisma and pgvector. Prisma has **no native `vector` column type** and cannot
express ANN indexes or vector operators, but it is excellent for the relational 95% of the
schema and for migrations under source control.

## Decision

Keep Prisma as the schema source of truth. Model embedding columns as `Unsupported("vector")`
so rows are tracked. Add the real `vector(N)` column and HNSW index via a **hand-written SQL
migration**, with `N` matching the chosen embedding model. Run similarity queries through
`prisma.$queryRaw` using the `<=>` cosine operator. Generate embeddings only for changed/new
chunks and store the embedding model + version.

## Consequences

- Full pgvector capability without losing Prisma's ergonomics or migration history.
- Vector query code is raw SQL and must be tested against a real Postgres in integration tests.
- The embedding dimension is a Phase-0 decision; the migration literal is finalized then
  (backlog CC-DB-002).

## Alternatives considered

- **Drizzle ORM:** first-class raw SQL and better pgvector ergonomics, but STEP 2 specifies
  Prisma. Tradeoff documented rather than silently swapping the stack.
- **Separate vector store (e.g. a dedicated service):** adds a moving part and a second source
  of truth; unnecessary at MVP corpus size and worse for version-keyed invalidation.
