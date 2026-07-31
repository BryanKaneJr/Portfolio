# ADR-0001: Monorepo and package boundaries

- **Status:** Accepted
- **Date:** 2026-07-31
- **Deciders:** Lead engineer

## Context

The blueprint (§5.3) suggests one package split; the build instructions (STEP 3) specify a
different one (`ai`, `database`, `mtg`, `deck-validator`, `shared`, `ui`). We must pick one and
keep deterministic logic isolated from the AI layer.

## Decision

Use a pnpm-workspace monorepo with the STEP 3 package set. Enforce dependency direction so
`@cc/mtg` and `@cc/deck-validator` never import `@cc/ai`. Card/rule **data** lives in
`@cc/database`; pure domain logic in `@cc/mtg`; ingestion in `scripts/`.

## Consequences

- Determinism is guaranteed structurally (a deck check cannot import the model client).
- `collection-import` (blueprint) is deferred to Phase 8 rather than created empty (ADR-0002).
- Slightly more wiring than a single app, justified by testability and clear ownership.

## Alternatives considered

- **Single Next.js app, no packages:** faster to start, but mixes deterministic and AI code and
  makes "no OpenAI in deck logic" a convention instead of a compile-time guarantee.
- **Blueprint's `card-data`/`mtg-rules` split:** a `card-data` package would mostly re-wrap the
  database; folded into `@cc/database` + `@cc/mtg` instead.
