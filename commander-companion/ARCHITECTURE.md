# Architecture

This document is the system design of record. It also captures the **lead-engineer review**
requested before implementation: recommended improvements, risks, scaling and cost concerns,
and legal considerations — plus every place this project **intentionally reconciles** the
product blueprint with engineering best practice. Nothing here deviates from the blueprint
silently; each deviation is called out and, where material, recorded as an ADR.

## 1. Design goals (in priority order)

1. **Correctness over creativity.** A wrong-but-confident answer is the worst outcome.
2. **Traceability.** Every factual claim resolves to a versioned source record.
3. **Determinism where it counts.** Legality, counting, and identity are code, not prompts.
4. **Operability.** Sources can be updated or rolled back; AI can be disabled without losing
   the card/deck platform; cost has hard ceilings.
5. **Maintainability & scalability** for a solo/small team using incremental, testable work.

## 2. High-level architecture

```
Browser (Next.js client)
   │  calls own server only — never OpenAI, never the DB directly
   ▼
Application API (Next.js route handlers / server actions)
   ├─ input validation (Zod)         ├─ authn/authz + rate limits + quotas
   ├─ tool orchestration             └─ caching, streaming, audit logging
   ▼                     ▼                    ▼                    ▼
Card service        Rules service        Deck service        AI orchestration (@cc/ai)
(@cc/mtg + DB)      (DB + pgvector)      (@cc/deck-validator) (server-only OpenAI)
   └──────────────┬──────────────────────────┬────────────────────┘
                  ▼                            ▼
          PostgreSQL (Supabase)        Ingestion workers (scripts/)
          Oracle/printings/rules/       Scryfall · Rules TXT · Rulings ·
          rulings/policy/embeddings     Commander policy → staging → promote
```

**Request boundary (non-negotiable, blueprint §5.2):** the browser calls the application
server; only the server calls OpenAI, only through approved scoped endpoints. The OpenAI key
never enters a client bundle.

## 3. Monorepo & package boundaries

pnpm workspaces. Packages are split by **stability and dependency direction**:

| Package | Responsibility | May depend on |
| --- | --- | --- |
| `@cc/shared` | env validation, cross-cutting types, `Result` | (nothing) |
| `@cc/mtg` | pure MTG primitives (color identity, name normalization) | `shared` |
| `@cc/database` | Prisma schema + single client, data access | `shared` |
| `@cc/deck-validator` | deterministic Commander rules engine | `mtg`, `shared` |
| `@cc/ai` | server-only OpenAI orchestration + response contract | `shared` |
| `@cc/ui` | shared React components (shadcn/ui) | (react peer) |
| `apps/web` | Next.js UI + server API | all of the above |

`@cc/deck-validator` and `@cc/mtg` must never import `@cc/ai` — determinism is enforced by
dependency direction, not convention.

### Reconciliation with blueprint §5.3 repository layout

The blueprint suggests `card-data`, `mtg-rules`, and `collection-import` packages; the build
instructions (STEP 3) instead specify `mtg`, `deck-validator`, `ai`, `database`, `shared`,
`ui`. **We follow STEP 3** and note the differences:

- **`card-data` + `mtg-rules` → folded into `@cc/mtg` (primitives) + `@cc/database`
  (persistence) + `scripts/` (ingestion).** Card/rule *data* lives in the database; the pure
  domain logic lives in `@cc/mtg`. This avoids a package whose only job is to wrap the DB.
- **`collection-import`** is **not created yet** — collections are Phase 8. It will be added as
  `@cc/collection-import` when that phase starts, matching the blueprint. Creating it empty now
  would be dead code. _(Deviation is additive and deferred, not a rejection — see ADR-0002.)_
- **`@cc/ui`** is added (STEP 3) though the blueprint folds UI into `apps/web`. A shared UI
  package pays off once Storybook/visual tests arrive; until then it stays thin.

## 4. Data flow: the rules-question pipeline (blueprint §3.1, §7)

1. **Entity extraction** — identify referenced card names, zones, and the requested outcome.
2. **Card resolution** — exact/fuzzy match by normalized name/Oracle ID; **ambiguity is
   confirmed with the user before any AI call** (no guessing).
3. **Evidence retrieval** — Oracle text, faces, rulings, Commander policy, and relevant rules
   via **hybrid retrieval** (rule-number lookup + full-text/BM25 + semantic vector), reranked,
   with parent/child rule context. Evidence is **compact and token-budgeted**.
