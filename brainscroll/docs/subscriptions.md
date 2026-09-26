# Unlimited (subscriptions)

Free is 5 new levels a day, forever, with unlimited review. **Unlimited** ($4.99/month, $39.99/year) removes the daily limit on new levels. That is its only effect on progression: XP, levels, knowledge, mastery and trophies are the same for everyone (`docs/product-rules.md`, *pay for freedom, not knowledge*). One entitlement: `unlimited_learning`.

## How it works

```
App (react-native-purchases) ──buy/restore──▶ App Store / Google Play
      │                                            │
      │ syncEntitlement()                           ▼
      ▼                                        RevenueCat ──webhook──▶ revenuecat-webhook (Edge Function)
sync-entitlement (Edge Function) ──asks──▶ RevenueCat REST API            │
      │                                                                  ▼
      └──────────────▶ apply_entitlement() ◀── apply_revenuecat_event() ── public.entitlements
                                                                         │
                                            has_unlimited() ─▶ daily cap in start/complete_level
```

- **The server decides.** Only the service role writes `public.entitlements`, and `has_unlimited()` (used by the daily cap) reads it. The app never unlocks anything on its own word.
- **RevenueCat's app user id is the Supabase user id.** The app calls `Purchases.logIn(userId)` on sign-in, so every webhook names our learner.
- **Two ways in, same function.** The webhook (`apply_revenuecat_event`) handles renewals, cancellations, billing grace, expiry and transfers. Right after a purchase or restore, the app calls `sync-entitlement`, which asks RevenueCat directly, so Unlimited applies at once instead of waiting for the webhook. Both write through `apply_entitlement`, which ignores any event older than the last one applied.
- **Cancelling** keeps Unlimited until the paid period ends. **Expiry** (or a refund, which RevenueCat sends as an expiry at the refund time) turns it off and the cap returns. An active row whose expiry has passed never counts, even before the expiry event arrives.
- **Sandbox purchases** (TestFlight, Play license testers) never grant Unlimited in production. On a staging project, set `update public.app_settings set allow_sandbox_purchases = true;` and the `ALLOW_SANDBOX_PURCHASES=true` function secret to test with them.
- **Deleting an account** removes its entitlement row (cascade). It doesn't cancel the store subscription: Apple and Google own that, and the account deletion screen says so.

## Where the learner meets it

- **Daily Knowledge Complete**: a quiet "Want more today?" card opens the Unlimited screen. It never interrupts a lesson.
- **Profile → Plan**: the learner's own way in, and the plan's status once it's on.
- **The Unlimited screen** (`app/src/app/unlimited.tsx`) says what stays free, shows the two plans with the store's localized prices, and carries restore, manage, the auto-renewal terms and the Terms / Privacy links the App Store requires.

## Builds

| Build | Purchases | Notes |
| --- | --- | --- |
| Development harness (no Supabase) | **Sandbox** | Plans at the spec prices; buying writes a sandbox record the local backend reads back, like the real round trip. "End sandbox plan" stops it. No accounts, no money. |
| iOS / Android with Supabase | **RevenueCat** | Needs a development or store build: Expo Go has no store billing. |
| Web | None | The screen explains that Unlimited is bought in the phone apps. |

## Setup checklist (owner)

These need your accounts; none of it can be done from the repo.

1. **Privacy policy (launch blocker).** Publish one and set `EXPO_PUBLIC_PRIVACY_URL`. Apple rejects subscription apps without it. Terms default to Apple's standard EULA; set `EXPO_PUBLIC_TERMS_URL` to use your own.
2. **App Store Connect**: create a subscription group "Unlimited" with two auto-renewable subscriptions, product ids `unlimited_monthly` ($4.99) and `unlimited_annual` ($39.99). Add the Paid Apps agreement, tax and banking. Create an App Store Connect API key for RevenueCat.
3. **Google Play Console**: create subscriptions `unlimited_monthly` and `unlimited_annual` with one base plan each. Link a service account for RevenueCat.
4. **RevenueCat** (app.revenuecat.com):
   - Add the iOS and Android apps.
   - Create the entitlement `unlimited_learning` and attach both products.
   - Create an offering `default` with packages *Monthly* and *Annual*.
   - Put the **public** SDK keys in `app/.env.local`: `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (`appl_…`) and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (`goog_…`).
   - Create a **secret** API key (v1) for `sync-entitlement`.
5. **Supabase**: apply the migrations (`supabase db push`) and deploy the functions:
   ```sh
   cd backend
   supabase secrets set REVENUECAT_SECRET_API_KEY=sk_… REVENUECAT_WEBHOOK_SECRET=<a long random string>
   supabase functions deploy revenuecat-webhook --no-verify-jwt
   supabase functions deploy sync-entitlement
   ```
6. **RevenueCat webhook**: Project → Integrations → Webhooks. URL `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`, Authorization header `Bearer <REVENUECAT_WEBHOOK_SECRET>`. Send a test event: it's acknowledged and ignored.
7. **Test in sandbox** (a development build on a real phone, with a Sandbox Apple ID / Play license tester): buy each plan, restore on a second device, cancel, let it expire (sandbox renewals are minutes long), and change device. Check `public.entitlements` follows along.

## Tests

- `backend/tests/subscriptions.test.sql` (in `npm run test:db`): permissions, purchase, cancel, stale events, expiry, lapsed expiry, sync, transfer, ignored events, no XP.
- `scripts/test/revenuecat.test.ts` (in `npm run check`): reading RevenueCat's subscriber record (grace periods, cancellations, lifetime grants) and the webhook secret check.
- `npm run e2e`: the sandbox purchase, the lifted cap, ending the plan and restore.
- `npm run e2e:remote`: the web message, the webhook (wrong secret refused, purchase and expiry) and the server lifting and restoring the cap.
