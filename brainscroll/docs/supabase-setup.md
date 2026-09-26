# Supabase setup (staging)

The schema, server functions and importer are built and tested against local Postgres (`npm run test:db`). To move the app from the development harness (simulated accounts) to real accounts, a Supabase project has to exist. These steps are one-time.

## Quick connect checklist

Everything on the code side is ready. Connecting a project is configuration only:

1. Create the project. Turn **Anonymous sign-ins off**. Enable **Email** and **Phone**, plus **Apple** and **Google** once their credentials exist. Add `brainscroll://auth-callback` to the redirect URLs (§1).
2. `cd backend && supabase link --project-ref <ref> && supabase db push` (§2). `backend/supabase/config.toml` is committed, so there's no `supabase init`.
3. `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run content:import -- --publish-drafts` (§3, staging only).
4. `cp app/.env.example app/.env.local` and fill in the URL and the **anon/publishable** key (§4).
5. `npm run supabase:check`. It checks the keys (and refuses a secret key in the app), then probes the project read-only:
   - auth is reachable and **anonymous sign-ins are off**;
   - each sign-in method (Apple, Google, phone, email) is on, or reported as not enabled yet;
   - migrations are applied through the latest one, including the accounts-required migration;
   - content is published and the server functions exist.

For the code-based methods, put `{{ .Token }}` in the **Magic Link** and **Confirm signup** email templates. Set up custom SMTP and an SMS provider before real users (see [`accounts.md`](accounts.md)).

Until step 4, the app runs the development harness (the same sign-in → onboarding → learning flow, with simulated accounts), and `npm run e2e:remote` keeps exercising the Supabase mode against the local stand-in. There is no guest mode in either.

## 1. Create the project

1. Create a project at [supabase.com](https://supabase.com) (e.g. `brainscroll-staging`).
2. Under **Authentication → Sign In / Providers**, set up sign-in. Every learner signs in before any progress exists (see [`accounts.md`](accounts.md)).
   - **Anonymous sign-ins: off.** BrainScroll has no guest mode, and the database refuses anonymous users anyway.
   - **Email: on**, with confirmations. Edit the **Magic Link** and **Confirm signup** templates so they show `{{ .Token }}` (e.g. "Your BrainScroll code: {{ .Token }}"). Add custom SMTP before real users.
   - **Phone: on**, with an SMS provider (e.g. Twilio: account SID, message service SID, auth token). Until one is configured, codes can't be sent, and the app still offers phone because the project reports it enabled. So only enable Phone once the provider works.
   - **Apple: on** once you have the credentials. From the Apple Developer account you need:
     - a Services ID (the web client id);
     - a Sign in with Apple key, with its team id and key id, to generate the secret.
     Also add the iOS bundle id `app.brainscroll` to the authorized client ids, so native iOS ID tokens are accepted.
   - **Google: on** once you have the credentials. In Google Cloud, create OAuth clients of type **Web** (its id and secret go in Supabase, and the id is also `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`), **iOS** (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`) and **Android** (package `app.brainscroll` plus the signing SHA-1). Enable **Skip nonce check** so native iOS Google tokens are accepted.

   Under **Authentication → URL Configuration**, set the site URL to `brainscroll://`. Add `brainscroll://auth-callback` and your web origin(s) (e.g. `http://localhost:8081`) to the redirect URLs: web Apple/Google sign-in returns there. `backend/supabase/config.toml` mirrors these settings for the local stack, with the Apple, Google and Twilio sections present but off until credentials exist.
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

For native Google sign-in, also set the public client ids (they aren't secrets):

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios client id>.apps.googleusercontent.com
```

Store builds also set `EXPO_PUBLIC_RELEASE=1`, so a build without Supabase config refuses to start rather than falling back to the development harness.

Then run `npm run supabase:check`. With the Supabase variables set, the app opens on the sign-in screen and uses the server for everything. Without them, it runs the development harness with simulated accounts. The switch is in `app/src/progress/ProgressProvider.tsx`.

The Supabase mode is already covered end to end: `npm run e2e:remote` runs the real app against the real migrations and content through `backend/tests/fake-supabase.mjs`, a small stand-in for Supabase Auth and RPC endpoints. It isn't a substitute for a smoke test on the real project once it exists.

## 5. Subscriptions (when you add Unlimited)

Deploy the two Edge Functions and their secrets, then point RevenueCat's webhook at the first. Steps in [`subscriptions.md`](subscriptions.md).

## What the app calls

| When | RPC |
| --- | --- |
| Opening a level | `start_level(level_id)` returns eligibility plus the published bundle |
| Finishing a level | `complete_level(level_id, revision, answers, idempotency_key)` returns the authoritative summary |
| Home / Daily Complete | `get_daily_status()` |
| Review tab | `get_review_queue(limit)`, then `get_level_bundles(ids)`, then `submit_review(question_id, option_id)` per answer |
| After sign-in | `update_profile(timezone)` and `get_progress()` |
| Profile → Delete account | `delete_my_account()` |