4. **Deterministic facts** — computed by code (`@cc/deck-validator`, `@cc/mtg`), not the model.
5. **Model call** — server-only OpenAI Responses API with **narrowly scoped tools** that query
   the DB, and a **strict structured output** (`@cc/ai` `RulesAnswer`).
6. **Server validation** — every rule number/Oracle ID/policy key must exist in the active
   snapshot and match stored text; unsupported citations cause rejection + one retry.
7. **Render** — direct answer first, then expandable evidence and source-version metadata.

The model is an **explainer over validated evidence**, never an authority on facts.

## 5. Retrieval & AI design

- **Controlled tool model:** no general web/shell/DB access in production. Tools are schema-
  constrained and authorization-checked server-side. The **server fixes the active source
  version** — the model cannot choose it.
- **Structured contract:** `packages/ai/src/response-contract.ts` (Zod) is the single source of
  the answer schema and the system prompt policy, so both are versioned and covered by evals.
- **Caching:** version-keyed cache for normalized questions + evidence, invalidated when a
  controlling source is promoted.
- **Model routing:** an economical model for normal questions; escalate to a stronger model
  only on a small, measured complex-question route (cost control, §8).
- **Evaluation:** ≥250 curated golden questions before public launch; evals run after any
  prompt/model/retrieval/parser/source change. Targets: ≥98% correct direct outcome, 100%
  citation identifiers valid.

## 6. Ingestion & source versioning (blueprint §6)

Every gameplay source is a versioned `source_documents` row with checksum and status
(`staged` → `active` → `superseded`). Pipelines **download → verify → stage → normalize →
integrity-check → change-report → atomically promote → invalidate affected caches/embeddings.**
Historical snapshots are retained so old answers remain explainable and rollback is instant.
Commander policy changes are **manually reviewed** before promotion; parser failure **blocks**
publication.

## 7. Key technical decisions & reconciliations

### 7.1 Prisma + pgvector (ADR-0003)

Prisma has **no native `vector` type**. We model embedding columns as `Unsupported("vector")`
so rows are tracked, add the real `vector(N)` column + ANN index via a **raw SQL migration**,
and run vector similarity through **raw SQL** (`prisma.$queryRaw`). This keeps Prisma as the
schema source of truth for the relational 95% while giving pgvector full power for retrieval.
_Alternative considered:_ Drizzle (better raw-SQL/pgvector ergonomics). Prisma was kept per
STEP 2; the tradeoff is documented rather than silently swapped.

### 7.2 Supabase + Prisma: one migration source of truth (ADR-0004)

Both can own schema. **Prisma owns table/column DDL**; **Supabase provides Postgres, Auth,
and storage**. **Row-Level Security and extensions are managed by SQL migrations**, because
Prisma does not model RLS. Auth uses Supabase; `auth.uid()` binds RLS policies for per-user
isolation (defense in depth behind app-level authz).

### 7.3 OpenAI Responses API, server-only (ADR-0005)

All model access is in `@cc/ai`, imported only by server code. Model IDs, pricing, and exact
Responses API features (tool calling, structured outputs, embeddings vs hosted file search) are
**placeholders to finalize in Phase 0 research** — the blueprint explicitly requires
revalidating current pricing/behavior before committing. `.env.example` ships placeholder model
names to force a conscious choice.

### 7.4 Branch strategy under the current repository

