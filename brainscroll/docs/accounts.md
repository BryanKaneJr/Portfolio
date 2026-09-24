# Accounts: sign in first, no guest mode

BrainScroll requires an account before any learning progress exists. There are no anonymous or guest users, no guest progress, no guest-to-account migration, no merge logic and no guest cleanup jobs. The first-run path is:

**Open the app → choose a sign-in method → account created or signed in → onboarding (pick a skill, the deal) → Level 1.**

Signing in *is* signing up: the first sign-in with a method creates the account, so there's no separate registration form. Progress is keyed to the account's user id, so it survives reinstalls and follows the learner to any device where they sign in the same way.

The code is in:

- `packages/core/src/account.ts`: states, methods, phone/email checks, error mapping.
- `app/src/progress/{backend,remoteBackend,localBackend}.ts`: the backends.
- `app/src/auth/`: native Apple/Google adapters and the Apple button.
- `app/src/app/sign-in.tsx`: the sign-in screen.
- `app/src/app/_layout.tsx`: `AuthGate`.
- `app/src/components/AccountCard.tsx`: the Profile card.
- `backend/supabase/migrations/20261001000000_accounts_required.sql`: the server rule.
- `e2e/{local,remote}.mjs`: the tested flows.

## Sign-in methods

| Method | Native (iOS / Android) | Web | Supabase call |
|---|---|---|---|
| **Sign in with Apple** | iOS only: the system sheet (`expo-apple-authentication`) returns an ID token. A random nonce is sent hashed and verified raw. | OAuth redirect (PKCE) | `signInWithIdToken({ provider: 'apple', token, nonce })` / `signInWithOAuth` |
| **Sign in with Google** | The Google sheet (`@react-native-google-signin/google-signin`) returns an ID token for the web client id | OAuth redirect (PKCE) | `signInWithIdToken({ provider: 'google', token })` / `signInWithOAuth` |
| **Phone number** | SMS one-time code; the number must include its country code (E.164) | same | `signInWithOtp({ phone })` → `verifyOtp({ type: 'sms' })` |
| **Email** (fallback) | Email one-time code (no magic links, no deep links) | same | `signInWithOtp({ email })` → `verifyOtp({ type: 'email' })` |

- **Order:** the screen shows one-tap methods first: Apple, Google, phone, then email as the quiet fallback.
- **What's offered:** `signInMethods()` offers only methods that are both switched on in the project and usable on the device.
  - The project's switches come from `/auth/v1/settings`, so turning a provider on in Supabase needs no app release.
  - On the device, Apple needs iOS (or web), and native Google needs its client ids.
  - A method without credentials is simply not shown. Nothing falls back to a guest mode.
- **Identity linking:** Supabase links identities that share a verified email, so signing in with Apple and later with Google (same email) reaches the same account.
- **Phone accounts:** a phone account has no email to link, so a learner who signs in by phone should keep using their phone.

## States

| State | Meaning | What the app shows |
|---|---|---|
| `signed_out` | No session. | Only the sign-in screen: `AuthGate` redirects every route there. |
| `signed_in` | A permanent account: `userId`, `method`, and its `email` or `phone`. | Onboarding if this account hasn't onboarded, else Home. Profile shows the account and **Sign out**. |

`accountFromUser()` derives the state from the Supabase user. It never treats an anonymous user as signed in; a leftover anonymous session from the old guest-first design is signed out on launch.

## Enforcement (no anonymous users, anywhere)

1. **Project setting:** *Allow anonymous sign-ins* is **off** (`config.toml`: `enable_anonymous_sign_ins = false`). `npm run supabase:check` fails if it's on.
2. **Database:** `handle_new_user()` raises `ANONYMOUS_ACCOUNTS_NOT_SUPPORTED` for any anonymous `auth.users` insert. The sign-up aborts, so no user row and no profile are created even if the setting is switched on by mistake. The same migration deletes any anonymous users left over, and their data cascades away.
3. **App:** no code path calls `signInAnonymously`. The backend's progress calls require a signed-in account (`NOT_SIGNED_IN` otherwise), and analytics are only sent under a signed-in account.

Tested in `backend/tests/accounts.test.sql`, `packages/core/test/account.test.ts` and both e2e suites.

## Device-side state is per account

