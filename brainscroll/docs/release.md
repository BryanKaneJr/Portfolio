# Release: builds, testing and store submission

How BrainScroll gets from this repo onto phones. Builds run on EAS (Expo's cloud), so no Mac or Android Studio is needed. Related: [`supabase-setup.md`](supabase-setup.md), [`subscriptions.md`](subscriptions.md), [`store-listing.md`](store-listing.md), [`store-privacy.md`](store-privacy.md), [`privacy-policy.md`](privacy-policy.md).

## Build profiles (`app/eas.json`)

| Profile | For | Backend | Notes |
| --- | --- | --- | --- |
| `development` | Your phone, while building features | Supabase if its variables are set, otherwise the development harness | A development client (`expo-dev-client`): loads JavaScript from `npm run app`. Needed for purchases and native sign-in, which Expo Go can't do. |
| `preview` | Testers (internal distribution, TestFlight or Play internal testing) | Supabase, required | `EXPO_PUBLIC_RELEASE=1`: refuses to start without Supabase, never falls back to simulated accounts. |
| `production` | The stores | Supabase, required | Same as preview, store distribution; the build number increments automatically (`appVersionSource: remote`). |

App identifiers: `app.brainscroll` on both platforms (`app/app.json`). Change them before the first build if you want a different reverse domain; they can't change after the first store upload.

## Environment variables

Set these in EAS (expo.dev → project → Environment variables) for the `preview` and `production` environments. All are public build-time values; never put a secret key in the app.

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase project (`npm run supabase:check` validates them) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google sign-in (optional; Google is hidden without them) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat public SDK keys |
| `EXPO_PUBLIC_PRIVACY_URL` | Already set in `eas.json` to `https://invite.brainscroll.app/privacy`, the policy the site publishes from `docs/privacy-policy.md` (required by both stores) |
| `EXPO_PUBLIC_TERMS_URL` | Optional; defaults to Apple's standard licence |
| `EXPO_PUBLIC_INVITE_DOMAIN` | Already set in `eas.json` to `invite.brainscroll.app`: invite links open the app (docs/invite-links.md) |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional: turns on crash reporting (Sentry). Reports carry no user, email, phone or IP. Set it and the App Privacy / Data safety crash rows say Yes ([`store-privacy.md`](store-privacy.md)) |

## First build on your phone

```sh
cd brainscroll/app
npx eas-cli@latest login
npx eas-cli@latest init                      # links the project; writes its id into app config
npx eas-cli@latest build --profile development --platform ios   # or android
```

Install from the link EAS gives you (iOS asks you to register the device first: `eas device:create`). Then run `npm run app` on your computer and open the development build.

**Windows:** `cd` into the repo with the folder names spelled exactly as they are on disk (for example `C:\Dev`, not `C:\dev`). Metro treats a different capitalisation as a different path and then can't find `@brainscroll/core` ("Unable to resolve"). After fixing it, start once with `npm run app -- --clear`. If the phone can't find the server, check iPhone Settings → BrainScroll → Local Network, allow Node.js in Windows Firewall, or use `npm run app -- --tunnel`.

## TestFlight and Play internal testing

```sh
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform ios       # to App Store Connect → TestFlight
npx eas-cli@latest submit --profile production --platform android   # to Play Console (internal testing track)
```

The first iOS build creates the app record, certificates and profiles for you (EAS asks for your Apple Developer login). For Google Play, upload the first build by hand in the Play Console and create a service account key for later `eas submit` runs.

## Before each release: QA checklist

Run `npm run check`, `npm run test:db`, `npm run e2e` and `npm run e2e:remote`: all must pass. Then, on real phones (one iPhone, one Android), with a production-profile build against staging Supabase:

- [ ] **Sign in** with Apple, Google, phone and email. Wrong code refused; resend cooldown; sign out and back in restores progress.
- [ ] **Onboarding** to Level 1; the deal screen (your picked level's art at the top on bigger phones, four lines with icons); "See all subjects".
- [ ] **A level:** cards scroll; a wrong answer shows "Take another look" under the choices; Level Complete shows XP and the level up; "Next: Level 2" works.
- [ ] **Resume:** leave mid-level, force-quit, reopen: same card.
- [ ] **Daily limit:** the first day's 10 (5 after), then Daily Knowledge Complete; a sixth level isn't startable; review still is.
- [ ] **Review** after due time: misses must be corrected; +10 XP per first-try item.
- [ ] **Chapter review:** from the Review tab, review a cleared chapter; misses must be corrected; at most +30 XP; leaving and reopening resumes it.
- [ ] **Weekly Quest** (give one quest this week's date on staging): progress counts new levels; the Final Round opens when every skill is done; finishing in its week gives the trophy, and its title and emblem can be shown on Profile. An ended quest in the Archive pays XP, no trophy.
- [ ] **Trophies:** First Level appears after Level 1, with a "Trophy earned" moment; the Trophies screen lists earned and still-ahead trophies (one per series, with "N more after this"). The badge springs in with a buzz a beat after the card; a gold trophy (a skill's mastery) catches the light twice. Profile's open slots show the next trophies, dimmed.
- [ ] **Sharing:** tap an earned trophy (Profile or Trophies) and the streak flame in the top bar: each opens its card; Share opens the system share sheet with the image and line; Close returns.
- [ ] **Big phones (Pro Max / Plus):** learning cards with room show the level's art above the text; questions never do. On an iPhone SE the art only appears where it fits.
- [ ] **Daily reminder:** turn it on in Profile → Settings, allow notifications, and it arrives at the chosen time; turning it off stops it.
- [ ] **Unlimited** (Sandbox tester): buy monthly and annual; the cap lifts at once; restore on a second device; cancel; expiry brings the cap back.
- [ ] **Offline:** launch in airplane mode: still signed in, the tabs show "Couldn't reach BrainScroll" with Try again, no crash; back online (or back to the app) recovers. Mid-lesson, a failed check or save says so and keeps your answers.
- [ ] **Account deletion** removes the account; signing in again starts fresh.
- [ ] **Accessibility:** VoiceOver/TalkBack reads buttons and answers; largest text size doesn't cut off buttons; reduce motion stops the animations.
- [ ] **Look:** the icon and launch screen; no text cut off on the smallest supported phone (iPhone SE).

## App review sign-in

**The problem.** Apple and Google reviewers must be able to sign in, and there is no guest mode. At launch BrainScroll offers only Sign in with Apple and Sign in with Google, so reviewers sign in with one of those. Without a working login, the review is rejected ("unable to sign in").

**The fix: a dedicated test Google account.**

1. Create a new Google account used only for review (for example `brainscroll.review@gmail.com`). Don't use your own account.
2. Give it a strong password and **turn 2-Step Verification off** for it, so a reviewer on a new device isn't asked for a code sent to your phone. Google may still ask a new device to confirm; signing in to it once from a couple of devices beforehand helps.
3. Test it on a production-profile build, on both an iPhone and an Android phone: Continue with Google, pick the account, and you're in.
4. Give the reviewers the account:
   - **App Store Connect:** your app → App Review Information → Sign-in required → the Google address in *User name* and its password in *Password*, plus the notes from [`store-listing.md`](store-listing.md#review-notes-app-review--play-app-access). Apple reviewers can also use Sign in with Apple with their own Apple ID, which Apple generally accepts; the Google account is the backup.
   - **Play Console:** App content → **App access** → "All or some functionality is restricted" → add instructions with the address, the password and the same notes.

**Warnings.**

- **Never commit the review account's address or password** to this repo, in docs, config or tests. They live only in your password manager and the two store consoles.
- **Anyone with the password can sign in to that account.** It holds only test progress, but treat it like any password. Keep it for future reviews (each update goes through review again), and change the password if it's ever exposed.
- If a review is rejected with "unable to sign in", check whether Google blocked a new-device sign-in (the account's security page lists recent attempts), then reply in the review thread.
- **The reviewer's progress lives in production.** Their account, levels, answers, reports and analytics events are real rows in the production database. That's harmless: it's one account, and the admin insights only flag anything once 20 learners have seen it. If you'd rather keep the numbers clean, delete the account after review (sign in, Profile → Settings → Delete account).
- **Unlimited during review (decide before submitting).** Apple and Google reviewers buy with sandbox or test accounts against your production build. BrainScroll's production server ignores sandbox purchases (`allow_sandbox_purchases = false` and no `ALLOW_SANDBOX_PURCHASES` secret, see `subscriptions.md`), so a reviewer's purchase would succeed in the store sheet but the daily cap would stay on. That looks like a broken purchase and is a common rejection reason. Options: turn both switches on in production for the review window and off again after approval (a sandbox purchase can then lift the cap for any learner who has a sandbox account, which is rare), or grant Unlimited to the review account by hand. Pick one and match the review notes to it.

## Still needed from you

1. Apple Developer Program and Google Play Console accounts.
2. A Supabase production project (and a staging one for testing).
3. RevenueCat, the store products and the webhook ([`subscriptions.md`](subscriptions.md)).
4. The privacy policy reviewed, and the site's `SITE_*` details set so it publishes complete at `https://invite.brainscroll.app/privacy` ([`invite-links.md`](invite-links.md)); a support URL or email for the listings.
5. Screenshots and final listing copy ([`store-listing.md`](store-listing.md)).
6. A review sign-in: a dedicated test Google account, entered in App Store Connect (App Review Information) and Play Console (App access), never in this repo. Also decide how reviewers see Unlimited work. See [App review sign-in](#app-review-sign-in).
7. The App Privacy, Data safety and age rating answers ([`store-privacy.md`](store-privacy.md)), including its "Confirm" items, and the account-deletion web page for Google Play: `https://invite.brainscroll.app/delete-account`.
