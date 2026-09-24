# Accounts: anonymous → permanent

Every player starts playing immediately with no sign-up. Later they can attach an email so their progress survives a lost phone and follows them to other devices. This page is the architecture. The code is in `packages/core/src/account.ts`, `app/src/progress/{backend,remoteBackend,localBackend}.ts`, `app/src/components/AccountCard.tsx` (Profile tab), and `e2e/remote.mjs` (the tested flow).

## The one idea: same user, more identity

A new install signs in **anonymously** (`signInAnonymously`). That creates a real `auth.users` row, and all progress (`xp_events`, `user_level_progress`, review state and so on) is keyed to that user id from the first tap.

"Saving progress" **adds an email to that same user** (`updateUser({ email })`, confirmed with a one-time code). The user id never changes. So there's:

- **no data migration**, no copy step, nothing that can half-fail;
- no change to any server function, RLS policy or ledger rule;
- exactly-once XP, first attempts and canonical completions stay intact by construction.

The e2e test asserts this directly: after linking there's still one user, with the same id and the same XP total.

## States

| State | Meaning | What the Profile card offers |
|---|---|---|
| `device_only` | Offline build (no Supabase config). Progress is in on-device storage. | Nothing: "saved on this device" |
| `guest` | Anonymous server account. Progress is on the server but reachable only from this install's session. | **Save my progress** (add email); **I already have an account** (sign in) |
| `linking` | A code was sent to `pendingEmail` (e.g. the app was closed mid-flow). | Enter the code, or send a new one |
| `saved` | Permanent account with a confirmed email. | Sign out |

`accountFromUser()` derives the state from the Supabase user (`is_anonymous`, `email`, `new_email`). There's no extra table and no second source of truth.

## Flows

All flows use **email one-time codes**, not magic links. There are no deep links, redirect handling or universal links to get wrong, and it works the same on iOS, Android and web.

1. **Save my progress (guest → saved).** `startEmailLink(email)` → `auth.updateUser({ email })` emails a code. Then `confirmEmailLink(email, code)` → `auth.verifyOtp({ type: 'email_change' })`. The same user is now permanent.
2. **Sign in on another device.** `startSignIn(email)` → `auth.signInWithOtp({ shouldCreateUser: false })`. It never creates accounts, so a typo can't make a stray one. Then `confirmSignIn(email, code)` → `verifyOtp({ type: 'email' })`. The device switches to that user. In-progress level sessions (local, keyed to the old user) are dropped, and the snapshot is reloaded from the server.
3. **Email already in use.** If a guest tries to save to an email that already has an account, Supabase returns `email_exists`, and the card switches to sign-in with a clear message. If the guest has cleared any levels, they're warned first that **this device's guest progress won't be added** to that account.
4. **Sign out (saved only).** It signs out and continues as a fresh guest. Guests can't sign out, because that would orphan their progress. `NOT_ALLOWED` enforces this in the backend, not just the UI.

Errors map from Supabase Auth codes to stable `AccountErrorCode`s (`EMAIL_IN_USE`, `INVALID_CODE`, `NO_ACCOUNT`, `RATE_LIMITED`, …), each with calm player-facing copy in `ACCOUNT_ERROR_TEXT`.

## Security

- The app only ever holds the anon/publishable key. It refuses to start with a secret key (`checkClientConfig`), and `npm run supabase:check` fails on one.
- The server still owns every award. Linking changes identity, never progress.
- One-time codes are Supabase's, with its rate limits (`config.toml` `[auth.rate_limit]`). The client validates the email and code shape only to catch typos.
- In-progress sessions are dropped on account switch, so answers recorded under one user can't be submitted under another. The server would reject them anyway, because first attempts are per user.

## Configuring the real project (no code changes)

1. **Authentication → Providers:** Anonymous sign-ins **on**, Email **on** (see `docs/supabase-setup.md`). `npm run supabase:check` verifies both.
2. **Email templates must include the code.** Edit **Change Email Address** and **Magic Link** to show `{{ .Token }}` (e.g. "Your BrainScroll code: {{ .Token }}"). The default templates only contain a link. This is the one step the checker can't verify.
3. **Custom SMTP before real users.** Supabase's built-in mailer is heavily rate-limited and meant for testing. Set up SMTP under **Project Settings → Authentication → SMTP**.
4. Locally, `supabase start` runs Inbucket at http://localhost:54324 to read the emails.

## Tested

- `packages/core/test/account.test.ts`: state mapping (same id through linking), email/code checks, error mapping.
- `e2e/remote.mjs` (real app, real SQL via `backend/tests/fake-supabase.mjs`):
  - guest shown
  - code requested for the normalised email
  - wrong code refused
  - linking keeps the same id and all XP
  - survives reload
  - sign-out gives a fresh guest
  - email-in-use points to sign-in
  - sign-in restores the saved account's progress
- `e2e/local.mjs`: offline builds show device-only saving and no account actions.

## Open product decisions

These don't block anything above.

1. **Merging guest progress into an existing account.** Today it isn't merged: the player is warned and chooses. A merge is possible later with a server function that proves ownership of both users (a one-time merge ticket issued to the guest session), and it could reuse the ledger's idempotency keys to keep XP exactly-once. But it needs rules for conflicting progress, e.g. both accounts cleared different levels on the same day. Recommendation: keep "no merge" for MVP, since most people link before they have a second device.
2. **Abandoned guest accounts.** Anonymous users who never return accumulate. Suggested policy: delete anonymous users with no activity for 90 days (a scheduled SQL job). It needs a decision on the window.
3. **Account deletion: built.** Profile → **Delete account** → one confirmation → `delete_my_account()` removes the auth user, and every learner table cascades through `profiles`. That covers progress, attempts, review, XP, allowances, entitlement rows, reports and analytics. The app then starts over as a fresh guest at onboarding. It warns that store subscriptions must be cancelled in the store. Offline builds offer **Erase my progress** instead. Tested in `account-deletion.test.sql` and both e2e suites.
4. **Apple/Google sign-in** (held by instruction). It slots in via `linkIdentity()` on the same user (enable `enable_manual_linking` in `config.toml`), with no change to progress.
5. **Usernames** are needed for friends (post-MVP, see `social-expansion.md`), not for saving progress.