- Level sessions in progress, the onboarding flag and the active skill are stored on the device under `…:<userId>`.
- A second account on the same device never inherits the first one's sessions or onboarding.
- Anyone who has cleared a level has onboarded, whichever device they cleared it on. That's why a reinstall skips onboarding.

## Sign out and delete

- **Sign out** (every account): it flushes this account's queued analytics, signs out, and returns to the sign-in screen. Progress stays with the account.
- **Delete account:** Profile → **Delete account** → one confirmation → `delete_my_account()` removes the auth user, and every learner table cascades through `profiles`.
  - That covers progress, attempts, review, XP, allowances, entitlement rows, reports and analytics.
  - The app returns to the sign-in screen, and nothing is created in its place.
  - It warns that store subscriptions must be cancelled in the store.
  - Tested in `account-deletion.test.sql` and both e2e suites.

## Development without credentials

With no Supabase config, the app runs the **development harness** (`localBackend.ts`):

- The flow is the real one (sign-in screen → onboarding → learning), but accounts are simulated on the device.
- All four methods work. Apple/Google sign in as a fixed simulated identity, and every phone/email code is `123456`.
- The sign-in screen says so.
- Progress belongs to the simulated account, never to the device.

Store builds set `EXPO_PUBLIC_RELEASE=1`. That makes the app refuse to start without a Supabase project instead of falling back to the harness.

For the remote e2e suite, `backend/tests/fake-supabase.mjs` implements the same auth endpoints: codes, native ID tokens, the web OAuth redirect with PKCE, and settings. It refuses anonymous sign-up the way a correctly configured project does.

## Configuring the real project

See [`supabase-setup.md`](supabase-setup.md) §1 for the dashboard steps. In short:

1. **Anonymous sign-ins off.** Email on. Phone on, with an SMS provider (Twilio or similar). Apple and Google on, with their credentials.
2. **Email templates must show the code.** Put `{{ .Token }}` in the **Magic Link** and **Confirm signup** templates.
3. **Custom SMTP and an SMS provider** before real users, because the built-in mailer is for testing only.
4. **App build variables** (public ids only):
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (all platforms).
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (iOS). `app.config.ts` derives the URL scheme from it.
   - Sign in with Apple needs the `usesAppleSignIn` entitlement (already in `app.config.ts`) and the bundle id `app.brainscroll` as an authorized client id in Supabase.
5. `npm run supabase:check` reports:
   - each method as ok or not-enabled-yet;
   - failure if anonymous sign-ins are on, or if no method is enabled at all.

### Needs credentials (not verifiable here)

- The Apple Services ID, key and team, and the Google OAuth clients, are external credentials. They haven't been created.
- The native Apple/Google sheets have only been typechecked. They need a device build (EAS / `expo run:ios`) to test.
- The web OAuth redirect and every code flow are e2e-tested against `fake-supabase.mjs`.

## Errors

Supabase Auth codes map to stable `AccountErrorCode`s, each with calm player-facing copy in `ACCOUNT_ERROR_TEXT`:

- `INVALID_PHONE`, `INVALID_EMAIL` and `INVALID_CODE`
- `RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `NOT_SIGNED_IN`

Closing the Apple/Google sheet is `CANCELLED` and shows nothing.

## Security

- The app only ever holds the anon/publishable key. It refuses to start with a secret key (`checkClientConfig`), and `npm run supabase:check` fails on one.
- The server still owns every award. Signing in changes who you are, never your progress.
- One-time codes are Supabase's, with its rate limits (`config.toml` `[auth.rate_limit]`). The client checks the email, phone and code shape only to catch typos.
- Apple sign-in uses a hashed nonce, and web OAuth uses PKCE.
- Analytics never carry an email or phone number: the sanitizer drops anything that looks like one.

## Open product decisions

These don't block anything above.

1. **Apple/Google/SMS credentials.** Someone with the Apple Developer and Google Cloud accounts must create them, and an SMS provider must be chosen and paid for.
2. **Country picker for phone numbers.** Today the learner types the country code (`+1 …`). A picker that pre-fills it from the device region would cut friction.
3. **Google and Apple button branding.** The Apple button uses Apple's native component on iOS. The Google button is a styled BrainScroll button. Google's branding guidelines prefer their logo mark, so decide before launch.
4. **Usernames** are needed for friends (post-MVP, see `social-expansion.md`), not for signing in.
