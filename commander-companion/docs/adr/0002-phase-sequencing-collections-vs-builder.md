# ADR-0002: Phase sequencing — collections vs. deck builder

- **Status:** Accepted
- **Date:** 2026-07-31
- **Deciders:** Lead engineer

## Context

The build-instruction order (STEP 8) lists the **deck builder (Phase 6) before the collection
CSV importer (Phase 7)**. The blueprint (§9.1, §13) ships **collections (Phase 8) before the
full deck builder (Phase 9)** and repeatedly warns that scope creep is the top risk to ever
launching. The full builder's headline feature — "collection-only mode" — depends on reliable
collection data.

## Decision

Follow the blueprint's data-before-builder sequencing: deterministic **rules companion and deck
validator first**, then **collections**, then the **full visual deck builder**, then AI deck
assistance. A minimal "paste a deck list → validate → export" flow ships with the validator
(Phase 5); the rich builder waits.

## Consequences

- The dependency (builder needs collection data) is respected; no rework.
- This is a deviation from STEP 8 ordering, surfaced to the owner rather than applied silently.
- `@cc/collection-import` is created when collections start, not before.

## Alternatives considered

- **Strict STEP 8 order:** would build a full builder before the data it filters on exists,
  risking throwaway work and contradicting the blueprint's anti-scope-creep guidance.
