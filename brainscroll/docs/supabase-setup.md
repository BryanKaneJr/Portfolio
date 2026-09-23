# Supabase setup (staging)

The schema, server functions and importer are built and tested against local Postgres (`npm run test:db`). To move the app from local-only progress to real accounts, a Supabase project has to exist. These steps are one-time.

## 1. Create the project

1. Create a project at [supabase.com](https://supabase.com) (e.g. `brainscroll-staging`).
2. Under **Authentication → Sign In / Providers**, enable **Anonymous sign-ins**. New players start without an account and can link email or Apple/Google later, without losing progress.
3. Note the **Project URL**, the **anon (public) key**, and the **service_role key**. The service_role key is a secret: never commit it and never ship it in the app.

## 2. Apply the migrations

Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
cd brainscroll/backend
supabase init            # once; keeps the existing supabase/migrations
supabase link --project-ref <your-project-ref>
supabase db push         # applies supabase/migrations/*.sql
```

## 3. Publish the curriculum

```bash
cd brainscroll
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service key> \
  npm run content:import -- --publish-drafts
```

`--publish-drafts` is for **staging only**: it publishes the Golden 10 while their sources are still unverified. On production, run it without the flag. Only levels marked `published` go live there.

Re-running the import is safe. To correct a published level, edit it, bump its `revision`, and import again.

## 4. Point the app at it

Create `brainscroll/app/.env.local` (it's gitignored):

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

The anon key is safe to ship. Row Level Security limits each player to their own progress, and all progress writes go through the server functions.

## What the app calls

| When | RPC |
| --- | --- |
| Opening a level | `start_level(level_id)` returns eligibility plus the published bundle |
| Finishing a level | `complete_level(level_id, revision, answers, idempotency_key)` returns the authoritative summary |
| Home / Daily Complete | `get_daily_status()` |
| Review tab | `get_review_queue(limit)` then `submit_review(question_id, option_id)` per answer |
