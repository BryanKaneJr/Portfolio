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

The store builds already carry every value they need in `app/eas.json`, so there's nothing to set in EAS. Add any new value there too (preview and production), not only on expo.dev: [instant updates](#instant-updates-no-new-build) bundle from `eas.json`, so a value kept only on expo.dev would reach builds but not updates. All are public build-time values; never put a secret key in the app.

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Already set in `eas.json` (preview and production) to the live project and its publishable key, which is public by design. `npm run supabase:check` validates them |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google sign-in (optional; Google is hidden without them) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat public SDK keys. The iOS one is set in `eas.json` (public, safe to ship); add the Android one there when the Play app exists |
| `EXPO_PUBLIC_PRIVACY_URL` | Already set in `eas.json` to `https://brainscroll.app/privacy`, the policy the site publishes from `docs/privacy-policy.md` (required by both stores) |
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

## Instant updates (no new build)

Store and TestFlight builds check for an update each time they open (`expo-updates`, the `production` channel). To send a change to the app's code or images to every phone without a new build or App Review, from `brainscroll/` after `git pull` and `npm install`, signed in to Expo:

```sh
npm run app:update -- "Fix the order question drag"
```

It bundles with the store build's values from `eas.json`, checks the bundle talks to Supabase and has at most 1,000 files per platform (EAS's limit for one update; level art ships four images to a file for this), and publishes. A phone downloads it the next time the app opens and runs it the time after (close and reopen twice to see it at once). Never run a plain `eas update`: it bundles without the `eas.json` values and would send every phone the offline test harness.

- **What needs a build instead:** a new native package, a config plugin, or a change to `app/app.json` or `app/app.config.ts`. Raise `version` in `app/app.json` first (1.0.0 to 1.0.1): the runtime version follows it, so phones on an older build never get code they can't run.
- **Apple's rule:** updates may fix bugs and improve the app; a change to what the app is goes through review.
- **Undo:** from `brainscroll/app`, `npx eas-cli@latest update:roll-back-to-embedded --channel production --message "Roll back"` returns every phone to the code inside its build. Or fix it and publish again.
- Builds from before 2026-10-09 don't have updates; the build after PR #41 is the first that does.

## Before each release: QA checklist

Run `npm run check`, `npm run test:db`, `npm run e2e` and `npm run e2e:remote`: all must pass. Then, on real phones (one iPhone, one Android), with a production-profile build against staging Supabase:

- [ ] **Sign in** with Apple, Google, phone and email (whichever the build offers). Wrong code refused; resend cooldown; sign out and back in restores progress.
- [ ] **Onboarding** to Level 1; the deal screen (your picked level's art at the top on bigger phones, four lines with icons); "See all subjects".
- [ ] **A level:** cards scroll; a wrong answer shows "Take another look" under the choices; Level Complete shows XP and the level up; "Next: Level 2" works.
- [ ] **Leaving a level:** close mid-level: Dr. Scroll warns it will start over; Keep going stays on the card; Leave anyway (or force-quit) and reopen: it starts from the first card.
- [ ] **Brainpower:** a new account shows 🧠 5 / 10; each first clear spends 1 and the count updates; streak day 2, a trophy, a chapter's first review and (sometimes) a perfect clear each show +1; at 10 nothing more is kept (Brainpower Full); at 0, Brainpower used up appears, a new level isn't startable, review still is; the next local day refills to 5 (more is kept); Unlimited shows 🧠 ∞ Brainpower.
- [ ] **Review** after due time: misses must be corrected; +10 XP per first-try item.
- [ ] **Chapter review:** from the Practice tab, review a cleared chapter; misses must be corrected; at most +30 XP; leaving and reopening resumes it.
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
- **Unlimited during review (decide before submitting).** Apple and Google reviewers buy with sandbox or test accounts against your production build. BrainScroll's production server ignores sandbox purchases (`allow_sandbox_purchases = false` and no `ALLOW_SANDBOX_PURCHASES` secret, see `subscriptions.md`), so a reviewer's purchase would succeed in the store sheet but Brainpower would stay limited (no ∞). That looks like a broken purchase and is a common rejection reason. Options: turn both switches on in production for the review window and off again after approval (a sandbox purchase can then lift the cap for any learner who has a sandbox account, which is rare), or grant Unlimited to the review account by hand. Pick one and match the review notes to it.

## What's left for launch

Done already: the Supabase project (it serves as production: every level imported, the push job running every 5 minutes, the latest functions deployed), the RevenueCat iOS key, the site with the privacy policy, account deletion and invite pages, the App Store screenshots (`store/app-store-iphone-6.9/`), and drafts of the listing copy and the privacy answers.

iPhone first, in this order:

1. ~~**The first build to TestFlight**~~ done (2026-10-09). One more build carries the first round's fixes and [instant updates](#instant-updates-no-new-build); after it, most fixes go out with `npm run app:update`. On a computer, from `brainscroll/app`: `npx eas-cli@latest build --profile production --platform ios --auto-submit`.
2. **The two subscriptions** in App Store Connect, with the week-long free trial, and the Paid Apps agreement, tax and banking ([`subscriptions.md`](subscriptions.md)). Skip any part that's already done.
3. ~~**The Apple Team ID**~~ done: `X3837877NX`, read from the first TestFlight build and set in `scripts/site-build.ts`, so invite links open the app ([`invite-links.md`](invite-links.md)). Apple fetches the link file when the app is installed, so it can take a reinstall or a day to start working.
4. **A few days on TestFlight:** the QA checklist above, on your iPhone.
5. **Launch week:**
   - the Weekly Quests are dated (all 52, one a week from Monday 12 October 2026; owner 2026-10-10) and on the live project; to move them, shift the dates in `content/quests.json` and import;
   - mark the skills and subjects `published` in `content/` (they're still `draft`; nothing in the app reads it, but an import without `--publish-drafts` copies it);
   - move Supabase to Pro (free projects pause after a quiet week);
   - remove the ten screenshot test learners (stargazer_ana and the rest, added 2026-10-09 to fill @bryan's league, friends and feed; they can't sign in). In the Supabase SQL editor: `delete from auth.users where raw_app_meta_data ->> 'brainscroll_test' = 'true';` takes everything of theirs with them;
   - decide how reviewers see Unlimited ([App review sign-in](#app-review-sign-in)), then turn sandbox purchases off once approved;
   - answer App Privacy and the age rating from [`store-privacy.md`](store-privacy.md), and submit.

Reviewers can sign in with their own Apple ID. A test Google account is only needed once Google sign-in is on.

**Android, after the iPhone launch:** a Play Console account, Firebase for push ([`notifications.md`](notifications.md)), the Android RevenueCat key in `eas.json`, and the SHA-256 fingerprint for invite links.
