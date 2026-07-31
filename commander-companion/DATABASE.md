# Database

PostgreSQL (Supabase in the default deployment). Prisma is the schema source of truth for
relational structure; capabilities Prisma cannot express (extensions, `vector` columns/indexes,
Row-Level Security) are managed by hand-written SQL migrations. Schema:
[`packages/database/prisma/schema.prisma`](./packages/database/prisma/schema.prisma).

## Principles

- **Oracle identity vs printing identity are distinct.** `oracle_cards.oracle_id` is how a card
  functions now; `printings.scryfall_id` is one physical printing. Never key gameplay data on
  card name.
- **Everything gameplay-related is source-backed and versioned.** Rules, legalities, rulings,
  and Commander policy reference a `source_documents` row with a checksum and a status
  (`staged` → `active` → `superseded`). Historical rows are never deleted.
- **Ingestion is staged then atomically promoted.** The active dataset is never overwritten in
  place; promotion flips status and updates an active-version pointer.
- **User-owned data is isolated** by application authorization and, defensively, by RLS.

## Core entities (blueprint §6.1)

| Table | Purpose | Key columns |
| --- | --- | --- |
| `source_documents` | Provenance for every gameplay source | `type`, `version`, `status`, `checksum`, `effective_date`, `retrieved_at` |
| `rules` | Comprehensive Rules entries, hierarchical, version-scoped | `rule_number`, `parent_rule`, `valid_from/to`, `source_document_id` |
| `rule_embeddings` | pgvector embeddings for rules | `embedding vector(N)`, `embedding_model`, `generated_at` |
| `oracle_cards` | Oracle identity | `oracle_id`, `normalized_name`, `layout`, `color_identity[]`, `keywords[]` |
| `card_faces` | Faces of multi-part cards | `(oracle_id, face_index)` |
| `printings` | Physical printings | `scryfall_id`, `set_code`, `collector_number`, `image_uris` |
| `card_legalities` | Format legality snapshots | `(oracle_id, format, source_document_id)` |
| `card_rulings` | Official rulings | `oracle_id`, `published_at`, `source_document_id` |
| `commander_policy` | Normalized policy (bans/brackets/Game Changers) | `(key, source_document_id)` |
| `deck_construction_exceptions` | Versioned per-card exceptions (§8.2) | `oracle_id`, `behavior`, `effective_from/to` |
| `users`, `decks`, `deck_cards` | Accounts and saved decks | owner-scoped |
| `collections`, `collection_items` | Owned-card data (Phase 8) | owner-scoped, printing-aware |
| `ai_requests` | Aggregate AI metering | `actor_hash`, tokens, `cost_usd`, `cache_status` |

## Indexing strategy (blueprint Appendix B)

- Unique: `oracle_id`, `scryfall_id`, and `(rule_number, source_document_id)`.
- **Trigram** (`pg_trgm`) on `oracle_cards.normalized_name` for fuzzy name search.
- **GIN full-text** on Oracle text, type line, and rules/glossary text.
- **GIN** on array/JSON columns (color identity, keywords, legalities) where queried.
- **HNSW** vector index on `rule_embeddings.embedding` — added **only after** measuring corpus
  size and retrieval quality; always store the embedding model + version.
- Composite indexes on `(collection owner, oracle/printing)` and `(deck, card)`.

## pgvector (ADR-0003)

Prisma has no native `vector` type. The workflow:

1. Model the column as `Unsupported("vector")` in `schema.prisma` (row is tracked, not usable
   by the query builder).
2. A raw SQL migration adds `vector(N)` with the dimension matching `OPENAI_EMBEDDING_MODEL`
   and creates the ANN index.
3. Similarity queries run through `prisma.$queryRaw` with the `<=>` cosine operator.

Baseline scaffolding lives in
[`prisma/migrations/0001_extensions_and_rls/migration.sql`](./packages/database/prisma/migrations/0001_extensions_and_rls/migration.sql).
The concrete dimension and indexes are finalized once the embedding model is chosen (Phase 0)
and the Prisma baseline migration exists (backlog **CC-DB-002**).

## Row-Level Security

Prisma does not manage RLS, so it is applied via SQL migration and enabled once auth wiring
lands (**CC-AUTH-003**). Policies bind `owner_id = auth.uid()` on `decks`, `deck_cards`,
`collections`, and `collection_items`. RLS is **defense in depth** — the application still
performs its own authorization on every user resource.

## Migrations & environments

- App connects via the **pooled** `DATABASE_URL`; migrations use the **direct** `DIRECT_URL`.
- Migrations are under source control and validated in CI against a disposable database.
- Production DB migrations and any source-schema change **require approval** (blueprint §12.1).
- Backups are automated with periodically **tested restores**; a new rules/card snapshot is
  never activated without retaining the prior known-good snapshot.

## Local setup

```bash
cp .env.example .env       # set DATABASE_URL / DIRECT_URL
pnpm db:generate           # generate the Prisma client
pnpm db:migrate            # apply migrations (dev)
```

Supabase local development provides `vector`, `pg_trgm`, and `uuid-ossp`. On other Postgres,
ensure those extensions are installable.
