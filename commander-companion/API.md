# API

All endpoints are served by the Next.js application server (`apps/web`). **Only the server
calls OpenAI**; the browser never does. Every request is schema-validated (Zod), authorized,
rate-limited, and — for AI routes — quota-checked. Responses are user-safe: no secrets, no raw
provider errors, no cross-user data.

> Status: this documents the **planned contract** (blueprint §5.5). Endpoints are implemented
> across their phases (see `ROADMAP.md`); `GET /api/health` exists today.

## Conventions

- **Base path:** `/api`. JSON in/out unless noted. `Content-Type: application/json`.
- **Validation:** invalid input → `400` with a field-level error list (no stack traces).
- **Auth:** user-scoped routes require a session; anonymous routes are rate-limited by
  privacy-conscious IP/device controls.
- **Errors:** `{ "error": { "code": string, "message": string, "details"?: unknown } }`.
- **Rate limits / quotas:** `429` with `Retry-After`. AI routes also enforce daily quotas and a
  global spend kill switch; when AI is disabled, AI routes return `503` with a clear message
  while card/deck routes keep working (graceful degradation).

## Endpoints

### `GET /api/health`
Liveness probe. Returns `{ "status": "ok", "service": "commander-companion-web" }`. No auth,
no dependencies. _(Implemented.)_

### `POST /api/rules/ask` — Phase 4
Grounded Commander rules answer.

- **Body:** `{ question: string, gameState?: {...}, mode?: "new_player"|"standard"|"technical"|"table_ruling" }`
- **Behavior:** resolve card names (confirm ambiguity → `409` with candidates, **no AI call**);
  retrieve evidence; compute deterministic facts; call OpenAI with scoped tools + structured
  output; **validate every citation** server-side; stream a user-safe result.
- **Response:** the `RulesAnswer` contract (`packages/ai/src/response-contract.ts`):
  `answer`, `explanation[]`, `assumptions[]`, `rule_citations[]`, `card_citations[]`,
  `policy_citations[]`, `confidence`, `needs_more_information`, `missing_information[]`,
  `answer_type`, plus active source-version metadata.
- **Failure modes (tested):** ambiguous card, nonexistent citation (reject + one retry),
  quota denial (`429`), OpenAI failure (`502`, safe message), AI disabled (`503`).

### `GET /api/cards/search` — Phase 2
Structured card search (not model-driven).

- **Query:** `q`, `name`, `oracleText`, `typeLine`, `colorIdentity`, `manaValue`, `keyword`,
  `legality`, `set`, `collectorNumber`, `page`, `pageSize`.
- **Response:** paginated Oracle results with printing summaries; deterministic, DB-backed.

### `GET /api/cards/:oracleId` — Phase 2
Full card detail: Oracle identity, faces, printings, legalities, rulings — Oracle identity
shown separately from printing-specific details.

### `POST /api/decks/parse` — Phase 5
Parse a pasted/uploaded deck list. Returns resolved quantities/names, inferred commander(s),
and **unmatched/ambiguous rows** for user resolution. No guessing.

### `POST /api/decks/validate` — Phase 5
Run the deterministic Commander engine (`@cc/deck-validator`). Returns findings with severity
(`error`/`warning`/`information`/`unresolved`), source citations, and the active policy
snapshot version. **No OpenAI involved.**

### `POST /api/collections/import/preview` — Phase 8
Parse a collection CSV **client-side where practical** (raw CSV is not sent to OpenAI). Returns
matched / ambiguous / rejected rows for review.

### `POST /api/collections/import/commit` — Phase 8
Commit normalized items in one transaction with import provenance; reversible.

### `GET /api/sources/status` — Phase 2
Active source versions and freshness: rules publication date, card-data refresh timestamp,
policy snapshot, and ingestion health.

### `POST /api/feedback` — Phase 6
Thumbs up/down plus category feedback on an answer, with minimal content retention.

## Security notes

See `SECURITY.md`. Highlights: tool arguments are schema-constrained and authorization-checked;
the model cannot select a source version (the server fixes it); retrieved text is treated as
untrusted data, not instructions; uploads have strict size/type limits and CSV export is
protected against formula injection.