The blueprint/STEP 1 call for `main` + `develop` in a standalone `commander-companion` repo.
This work currently lives in a subdirectory of the `Portfolio` repository on a dedicated
feature branch. The `main`/`develop` model and CI triggers (see `.github/workflows/ci.yml`)
are written for the standalone repo and apply once the project is extracted. See
[open decisions](#11-open-decisions-owner-input-needed).

## 8. Risks, scaling & cost (lead-engineer review)

### Principal risks (blueprint §18.1) and how the architecture mitigates them

| Risk | Mitigation in this design |
| --- | --- |
| Hallucinated rule/citation | Controlled tools, strict schema, **server-side citation validation**, golden tests, transparent uncertainty |
| Stale rules/policy | Versioned ingestion, source-age UI, change detection, activation gates, instant rollback |
| Unexpected API cost | Quotas, model routing, version-keyed caching, token caps, spend alerts + kill switch |
| Trademark / fan-content violation | Conservative branding, prominent disclaimers, code-only license, Phase 0 legal review |
| Scryfall dependency/misuse | Bulk files (not live per-query), caching, respectful UA/rate limits, local active snapshot |
| CSV matching errors | Preview + printing identifiers + ambiguity queue + reversible imports |
| Prompt injection / data exposure | Untrusted-data handling, narrow tools, server authz, minimal retention |
| Scope creep (never launching) | Hard phase gates: rules companion + validator **before** collections/AI deck builder |

### Scaling concerns

- **Read-heavy card/rules search.** Postgres with proper indexes (trigram, GIN full-text, HNSW
  vector — blueprint Appendix B) scales well for MVP. Add read replicas / a search cache before
  it becomes a bottleneck; measure p95 against realistic volume before optimizing.
- **Embeddings cost/latency** grow with the rules corpus. Embed **only changed/new chunks**;
  store model + version metadata; add the vector index only after measuring corpus size.
- **Ingestion is bursty, not hot-path.** Runs as scripts/workers writing to staging; it must
  never block user requests.
- **Serverless connection limits** (Vercel + Postgres) — use the pooled `DATABASE_URL` for the
  app and `DIRECT_URL` for migrations; a Prisma singleton avoids dev connection storms.

### API cost concerns (the biggest operational threat to a free service)

AI requests are owner-paid. Controls (must exist **before** any public exposure):
anonymous/account **daily quotas**, **model routing** (cheap by default), **version-keyed
caching** of common questions, **token caps** on question/evidence/output/history, provider
**budget alerts** + application **daily/monthly kill switch**, and **graceful degradation**
(card search + deterministic validation keep working when AI quota is exhausted). Exact
thresholds must come from **measured** token usage at current pricing, not assumptions.

### Legal considerations (not legal advice)

- **Unofficial** framing is mandatory and visible everywhere; never imply affiliation or that
  the tool replaces a judge/official policy.
- **Wizards Fan Content Policy** and trademark/logo/card-image rules must be reviewed in
  Phase 0; **donation wording** must not imply official status or guaranteed service.
- **Scryfall terms**: bulk data usage, attribution, image use, caching, and rate limits must be
  confirmed and honored (descriptive User-Agent already wired via env).
- **OpenAI**: privacy/retention/data-processing terms reviewed; user collection CSVs are **not**
  sent to OpenAI unless a feature explicitly requires it and the user is informed.
- The MIT license covers **code only** — see `LICENSE` and `SECURITY.md`.

## 9. Environments (blueprint §5.4)

- **Local:** seeded fixtures, mocked OpenAI by default, optional dev key.
- **Preview/Staging:** isolated DB, restricted spend, test accounts, non-prod source snapshots.
- **Production:** separate keys, least-privilege credentials, backups, monitoring, deploy
  approvals for DB migrations and source-schema changes.

## 10. Testing strategy

Unit (parsers, normalization, color identity, singleton, exception rules, CSV adapters,
citation validators) · Integration (DB queries, source promotion, OpenAI tool flow, authz,
quotas, cache invalidation) · Golden rules tests · Deck fixtures · E2E · Security · Accessibility
· Performance. Deterministic packages run with **no network/OpenAI**. See `ROADMAP.md` gates.

## 11. Open decisions (owner input needed)

These block later phases and must not be guessed (blueprint §18.2). Tracked in `docs/BACKLOG.md`
milestone **M0**:

1. Standalone `commander-companion` repo vs. subdirectory of `Portfolio` (affects branch model,
   CI, and issue tracking).
2. Anonymous use vs. mandatory accounts; daily free limits and donor benefits.
3. Initial OpenAI model(s) + escalation policy (after Phase 0 pricing/quality tests).
4. Hosted OpenAI file search vs. self-managed pgvector retrieval.
5. Whether card images appear in the MVP (pending image-use/attribution review).
6. Whether bracket/Game Changer analysis is informational or a core validator output.
7. Prices and which specific CSV exporters to support.
8. How much conversation history to store, if any.
9. Who reviews reported incorrect rulings and source updates.

Recommended defaults (blueprint §18.3) are adopted unless overridden: PWA-first; self-managed
hybrid retrieval; anonymous-limited + optional accounts; no prices in MVP; card images only
after policy review; collections after the rules/deck MVP is stable; one economical model with a
small measured complex route.
