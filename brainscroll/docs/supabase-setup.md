# Supabase setup (staging)

The schema, server functions and importer are built and tested against local Postgres (`npm run test:db`). To move the app from local-only progress to real accounts, a Supabase project has to exist. These steps are one-time.

## Quick connect checklist

Everything on the code side is ready. Connecting a project is configuration only:

1. Create the project. Enable **Anonymous sign-ins** and the **Email** provider, and add `brainscroll://auth-callback` to the redirect URLs (§1).
2. `cd backend && supabase link --project-ref <ref> && supabase db push` (§2). `backend/supabase/config.toml` is committed, so there's no `supabase init`.
3. `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run content:import -- --publish-drafts` (§3, staging only).
4. `cp app/.env.example app/.env.local` and fill in the URL and the **anon/publishable** key (§4).
5. `npm run supabase:check`. It checks the keys (and refuses a secret key in the app), then probes the project read-only: auth reachable, anonymous sign-ins on, email provider on, migrations applied through the latest one, content published, server functions present.

For account linking, also put `{{ .Token }}` in the **Change Email Address** and **Magic Link** email templates, and set up custom SMTP before real users (see [`accounts.md`](accounts.md)).

Until step 4, the app keeps playing offline, and `npm run e2e:remote` keeps exercising the Supabase mode against the local stand-in.

## 1. Create the project

1. Create a project at [supabase.com](https://supabase.com) (e.g. `brainscroll-staging`).
2. Under **Authentication → Sign In / Providers**, enable **Anonymous sign-ins** and **Email**. New players start without an account and can link an email later without losing progress (see [`accounts.md`](accounts.md)). Under **Authentication → URL Configuration**, set the site URL to `brainscroll://` and add `brainscroll://auth-callback` (plus `http://localhost:8081/auth-callback` for web dev) to the redirect URLs. `backend/supabase/config.toml` mirrors these settings for the local stack.
3. Note the **Project URL**, the **anon / publishable key** (`eyJ…` legacy anon JWT or `sb_publishable_…`), and the **service_role / secret key** (`sb_secret_…`). The secret key is only for the importer: never commit it and never ship it in the app. The app refuses to start if it's given one, and `npm run supabase:check` fails.

## 2. Apply the migrations

Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
cd brainscroll/backend   # config.toml is committed; no `supabase init` needed
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

Copy `brainscroll/app/.env.example` to `brainscroll/app/.env.local` (it's gitignored) and fill it in:

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

The anon key is safe to ship. Row Level Security limits each player to their own progress, and all progress writes go through the server functions.

Then run `npm run supabase:check`. With those two variables set, the app signs players in anonymously and uses the server for everything. Without them, it plays offline on-device. The switch is in `app/src/progress/ProgressProvider.tsx`.

The Supabase mode is already covered end to end: `npm run e2e:remote` runs the real app against the real migrations and content through `backend/tests/fake-supabase.mjs`, a small stand-in for Supabase Auth and RPC endpoints. It isn't a substitute for a smoke test on the real project once it exists.

## What the app calls

| When | RPC |
| --- | --- |
| Opening a level | `start_level(level_id)` returns eligibility plus the published bundle |
| Finishing a level | `complete_level(level_id, revision, answers, idempotency_key)` returns the authoritative summary |
| Home / Daily Complete | `get_daily_status()` |
| Review tab | `get_review_queue(limit)`, then `get_level_bundles(ids)`, then `submit_review(question_id, option_id)` per answer |
| App start | `update_profile(timezone)` and `get_progress()` |
