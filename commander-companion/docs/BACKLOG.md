# Backlog — Epics, Issues, Milestones

This is the authoritative, trackable breakdown of the blueprint into work items. It is written
so it can be turned into GitHub Issues + Milestones directly (each row → one issue; each `M#` →
one milestone). Until the tracking repository is confirmed (see **M0 / open decision #1**),
this file is the source of truth.

**Complexity:** `S` ≈ ≤½ day · `M` ≈ 1–2 days · `L` ≈ 3–5 days · `XL` ≈ >1 week or high risk.
**Legend:** 🔗 dependency · ❓ unknown to resolve · 🧪 test-heavy · ⚠️ security/cost-sensitive.

> Deviations from the build-instruction ordering are intentional and recorded in
> `docs/adr/0002-*`. Nothing here silently departs from the blueprint.

---

## Milestone M0 — Phase 0: Research & Decisions ⚠️❓

_Exit gate: no unresolved blocker to public availability. Most of this is research + owner
sign-off, not code. Several downstream milestones are blocked until specific M0 items resolve._

| ID | Title | Cx | Deps / Notes |
| --- | --- | --- | --- |
| CC-RES-001 | Canonical source matrix (URLs, owner, cadence, licensing, ingestion method) | M | ❓ authoritative Commander policy owner/pages |
| CC-RES-002 | Legal/trademark/Fan-Content/donation review; disclaimers wording | L | ⚠️ gates public launch, card images, donations |
| CC-RES-003 | Confirm Scryfall API/bulk/rulings/images terms, attribution, rate limits | M | 🔗 CC-CARD-* |
| CC-RES-004 | OpenAI model strategy: current pricing, structured outputs, retention, limits | L | ❓🔗 CC-AI-*, embedding dimension |
| CC-RES-005 | Decide Supabase vs. other Postgres/auth; confirm pgvector availability | S | 🔗 CC-AUTH-* |
| CC-RES-006 | Decide anonymous vs. accounts, quotas, donor benefits | S | ❓ owner decision #2 |
| CC-RES-007 | Define supported Commander policy features for MVP (bans/brackets/Game Changers) | M | ❓🔗 CC-CARD-005 |
| CC-RES-008 | Choose tracking repo & branch model (standalone vs. subdirectory) | S | ❓ owner decision #1 |
| CC-RES-009 | Write ADRs for all M0 decisions; initial budget & risk register | M | 🔗 all |

---

## Milestone M1 — Phase 1: Foundation _(in progress)_

_Exit gate: preview deploy passes smoke + security basics._

### Epic CC-FND — Repo, tooling, CI

| ID | Title | Cx | Status |
| --- | --- | --- | --- |
| CC-FND-001 | Monorepo scaffold, pnpm workspaces, strict TS, package boundaries | M | ✅ done |
| CC-FND-002 | ESLint (flat) + Prettier + `no process.env` rule | S | ✅ done |
| CC-FND-003 | Vitest config + first deterministic tests (`@cc/mtg` color identity) | S | ✅ done |
| CC-FND-004 | Documentation set (README, CLAUDE, ARCH, DB, API, ROADMAP, SECURITY, CONTRIBUTING, ADRs) | L | ✅ done |
| CC-FND-005 | CI workflow (typecheck, lint, format, test, secret scan) | M | ✅ done |
| CC-FND-006 | Generate `pnpm-lock.yaml`, verify install + typecheck + test green in CI | M | 🔗 CC-FND-001 |
| CC-FND-007 | Issue/PR templates + Definition of Done | S | ✅ done |

### Epic CC-DB — Database foundation

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-DB-001 | Prisma schema for core entities (§6.1) | L | ✅ done |
| CC-DB-002 | Generate baseline Prisma migration; finalize pgvector dimension + indexes | M | 🔗 CC-RES-004 |
| CC-DB-003 | Extensions migration (vector, pg_trgm, uuid-ossp) applied in CI test DB | S | 🔗 CC-DB-002 |
| CC-DB-004 | Seed/fixture dataset that works fully offline | M | 🧪🔗 CC-DB-002 |

### Epic CC-AUTH — Authentication & environments

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-AUTH-001 | Env validation module + `.env.example` completeness | S | ✅ done |
| CC-AUTH-002 | Supabase project wiring (local/staging/prod separation) | M | 🔗 CC-RES-005 |
| CC-AUTH-003 | Enable RLS policies on user-owned tables; isolation tests | M | 🧪⚠️🔗 CC-AUTH-002 |
| CC-AUTH-004 | Anonymous session/device identity (privacy-conscious) | M | 🔗 CC-RES-006 |

### Epic CC-SHELL — App shell & accessibility

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-SHELL-001 | Next.js shell, layout, navigation, error pages | M | ✅ scaffolded |
| CC-SHELL-002 | shadcn/ui + Tailwind theme/design tokens | M | 🔗 CC-SHELL-001 |
| CC-SHELL-003 | Accessibility baseline (semantic headings, focus order, contrast, labels) | M | 🧪 |
| CC-SEC-001 | Security headers + CSP hardening | M | ⚠️ |
| CC-SHELL-004 | Health/readiness endpoints + preview smoke tests | S | ✅ health done |

---

## Milestone M2 — Phase 2: Card Platform 🧪

_Exit gate: integrity tests pass; updates are repeatable._

### Epic CC-CARD — Ingestion & normalization

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-CARD-001 | Scryfall bulk downloader (UA, retries, checksum, staging) | L | 🔗 CC-RES-003, CC-DB-002 |
| CC-CARD-002 | Normalize layouts/faces/identifiers/images; schema-change detection | L | 🔗 CC-CARD-001 |
| CC-CARD-003 | Layout fixtures: normal, split, MDFC, transform, adventure, meld, prototype | M | 🧪🔗 CC-CARD-002 |
| CC-CARD-004 | Rulings importer (source + precedence per research) | M | ❓🔗 CC-RES-003 |
| CC-CARD-005 | Commander policy sync (normalized snapshot; manual-review gate) | L | ❓⚠️🔗 CC-RES-007 |
| CC-CARD-006 | Atomic promotion + active-version pointer + cache/embedding invalidation | M | 🔗 CC-CARD-002 |
| CC-CARD-007 | Integrity checks (unique IDs, face relationships, legalities present) | M | 🧪🔗 CC-CARD-002 |

### Epic CC-SEARCH — Search & card pages

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-SEARCH-001 | Indexes: trigram, GIN full-text, array/JSON filters | M | 🔗 CC-DB-002 |
| CC-SEARCH-002 | `GET /api/cards/search` structured filters + pagination | L | 🔗 CC-SEARCH-001 |
| CC-SEARCH-003 | Card search UI (React Query) | M | 🔗 CC-SEARCH-002 |
| CC-SEARCH-004 | `GET /api/cards/:oracleId` + card detail UI (Oracle vs printing) | L | 🔗 CC-CARD-002 |
| CC-SEARCH-005 | `GET /api/sources/status` + source-status page | M | 🔗 CC-CARD-006 |

---

## Milestone M3 — Phase 3: Rules Platform 🧪❓

_Exit gate: parser regression + source-activation rollback pass._

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-RULES-001 | Comprehensive Rules TXT downloader + preserve original | M | 🔗 CC-RES-001 |
| CC-RULES-002 | Parser: numbered rules, subrules, glossary, headings, effective date | XL | 🧪❓ format stability |
| CC-RULES-003 | Version diff (add/edit/move/remove) + historical validity | L | 🔗 CC-RULES-002 |
| CC-RULES-004 | Exact rule lookup + full-text search | M | 🔗 CC-RULES-002 |
| CC-RULES-005 | Embeddings for changed/new chunks + hybrid retrieval | L | ⚠️🔗 CC-RES-004, CC-DB-002 |
| CC-RULES-006 | Rerank + parent/child context assembly | M | 🔗 CC-RULES-005 |
| CC-RULES-007 | Internal retrieval-inspection page | S | 🔗 CC-RULES-006 |
| CC-RULES-008 | Parser + retrieval evaluation tests | L | 🧪🔗 CC-RULES-002 |
| CC-RULES-009 | Atomic activation + rollback for rules snapshots | M | ⚠️🔗 CC-RULES-003 |

---

## Milestone M4 — Phase 4: Rules Companion MVP ⚠️🧪

_Exit gate: golden set + invalid-citation tests meet targets (≥98% correct, 100% valid citations)._

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-AI-001 | Server-only OpenAI client + model config behind interface | M | 🔗 CC-RES-004 |
| CC-AI-002 | Scoped tools + JSON schemas (search_cards, get_rules, validate_deck, …) | L | 🔗 M2, M3, M5 |
| CC-AI-003 | Card entity recognition + ambiguity handling (no AI call on unresolved) | L | 🔗 CC-SEARCH-002 |
| CC-AI-004 | Evidence assembly with token budget | M | 🔗 CC-RULES-006 |
| CC-AI-005 | Structured response contract + streaming parse | M | ✅ contract scaffolded |
| CC-AI-006 | Server-side citation validation (+ one controlled retry) | L | 🧪⚠️🔗 CC-AI-005 |
| CC-AI-007 | Confidence + needs-more-information behavior | M | 🔗 CC-AI-006 |
| CC-AI-008 | Answer modes (new player / standard / technical / table ruling) + source expanders | M | 🔗 CC-AI-006 |
| CC-AI-009 | Version-keyed cache, quotas, spend controls, AI-disabled fallback | L | ⚠️🔗 CC-AI-001 |
| CC-AI-010 | Golden evaluation set (≥250) + red-team prompt-injection tests | XL | 🧪⚠️🔗 CC-AI-006 |

---

## Milestone M5 — Phase 5: Deck Validator 🧪

_Exit gate: deck fixture suite passes. Zero OpenAI dependency._

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-DECK-001 | Deck-list parser (common text formats, quantities) | L | 🔗 CC-SEARCH-002 |
| CC-DECK-002 | Commander designation + ambiguous-name resolution | M | 🔗 CC-DECK-001 |
| CC-DECK-003 | Deck/commander count + singleton (+ basic-land exceptions) | M | 🧪 |
| CC-DECK-004 | Commander eligibility + multiple-commander pairing rules | M | 🧪 |
| CC-DECK-005 | Color-identity inclusion check | S | 🧪 ✅ primitive in `@cc/mtg` |
| CC-DECK-006 | Current legality + bans from active snapshot | M | 🔗 CC-CARD-005 |
| CC-DECK-007 | Versioned deck-construction-exceptions model | M | 🔗 CC-DB-001 |
| CC-DECK-008 | Bracket / Game Changer indicators (informational vs. output — owner decision #6) | M | ❓🔗 CC-RES-007 |
| CC-DECK-009 | Source-backed findings (error/warning/info/unresolved) + exports (txt/CSV) | M | ⚠️ CSV formula-injection safe |
| CC-DECK-010 | Comprehensive fixture suite (legal/illegal/partner/exception/banned/layout) | L | 🧪🔗 all CC-DECK |

---

## Milestone M6 — Phase 6: Private Beta ⚠️

_Exit gate: cost and quality stable during limited use._

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-BETA-001 | Feedback (thumbs + category) + `POST /api/feedback` | M | 🔗 CC-AI-006 |
| CC-BETA-002 | Privacy, terms, unofficial disclaimer, contact, source-status pages | M | ⚠️🔗 CC-RES-002 |
| CC-BETA-003 | Analytics/observability (usage, tokens/cost, cache hit, quota denials) | M | ⚠️ |
| CC-BETA-004 | Donation flow (no user payment details in app) | M | ⚠️🔗 CC-RES-002 |
| CC-BETA-005 | Admin tools: source promote/rollback, quota/flags, AI kill switch, failed-question review | L | ⚠️ |
| CC-BETA-006 | Measure cost per answer; tune quotas + model routing | M | ⚠️🔗 CC-AI-009 |

---

## Milestone M7 — Phase 7: Public MVP ⚠️

_Exit gate: launch checklist complete._

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-LAUNCH-001 | Production hardening (secrets, least-privilege, deploy approvals) | L | ⚠️ |
| CC-LAUNCH-002 | Backups + tested restore; source rollback rehearsal | M | ⚠️🔗 CC-RULES-009 |
| CC-LAUNCH-003 | Security review + dependency scan | M | ⚠️ |
| CC-LAUNCH-004 | Accessibility + mobile QA for primary flows | M | 🧪 |
| CC-LAUNCH-005 | Status page, onboarding, support & correction workflow | M | |
| CC-LAUNCH-006 | Incident/rollback runbook; legal/branding final review | M | ⚠️🔗 CC-RES-002 |

---

## Milestone M8 — Phase 8: Collections 🧪

_Exit gate: importer accuracy + data-isolation tests pass._

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-COL-001 | `@cc/collection-import` package + generic CSV column mapper | L | 🔗 CC-CARD-002 |
| CC-COL-002 | Client-side parse (no raw CSV to OpenAI) + strict size/type limits | M | ⚠️ |
| CC-COL-003 | Printing-level matching (set+collector#) with Oracle fallback | L | 🧪🔗 CC-CARD-002 |
| CC-COL-004 | Preview: matched/ambiguous/rejected rows + resolution queue | L | 🧪 |
| CC-COL-005 | `import/preview` + `import/commit` (transactional, provenance, reversible) | L | ⚠️🔗 CC-AUTH-003 |
| CC-COL-006 | Known-source adapters (ManaBox, Moxfield where permitted) | M | ❓🔗 CC-RES-003 |
| CC-COL-007 | Ownership search/filter + delete/export controls | M | ⚠️🔗 CC-AUTH-003 |

---

## Milestone M9 — Phase 9: Full Deck Builder

_Exit gate: usability & performance targets pass._

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-BUILD-001 | Saved deck editor (add/remove, commander select) | L | 🔗 CC-DECK-009 |
| CC-BUILD-002 | Statistics: mana curve, type distribution, color sources | M | |
| CC-BUILD-003 | Collection-only mode (filter to owned cards) | M | 🔗 CC-COL-007 |
| CC-BUILD-004 | Versioned validation snapshots per deck | M | 🔗 CC-DECK-006 |
| CC-BUILD-005 | Deterministic recommendation primitives (before any AI) | L | 🧪 |

---

## Milestone M10 — Phase 10: AI Deck Assistance ⚠️🧪

_Exit gate: no unvalidated cards; evaluation targets pass._

| ID | Title | Cx | Deps |
| --- | --- | --- | --- |
| CC-DECKAI-001 | Constraint wizard (collect constraints) | M | 🔗 CC-BUILD-001 |
| CC-DECKAI-002 | Category plan → structured candidate retrieval | L | 🔗 CC-SEARCH-002 |
| CC-DECKAI-003 | Candidate scoring + draft assembly | L | |
| CC-DECKAI-004 | Deterministic validation + composition loop (no unvalidated cards) | L | 🧪🔗 CC-DECK-010 |
| CC-DECKAI-005 | Model explains/revises within validated candidates only | M | ⚠️🔗 CC-AI-006 |
| CC-DECKAI-006 | Evaluate for legality, constraint adherence, diversity, usefulness | L | 🧪 |

---

## Cross-cutting unknowns to resolve (tracked, not guessed)

1. **Authoritative Commander policy owner & canonical pages** — how bans/brackets/Game Changers
   are published and detected (CC-RES-001/007).
2. **Rules TXT format stability** — parser robustness across releases (CC-RULES-002).
3. **Embedding model & dimension** — fixes the pgvector column + index (CC-RES-004 → CC-DB-002).
4. **Hosted file search vs. self-managed pgvector** (owner decision #4).
5. **Scryfall image/attribution/caching terms** — gates card images in MVP (CC-RES-003, #5).
6. **OpenAI pricing/retention at build time** — drives quotas, routing, budgets (CC-RES-004).
7. **Fan-Content/trademark/donation constraints** — gate public launch (CC-RES-002).
8. **Tracking repository & branch model** (owner decision #1).

## Turning this into GitHub Issues

Once the tracking repository is confirmed, each row becomes an issue (title = `ID: Title`,
milestone = `M#`, labels from complexity/flags) and each `M#` becomes a milestone with the exit
gate as its description. This can be automated from this file; ask the maintainer before bulk-
creating issues so the target repository isn't flooded unintentionally.
