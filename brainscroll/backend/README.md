# backend/

This is Supabase: Postgres, Auth, Storage and Edge Functions.

```
supabase/migrations/   SQL migrations (schema, RLS, server functions)
tests/                 SQL acceptance tests + runner using plain Postgres with Supabase auth stubs
```

## Server functions (call via `supabase.rpc`)

| Function | Purpose |
| --- | --- |
| `start_level(level_id)` | Checks eligibility (sequence, daily cap) and returns `{ allowed, reason, revision, bundle }`. `reason` is one of `NEW`, `REPLAY`, `LEVEL_LOCKED`, `DAILY_COMPLETE` or `LEVEL_NOT_AVAILABLE`. |
| `complete_level(level_id, revision, answers, idempotency_key)` | Runs as one transaction and is exactly-once per canonical level. It grades answers server-side and returns the authoritative summary the app animates. |
| `get_daily_status()` | Returns `{ used, cap, remaining, daily_complete, unlimited, local_date }`. |
| `get_review_queue(limit)` | Returns due concepts, each with one question from a level you've cleared. Questions rotate. |
| `submit_review(question_id, option_id)` | Reschedules the due concepts that question tests, and awards `DELAYED_RECALL` for a correct answer after 20 h or more. It never touches skill level or the daily allowance. |
| `import_content(payload, publish_drafts)` | **Service role only.** Upserts curriculum and publishes immutable level revisions. Raises `REVISION_CONFLICT` or `REVISION_REGRESSION`. |

Clients can **read** published content and their own progress (RLS). They **can't write** progress, XP, allowances or entitlements. Those change only through the functions above, or through the service role for the importer, admin and RevenueCat webhooks.

## Testing

```bash
npm run test:db     # from brainscroll/: temp Postgres → stubs → migrations → each *.test.sql in its own database
```

## Deploying

See [`../docs/supabase-setup.md`](../docs/supabase-setup.md).

## Local Supabase stack (optional)

With Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development):

```bash
cd backend
supabase init        # once; creates supabase/config.toml and keeps migrations/
supabase start
supabase db reset    # applies migrations
```
