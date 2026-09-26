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
| `EXPO_PUBLIC_PRIVACY_URL` | Your published privacy policy (required by both stores) |
| `EXPO_PUBLIC_TERMS_URL` | Optional; defaults to Apple's standard licence |

## First build on your phone

```sh
cd brainscroll/app
npx eas-cli@latest login
npx eas-cli@latest init                      # links the project; writes its id into app config
npx eas-cli@latest build --profile development --platform ios   # or android
```

Install from the link EAS gives you (iOS asks you to register the device first: `eas device:create`). Then run `npm run app` on your computer and open the development build.

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
- [ ] **Onboarding** to Level 1; the deal screen; "See the world map".
- [ ] **A level:** cards scroll; a wrong answer shows "Take another look" under the choices; Level Complete shows XP and the level up; "Next: Level 2" works.
- [ ] **Resume:** leave mid-level, force-quit, reopen: same card.
- [ ] **Daily limit:** the first day's 10 (5 after), then Daily Knowledge Complete; a sixth level isn't startable; review still is.
- [ ] **Review** after due time: misses must be corrected; +10 XP per first-try item.
- [ ] **Unlimited** (Sandbox tester): buy monthly and annual; the cap lifts at once; restore on a second device; cancel; expiry brings the cap back.
- [ ] **Offline:** airplane mode shows the offline card, no crash; back online recovers.
- [ ] **Account deletion** removes the account; signing in again starts fresh.
- [ ] **Accessibility:** VoiceOver/TalkBack reads buttons and answers; largest text size doesn't cut off buttons; reduce motion stops the animations.
- [ ] **Look:** the icon and launch screen; no text cut off on the smallest supported phone (iPhone SE).

## App review sign-in

**The problem.** Apple and Google reviewers must be able to sign in, and there is no guest mode. Every BrainScroll sign-in uses a one-time code (SMS or email) or an Apple/Google account, and a reviewer can't receive a code sent to your phone or inbox. Without a working login, the review is rejected ("unable to sign in").

**The fix: a Supabase test phone number with a fixed code.** Supabase Auth can map a phone number to a fixed OTP. For that number it sends no SMS and accepts only the mapped code; every other number still goes through the real SMS provider.

1. Pick a number no real person uses, for example one from a range reserved for fiction (such as `+1 555 0100` to `0199` in North America). Pick a 6-digit code that isn't obvious (not `123456`).
2. In the **production** Supabase project: Authentication → **Sign In / Providers** (older dashboards: **Providers**, or **Auth settings**) → **Phone** → **Test Phone Numbers and OTPs**. Add it as `<number without +>=<code>`, for example `15555550142=804117`. If the dashboard offers a "valid until" date for test codes, set one after your expected review date. **Confirm the exact menu names in the current dashboard**; Supabase moves these settings from time to time.
3. Phone sign-in must be enabled with a working SMS provider, or the app won't offer phone. Supabase has had a known issue where test numbers don't work with **Twilio Verify** (as opposed to Twilio Programmable Messaging); if you use Verify, test the number before submitting.
4. Test it on a production-profile build: choose phone, type the number with its country code (`+1 555 555 0142`), enter the fixed code, and you're in. No SMS should arrive anywhere.
5. Give the reviewers the number and code:
   - **App Store Connect:** your app → App Review Information → Sign-in required → put the phone number in *User name* and the code in *Password*, and paste the notes from [`store-listing.md`](store-listing.md#review-notes-app-review--play-app-access).
   - **Play Console:** App content → **App access** → "All or some functionality is restricted" → add instructions with the number, the code and the same notes.

**Warnings.**

- **Never commit the real test number or code** to this repo, in docs, config or tests. They live only in the Supabase dashboard and the two store consoles. `backend/supabase/config.toml` has its own local-only test number (`[auth.sms.test_otp]`, code `123456`); never push that block to a hosted project (`supabase config push`).
- **Anyone who learns the number and code can sign in to that account.** It holds only test progress, but treat the pair like a password. After launch, remove it or rotate the code if you like; keep one for future reviews (each update goes through review again) or add it back before each submission.
- **The reviewer's progress lives in production.** Their account, levels, answers, reports and analytics events are real rows in the production database. That's harmless: it's one account, and the admin insights only flag anything once 20 learners have seen it. If you'd rather keep the numbers clean, delete the account after review (sign in, Profile → Delete account).
- **Unlimited during review (decide before submitting).** Apple and Google reviewers buy with sandbox or test accounts against your production build. BrainScroll's production server ignores sandbox purchases (`allow_sandbox_purchases = false` and no `ALLOW_SANDBOX_PURCHASES` secret, see `subscriptions.md`), so a reviewer's purchase would succeed in the store sheet but the daily cap would stay on. That looks like a broken purchase and is a common rejection reason. Options: turn both switches on in production for the review window and off again after approval (a sandbox purchase can then lift the cap for any learner who has a sandbox account, which is rare), or grant Unlimited to the review account by hand. Pick one and match the review notes to it.

## Still needed from you

1. Apple Developer Program and Google Play Console accounts.
2. A Supabase production project (and a staging one for testing).
3. RevenueCat, the store products and the webhook ([`subscriptions.md`](subscriptions.md)).
4. A reviewed, published privacy policy ([`privacy-policy.md`](privacy-policy.md) is a draft), and a support URL or email for the listings.
5. Screenshots and final listing copy ([`store-listing.md`](store-listing.md)).
6. A review sign-in: a Supabase test phone number with a fixed code in the production project, entered in App Store Connect (App Review Information) and Play Console (App access), never in this repo. Also decide how reviewers see Unlimited work. See [App review sign-in](#app-review-sign-in).
7. The App Privacy, Data safety and age rating answers ([`store-privacy.md`](store-privacy.md)), including its "Confirm" items, and a public account-deletion web page for Google Play.
