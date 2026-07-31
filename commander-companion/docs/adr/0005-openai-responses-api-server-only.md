# ADR-0005: OpenAI Responses API, server-only, with citation validation

- **Status:** Accepted
- **Date:** 2026-07-31
- **Deciders:** Lead engineer

## Context

The product's value depends on grounded, citable answers. STEP 2 specifies the OpenAI Responses
API. The blueprint forbids the browser ever touching the key and forbids the model inventing any
fact. Current model IDs, pricing, and exact Responses API features must be revalidated (Phase 0)
before being committed to.

## Decision

All OpenAI access lives in `@cc/ai`, imported only by server code, behind a testable interface.
The model receives **narrowly scoped tools** that query the app DB and must return the strict
`RulesAnswer` structured output. The **server validates every citation** against active
snapshots (one controlled retry, then a transparent verification error) and **fixes the active
source version** — the model cannot choose it. Model IDs and the economical/complex routing are
environment-configured placeholders until Phase 0 pricing/quality tests finalize them.

## Consequences

- Hallucinated citations cannot reach users; the key cannot leak to the client.
- Evals must run after any prompt/model/retrieval/source change (blueprint §7.6).
- Exact API surface may shift after Phase 0 research; the interface isolates that churn.

## Alternatives considered

- **Client-side calls / exposed key:** unacceptable (security boundary §5.2).
- **Free-form model output parsed loosely:** rejected; structured output + schema validation is
  the whole point.
- **Hosted file search vs. self-managed pgvector retrieval:** open Phase-0 decision (§18.2);
  default is self-managed hybrid retrieval for version control and visibility.
