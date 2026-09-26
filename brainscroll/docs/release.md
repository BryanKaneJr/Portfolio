# Release: builds, testing and store submission

How BrainScroll gets from this repo onto phones. Builds run on EAS (Expo's cloud), so no Mac or Android Studio is needed. Related: [`supabase-setup.md`](supabase-setup.md), [`subscriptions.md`](subscriptions.md), [`store-listing.md`](store-listing.md), [`privacy-policy.md`](privacy-policy.md).

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

## Still needed from you

1. Apple Developer Program and Google Play Console accounts.
2. A Supabase production project (and a staging one for testing).
3. RevenueCat, the store products and the webhook ([`subscriptions.md`](subscriptions.md)).
4. A reviewed, published privacy policy ([`privacy-policy.md`](privacy-policy.md) is a draft), and a support URL or email for the listings.
5. Screenshots and final listing copy ([`store-listing.md`](store-listing.md)).
