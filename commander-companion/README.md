# Commander Companion

**An unofficial, citation-first Magic: The Gathering Commander rules and deck companion.**

> ⚠️ **Unofficial Fan Content.** Commander Companion is not produced, endorsed, supported,
> or affiliated with Wizards of the Coast. It is **not** a substitute for an official judge
> or published tournament policy. _Magic: The Gathering_ and _Commander_ are trademarks of
> Wizards of the Coast LLC.

Commander Companion answers Commander rules and card-interaction questions using **current,
verifiable sources** — the Comprehensive Rules, Oracle card text, official rulings, and
Commander policy — and returns a plain-English answer with **exact citations**.

It is deliberately **not** a generic chatbot. It is a controlled retrieval and rules
platform: the language model explains and synthesizes evidence, while ordinary application
code performs every deterministic task — exact search, legality checks, deck counting,
color-identity validation, and data import.

## Core principle

> The assistant must not merely sound knowledgeable. Every rules conclusion must be traceable
> to current source records, and deterministic facts must be **calculated by code** rather than
> guessed by a language model.

The AI never invents card text, card names, rule numbers, legality, rulings, or source
versions. Every factual claim is validated server-side against active source snapshots before
it reaches the user. If evidence is insufficient, the app says so.

## Feature overview

| Area | What it does |
| --- | --- |
| **Rules companion** | Natural-language Commander questions → grounded answer + citations + assumptions |
| **Card platform** | Structured search over current Oracle data; card pages separating Oracle identity from printings |
| **Rules platform** | Versioned, searchable Comprehensive Rules with exact + semantic retrieval |
| **Deck validator** | Deterministic Commander legality checks with source-backed findings |
| **Collections & builder** _(later)_ | CSV import, owned-card filtering, deck construction |

## Tech stack

Next.js · TypeScript (strict) · Tailwind CSS · shadcn/ui · Node.js · Supabase · PostgreSQL ·
Prisma · pgvector · OpenAI Responses API (server-only) · Zod · React Query · ESLint · Prettier ·
Vitest.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design and the rationale behind each
choice (including where this project intentionally reconciles the product blueprint with
engineering best practice).

## Repository layout

```
commander-companion/
├── apps/web/                 # Next.js app (UI + server API routes; only the server calls OpenAI)
├── packages/
│   ├── shared/               # env validation (Zod), cross-cutting types, Result
│   ├── database/             # Prisma schema + client (single source of persistence)
│   ├── mtg/                  # pure MTG primitives (color identity, name normalization)
│   ├── deck-validator/       # deterministic Commander rules engine (no OpenAI)
│   ├── ai/                   # server-only OpenAI orchestration + structured contract
│   └── ui/                   # shared React components (shadcn/ui)
├── scripts/                  # ingestion: Scryfall, rules, rulings, Commander policy
├── docs/                     # ADRs, backlog/milestones, deep-dive docs
├── tests/                    # cross-package fixtures & suites
└── .github/workflows/        # CI
```

## Getting started

> **Status:** Phase 1 foundation. The app shell, schema, tooling, and docs are in place;
> ingestion, search, RAG, and the validator are implemented in later phases (see
> [`ROADMAP.md`](./ROADMAP.md)).

```bash
# From the commander-companion/ directory
pnpm install
cp .env.example .env          # fill in values; NEVER commit .env
pnpm db:generate              # generate the Prisma client
pnpm dev                      # start the web app

pnpm typecheck && pnpm lint && pnpm test   # what CI runs
```

Prerequisites: Node 22+, pnpm 10+, and a PostgreSQL 15+ database with the `vector` and
`pg_trgm` extensions available (Supabase provides these). See [`DATABASE.md`](./DATABASE.md).

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — engineering rules for humans and AI contributors
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design, decisions, risks, scaling & cost
- [`DATABASE.md`](./DATABASE.md) — data model, ingestion, versioning, RLS, pgvector
- [`API.md`](./API.md) — API surface and contracts
- [`ROADMAP.md`](./ROADMAP.md) — phased delivery plan and exit gates
- [`SECURITY.md`](./SECURITY.md) — security model, secrets, abuse & cost controls, disclosure
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — workflow, standards, Definition of Done
- [`docs/BACKLOG.md`](./docs/BACKLOG.md) — epics, issues, milestones, complexity, dependencies
- [`docs/adr/`](./docs/adr/) — Architecture Decision Records

## License

Source code is [MIT licensed](./LICENSE). This license covers **the code only** — not Wizards
of the Coast intellectual property or third-party datasets (e.g. Scryfall), each governed by
its own terms. See [`SECURITY.md`](./SECURITY.md) and [`LICENSE`](./LICENSE).
