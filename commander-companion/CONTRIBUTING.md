# Contributing

Thanks for helping build Commander Companion. This project prioritizes **correctness over
creativity**: an answer that sounds right but isn't is the worst outcome. Read
[`CLAUDE.md`](./CLAUDE.md) (engineering rules) before your first change — it applies to human
and AI contributors alike.

## Prerequisites

- Node 22+, pnpm 10+
- PostgreSQL 15+ with `vector` and `pg_trgm` (Supabase provides these)

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm dev
```

## Workflow

1. **Pick one issue.** Work is organized as small, testable tasks with explicit acceptance
   criteria (`docs/BACKLOG.md`, GitHub issues). Don't bundle unrelated work.
2. **Branch** from `develop`: `feat/CC-XXX-short-description` (or `fix/…`, `docs/…`).
3. **Implement + test together.** Every parser, rules check, and ingestion step needs positive,
   negative, and boundary tests. Deterministic packages must not depend on OpenAI.
4. **Run the gates locally** (also enforced in CI):
   ```bash
   pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
   ```
5. **Open a PR into `develop`** and fill in the Definition of Done template.

> **Branching model.** The standalone project uses `main` (protected, release) and `develop`
> (integration); feature branches target `develop`. While this code lives in a subdirectory of
> the `Portfolio` repository, contributions go to the active feature branch — see the repo's
> current branch guidance and `ARCHITECTURE.md` §7.4.

## Commit style — Conventional Commits

`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` (optionally scoped, e.g.
`feat(deck-validator): …`). One logical change per commit; reference the issue (`(#123)`).

## Code standards (blueprint §16, STEP 9)

- Strict TypeScript; runtime validation (Zod) at trust boundaries.
- Every public function has a doc comment. Small modules; composition over inheritance; no
  duplication.
- Wrap external clients (OpenAI, Scryfall, DB) behind testable interfaces.
- **No `TODO` without a tracked issue** — reference the backlog ID in the comment.
- No new dependency or migration without documenting why (PR body or an ADR in `docs/adr/`).
- Never hardcode gameplay data (legality, bans, rules text) — it comes from ingested sources.

## Definition of Done (every PR)

- [ ] Acceptance criteria satisfied
- [ ] Tests added and passing
- [ ] Type check and lint passing
- [ ] No secret or personal data introduced
- [ ] Errors handled and user-safe
- [ ] Documentation/migrations updated
- [ ] No unrelated refactor
- [ ] Changed files and residual risks summarized

## Proposing architecture changes

If a change conflicts with the blueprint or a prior decision, **explain the tradeoff and get
agreement first** — never deviate silently. Record accepted decisions as an ADR in
[`docs/adr/`](./docs/adr/) using `docs/adr/0000-template.md`.

## Reporting issues

Use the issue template. For **security** vulnerabilities, follow `SECURITY.md` (private
reporting) instead of opening a public issue.

By contributing you agree your contributions are licensed under the project's [MIT
License](./LICENSE).
