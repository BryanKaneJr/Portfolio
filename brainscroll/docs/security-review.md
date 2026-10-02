# Security review (2026-09-26)

A review of the database (RLS, `security definer` functions, grants), the Edge Functions, and the app's trust boundaries (answer keys, purchases, sign-in). Each finding was reproduced against a temp database with every migration applied before it was fixed. Fixes are in migration `20261004000000_security_hardening.sql`, `app/metro.config.js` and the Edge Functions, with tests in `backend/tests/security.test.sql`, `packages/core/test/review.test.ts` and `scripts/test/revenuecat.test.ts`.

## Fixed

| Severity | Finding | Fix |
| --- | --- | --- |
| High | Every app build contained every question's correct answer, so a learner could read them out and answer perfectly. The server strips answers from what it sends, but the offline content didn't. | `content:build` also writes answer-free lessons (`built/learner-levels`), and `app/metro.config.js` puts only those in any build that talks to Supabase, including every release build. Verified: a Supabase web build contains zero correct flags. Only the development harness (no server) ships answers. |
| Medium | Replays and not-due practice are graded but not recorded, so a learner could grade each option, then submit the right one as a review "first attempt" for +10 XP. | Those checks are noted (`user_question_checks`); a review first attempt at that question after it came due earns no XP. |
| Medium | A missed review comes back in 10 minutes, and answering it right earned +10, so missing on purpose earned more than remembering. | The re-check after a missed review earns no XP (memory strength still recovers). |
| Medium | A content correction that removed a question failed to import once anyone had reviewed it (foreign key without cascade). | The review-attempt foreign key cascades. |
| Medium | Store sandbox purchases (TestFlight) would grant real Unlimited. | Sandbox events and subscriptions are ignored unless a staging project turns them on (`app_settings.allow_sandbox_purchases`, `ALLOW_SANDBOX_PURCHASES`). |
| Low–medium | Changing time zone gave a fresh daily allowance (and a second first-day bonus). | The time zone changes only through `update_profile`, at most once a day; the direct column grant is gone. |
| Low | `log_events` stored any prop key (including an email) and one malformed timestamp aborted the batch. | Only each event's declared props are kept (synced with the client catalog by a test), and timestamps are parsed safely. |
| Low | Display names had no length limit. | Capped at 60 characters. |
| Low | `sync-entitlement` returned raw database errors. | Returns a generic error and logs the detail. |
| Low | The account-deletion test didn't list `user_review_attempts`. | Listed, with the new `user_question_checks`. Both cascade. |

## Checked and fine

- RLS is on for every public table; no policy is broader than the learner's own rows or published content; there are no views. Answer tables have no learner policies.
- Every `security definer` function sets `search_path` and takes the learner from `auth.uid()`, never from an argument. Service-only functions are revoked from `public`, `anon` and `authenticated`.
- `complete_level` locks per learner, checks sequencing, the daily cap and resolution, and is idempotent; the XP ledger keys are unique.
- Entitlements are written only by the service role; `sync-entitlement` uses the caller's verified session; the webhook compares its secret in constant time.
- All learner tables cascade from `profiles` on account deletion.
- The app ships public keys only and refuses a secret key; web OAuth uses PKCE with an allow-listed redirect; Apple sign-in uses a hashed nonce.

## Known and accepted

- `skip_nonce_check = true` for Google in `backend/supabase/config.toml`: native Google Sign-In on iOS can't send a nonce, so a captured Google ID token could be replayed within its lifetime. Revisit if the sign-in flow changes.
- `[auth.sms.test_otp]` in `config.toml` is for the local stack only; never push it to a hosted project.
- In RevenueCat, set restore behavior to **transfer** (not share), so a restore on a second account moves Unlimited rather than duplicating it.
