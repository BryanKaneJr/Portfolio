# backend/

This is Supabase: Postgres, Auth, Storage and Edge Functions.

```
supabase/config.toml   Supabase CLI config (local stack + link); auth settings mirror the hosted project
supabase/migrations/   SQL migrations (schema, RLS, server functions)
tests/                 SQL acceptance tests, runner and shared helpers (lib.sh) using plain Postgres
                       with Supabase auth stubs; fake-supabase.mjs is a test-only stand-in for
                       Supabase Auth + RPC used by `npm run e2e:remote`
```

## Server functions (call via `supabase.rpc`)

| Function | Purpose |
| --- | --- |
| `start_level(level_id)` | Checks eligibility (sequence, daily cap) and returns `{ allowed, reason, revision, bundle }`. The bundle is a **learner bundle**, with no `correct`, `rationale` or `explanation`. `reason` is one of `NEW`, `REPLAY`, `LEVEL_LOCKED`, `DAILY_COMPLETE` or `LEVEL_NOT_AVAILABLE`. |
| `answer_question(level_id, question_id, option_id)` | Grades one attempt. The **first** attempt per question is recorded once in `user_question_attempts` and never replaced. Returns `{ correct, resolved, first_attempt_correct, attempt_count, rationale?, explanation? }`. Replays are graded but not recorded. |
| `complete_level(level_id, revision, idempotency_key)` | One transaction, exactly-once per canonical level. It requires every question resolved (`UNRESOLVED_QUESTIONS`), awards `LEVEL_COMPLETE` XP from first-attempt accuracy using the level type's own pool (`level_xp_curve`: regular 100/70/35/15, checkpoint 150/105/60/25, milestone 250/175/90/40, mastery 500/350/175/75), and queues missed concepts with review priority. Level 100·k earns the ★ by being resolved; there is no separate mastery bonus. It returns the authoritative summary the app animates. |
| `get_daily_status()` | Returns `{ used, cap, remaining, daily_complete, unlimited, local_date }`. |
| `get_review_queue(limit)` | Returns uncorrected review items first (same question), then due concepts, each with one question from a level you've cleared. Questions rotate. |
| `submit_review(concept_id, question_id, option_id)` | Records the first attempt at a scheduled review item once per occurrence (`user_review_attempts`). Right → `DELAYED_RECALL` +10 (`app_settings.xp_review_first_attempt`) and strength up. Wrong → 0 XP, strength 0, higher priority, and the item stays open until corrected; corrections earn nothing and the right answer is never returned. Anything not due is graded practice. It never touches skill level or the daily allowance. |
| `get_progress()` | Returns the app's snapshot: skills, completed levels, daily status, XP totals and the number of reviews due. |
| `get_level_bundles(ids)` | Returns the current published bundles, so corrections reach players without an app release. |
| `update_profile(timezone, display_name)` | Profile settings. The time zone defines the local day for the daily cap. |
| `log_events(events)` | Allowlisted, PII-free client events (≤50 per call, ≤500/day). Unknown names and nested props are dropped. See `docs/analytics.md`. |
| `report_content(level_id, revision, object_type, object_id, category, message)` | Files a content report after checking the object belongs to that level revision. A repeat updates the learner's open report; max 20/day. |
| `admin_learning_health(days)`, `admin_question_stats(skill)`, `admin_level_funnel(skill)`, `admin_content_reports(status)`, `admin_set_report_status(id, status)` | **Service role only.** Aggregate learning and product-health insights (never time spent) and report triage, for `npm run insights:pull` and Content Admin. |
| `delete_my_account()` | Permanently deletes the caller: the auth user, and through `on delete cascade` every row of their data. Store subscriptions are cancelled in the store, not here. |
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
supabase start
supabase db reset    # applies migrations
```
