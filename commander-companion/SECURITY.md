# Security & Trust Model

Commander Companion is a public, owner-funded, AI-backed service. Its security posture protects
three things: **user data**, **the OpenAI/service credentials**, and **the correctness guarantee**
(no injected or hallucinated rules). This document also covers cost/abuse controls and legal
notices, because for a free AI service those are security concerns.

## Secrets & the request boundary

- **The browser never receives the OpenAI API key.** The browser calls the application server;
  only the server calls OpenAI, only through approved scoped endpoints (blueprint §5.2).
- Secrets live only in encrypted server environment variables / a secrets manager. Never in
  browser bundles, logs, screenshots, repository files, or client-visible error messages.
- Secrets are read **only** through `@cc/shared/env` (Zod-validated); reading `process.env`
  elsewhere is blocked by ESLint. `.env` is git-ignored; `.env.example` documents every var.
- **Separate keys/projects** for development, staging, and production. Rotate on exposure and
  follow the incident process below.
- CI runs a **secret scan** (gitleaks) and blocks on findings.

## Request security (blueprint §10.2)

- Zod schema validation on every endpoint; strict input length and output-token caps.
- Authentication + authorization on every user resource; Row-Level Security as defense in depth.
- Per-user and per-IP rate limits; CSRF protection where applicable.
- Strict upload size/type limits; **CSV formula-injection protection** on export.
- Parameterized queries only (Prisma / parameterized raw SQL) — no string-built SQL.
- Content Security Policy and secure headers (baseline in `next.config.mjs`, hardened in
  Phase 1 — **CC-SEC-001**).
- Audit logging **without** storing unnecessary question content.

## AI-specific defenses (prompt injection) (blueprint §11.2)

- Retrieved card/rule text **and** user text are treated as **untrusted data, not instructions**.
- The production model has **no** general web, shell, arbitrary-database, or code-execution tool.
  Tools are narrowly scoped, schema-constrained, and authorization-checked server-side.
- **The model cannot select a source version** — the server fixes the active version.
- Every returned citation is validated against active snapshots before it reaches the user;
  unsupported citations are rejected.
- Requests to reveal system prompts, keys, hidden configuration, or other users' data are ignored.

## Privacy (blueprint §10.3)

- A clear privacy notice will explain account data, questions, collection data, telemetry, and
  third-party AI processing (published before beta — **CC-BETA-002**).
- Users can delete their decks, collection, account, and saved conversations.
- Raw prompt retention is minimized; identifiers are hashed and metrics aggregated where
  possible. `ai_requests` stores a hashed actor, token/cost, and source versions — not question
  text by default.
- Collection CSVs / full personal collections are **not** sent to OpenAI unless a feature
  explicitly requires it and the user is informed.

## Cost & abuse controls (blueprint §10.4)

The service is free to users but AI requests cost the operator money. Before any public
exposure: anonymous + account **daily quotas**, **model routing** (economical by default),
**version-keyed caching**, **token caps**, provider **budget alerts**, and an application-level
**daily/monthly kill switch**. **Graceful fallback:** card search and deterministic validation
continue when AI quota is exhausted. Thresholds are set from **measured** usage at current
pricing, not assumptions.

## Legal & trademark notice

Commander Companion is **unofficial Fan Content** and is not affiliated with, endorsed, or
sponsored by Wizards of the Coast. It is **not** a substitute for an official judge or published
policy. _Magic: The Gathering_, _Commander_, and related names, card text, symbols, and images
are property of Wizards of the Coast LLC. The MIT `LICENSE` covers **the source code only** and
grants no rights to Wizards IP or third-party datasets (e.g. Scryfall), each governed by its own
terms. Fan Content Policy, trademark, image-use, and donation-wording compliance are validated
in Phase 0 before public launch (see `ARCHITECTURE.md` §8).

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for an exploitable
vulnerability. Use GitHub's **private vulnerability reporting** (Security → *Report a
vulnerability*) on this repository, or contact the maintainer listed there. Include reproduction
steps and impact. We aim to acknowledge within a few business days and will coordinate
disclosure after a fix is available. A dedicated security contact will be published before
public launch.
