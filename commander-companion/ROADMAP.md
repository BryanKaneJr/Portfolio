# Roadmap

Phased delivery with **hard exit gates** (blueprint §13). Each phase is a gated deliverable;
later features do not start until the current phase meets its gate. Timelines are sequencing,
not promises. Detailed, trackable work items live in [`docs/BACKLOG.md`](./docs/BACKLOG.md).

The numbered "Implementation Order" from the build instructions maps onto the blueprint phases
as shown below.

| Phase | Outcome | Primary deliverables | Exit gate |
| --- | --- | --- | --- |
| **0 — Research & decisions** | Validated legal/source/stack/cost assumptions | Research report, source matrix, ADRs, risk register, initial budget | No unresolved blocker to public availability |
| **1 — Foundation** _(in progress)_ | Deployable secure app shell | Monorepo, CI, auth decision, Postgres schema, env separation, UI skeleton, docs | Preview deploy passes smoke + security basics |
| **2 — Card platform** | Current searchable card DB | Scryfall + rulings + Commander-legality importers, schemas, search, card pages, source status | Integrity tests pass; updates repeatable |
| **3 — Rules platform** | Versioned searchable rules | Rules parser, diffing, hybrid retrieval, embeddings, citation endpoints | Parser regression + activation rollback pass |
| **4 — Rules companion MVP** | Grounded AI answers | Tool orchestration, structured output, **citation validation**, answer UI, caching, quotas | Golden set + invalid-citation tests meet targets |
| **5 — Deck validator** | Reliable Commander legality | Parser, commander selection, deterministic engine, exceptions model, exports, deck UI | Deck fixture suite passes |
| **6 — Private beta** | Real users + controls | Feedback, analytics, privacy pages, donation flow, monitoring, admin tools | Cost & quality stable under limited use |
| **7 — Public MVP** | Public free companion | Production hardening, onboarding, status page, support process | Launch checklist complete |
| **8 — Collections** | CSV-based owned cards | Adapters, preview/resolution, privacy/delete, collection search | Importer accuracy + data-isolation tests pass |
| **9 — Full deck builder** | Visual saved decks | Builder UI, statistics, collection filter, versioned validation | Usability & performance targets pass |
| **10 — AI deck assistance** | Validated recommendations | Constraint wizard, candidate retrieval, planner, validator loop, explanations | No unvalidated cards; eval targets pass |

## Mapping to the requested implementation order

- **Phase 1 (setup, database, auth, CI/CD, documentation)** → Blueprint Phase 1.
- **Phase 2 (Scryfall / rules / Commander-legality importers)** → Blueprint Phases 2–3.
- **Phase 3 (search, card pages, rule pages)** → Blueprint Phases 2–3 UI.
- **Phase 4 (OpenAI integration, RAG, citations)** → Blueprint Phase 4.
- **Phase 5 (deck validator)** → Blueprint Phase 5.
- **Phase 6 (deck builder)** → Blueprint Phase 9.
- **Phase 7 (collection CSV importer)** → Blueprint Phase 8.
- **Phase 8 (AI deck recommendations)** → Blueprint Phase 10.
- **Phase 9 (accounts, saved decks/conversations)** → interleaved with Blueprint Phases 6–8.
- **Phase 10 (beta polish, testing, performance, deployment)** → Blueprint Phases 6–7 & 10.

> Note: the build-instruction order places the **deck builder before the collection importer**,
> while the blueprint ships collections (Phase 8) before the full builder (Phase 9). Both agree
> the **rules companion and deterministic validator come first**. We follow the blueprint's
> data-before-builder sequencing where they differ, because the builder's collection-only mode
> depends on reliable collection data — recorded in ADR-0002.

## Launch acceptance targets (blueprint §11.3)

- ≥ **98%** correct direct outcome on the golden evaluation set.
- **100%** citation identifiers valid against active snapshots.
- No known critical deck-legality defects in supported rules.
- Card-search p95 under target at realistic volume.
- No cross-user data access in security tests.
- Quota + spending kill switch tested in staging.
- Source-update rollback tested.
- Accessibility pass for primary flows.

## Current status

Phase 1 foundation: repository scaffold, workspace tooling (strict TS, ESLint, Prettier,
Vitest), Prisma schema + extension/RLS migration scaffold, env validation, CI, and full
documentation are in place. **Blocked on the Phase 0 owner decisions** in
[`ARCHITECTURE.md` §11](./ARCHITECTURE.md#11-open-decisions-owner-input-needed) before feature
implementation begins.
