# Store privacy and age rating answers (draft)

Answers for Apple's **App Privacy** section, Google Play's **Data safety** form, and both age rating questionnaires. They describe what the app collects as of 2026-09-26, checked against the code: the database schema (`backend/supabase/migrations`), the analytics catalog (`packages/core/src/analytics.ts`), purchases (`app/src/purchases/`), the progress backend (`app/src/progress/remoteBackend.ts`) and sign-in (`app/src/app/sign-in.tsx`, `app/src/auth/idToken.ts`). They must match [`privacy-policy.md`](privacy-policy.md). If the app starts collecting anything new, update all three.

Items marked **Confirm** need the owner's decision or a check in a live dashboard.

## What the app collects (the source list)

| Data | Where it lives | Why |
| --- | --- | --- |
| **Account identifier:** email address from Apple or Google sign-in (Apple may give a private relay address) | Supabase Auth (`auth.users`) | Signing in, and keeping progress on every device |
| **User ID:** the account's Supabase user id | Every learner table; also RevenueCat's app user id (`Purchases.logIn(userId)`) | Keying progress, purchases and events to the account |
| **Sign-in method** (apple, google) | Supabase Auth metadata; `sign_in_*` events | Sign-in and the sign-in funnel |
| **Time zone** (IANA name, from the device) | `profiles.timezone` | The daily allowance resets at the learner's midnight |
| **Progress and learning data:** levels started and finished, each question's first answer and whether it was right, review schedule and results, XP, levels, daily counts | `user_level_progress`, `user_question_attempts`, `user_review_attempts`, `xp_events`, `daily_allowances` and related tables | Running lessons, review, the daily cap and the profile; improving lessons in aggregate |
| **Purchase status:** whether Unlimited is active, when the period ends, the store | `public.entitlements`, via RevenueCat | Providing Unlimited. No payment details ever reach us |
| **Product analytics events:** the fixed list in `analytics.ts` (app open, onboarding step, level exit card, daily cap seen, sign-in method started/completed, report opened, Unlimited screen and purchase steps, restore, Choose For Me) | `analytics_events`, tied to the user id | Learning and product health. No emails, phone numbers, free text or durations: the client and server both enforce it |
| **Content reports** and their optional note (up to 1,000 characters) | `content_reports` | Fixing mistakes in lessons |

**Not collected:** location, contacts, photos or videos, audio, health or fitness data, browsing or search history, advertising identifiers, crash logs or diagnostics (there's no crash-reporting SDK), payment card details. No tracking and no ads.

**Confirm (owner):**

1. **Names from Apple and Google.** The app asks Apple for the email scope only (`app/src/auth/idToken.ts`), never the name. Google's ID token usually does include the name and profile picture URL, and Supabase Auth normally copies ID-token claims into the user's metadata. Check a Google test account in the Supabase dashboard (Authentication → Users → the user's raw metadata). If a name is there, declare **Name** below (linked, App functionality), or ask for a change that stops storing it. The drafts below assume **no name**.
2. **IP addresses and server logs.** Supabase keeps request and auth audit logs that include IP addresses, and RevenueCat sees the device's IP when it calls its servers. The stores generally don't ask you to declare routine server logs that aren't used to locate or profile anyone, but confirm with Supabase's and RevenueCat's current guidance.
3. **RevenueCat's own collection.** RevenueCat's App Privacy guide says to declare **Purchase History** (App functionality, Analytics), plus **User ID** when your app user id is tied to an account (ours is), and **Device ID** only if you use advertising-id integrations (we don't). Re-check their guide for the SDK version you ship.
4. **Analytics retention.** `analytics.md` suggests deleting raw events after 13 months; the privacy policy has a bracket for it. Decide before submitting.

## Apple: App Privacy ("nutrition label")

App Store Connect → your app → App Privacy. Answer **"Yes, we collect data from this app."** For every type below: **Used for tracking: No.** No data is used for third-party advertising, your own advertising or marketing, or product personalization beyond running the app.

| Apple data type | Collected | Linked to the user | Tracking | Purposes |
| --- | --- | --- | --- | --- |
| Contact Info → **Email Address** | Yes (Apple or Google sign-in) | Yes | No | App Functionality |
| Contact Info → **Phone Number** | No (phone sign-in is off at launch; answer Yes if it's ever turned on) | | | |
| Identifiers → **User ID** | Yes | Yes | No | App Functionality, Analytics |
| Purchases → **Purchase History** | Yes (Unlimited status, via RevenueCat) | Yes | No | App Functionality, Analytics |
| Usage Data → **Product Interaction** | Yes (progress, answers, review, the analytics events) | Yes | No | App Functionality, Analytics |
| User Content → **Other User Content** | Yes (content reports and notes) | Yes | No | App Functionality |
| Everything else (Name, Location, Health, Financial Info, Contacts, Browsing/Search History, Sensitive Info, Diagnostics, Device ID, Other Data) | No | | | |

- **"Other User Content"** fits reports best. If you'd rather treat them as support messages, use **Customer Support** instead; don't declare both.
- **Time zone** isn't one of Apple's data types and isn't location, so it isn't declared. **Confirm** if you disagree.
- **Privacy Policy URL:** the published `privacy-policy.md` (also `EXPO_PUBLIC_PRIVACY_URL`).
- **Account deletion:** Apple requires in-app deletion for apps with sign-in. BrainScroll has it: Profile → Delete account.

## Google Play: Data safety

Play Console → App content → Data safety.

### Overview answers

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes.** The app talks to Supabase and RevenueCat over HTTPS only. **Confirm** no plain `http://` endpoint is configured. |
| Do you provide a way for users to request that their data is deleted? | **Yes.** In the app: Profile → Delete account, which removes the account and all linked data at once. |
| Account creation methods | OAuth: Sign in with Google and Sign in with Apple. No username or password. |
| **Delete account URL** (required by Play for apps with accounts) | **Owner must provide.** A public web page that explains how to delete your account and data, with a way to request it without the app (for example a contact form or email). It can live next to the privacy policy. |
| Data deletion without deleting the account (optional) | Not offered separately. Say no, or point to the same page. |

**Shared:** Play counts data as "shared" only when it goes to a third party for that party's own use. Supabase and RevenueCat process data on our behalf as service providers, so nothing is **shared**. Answer "Shared: No" for every type.

### Data types

| Play category → type | Collected | Shared | Processed ephemerally | Required or optional | Purposes |
| --- | --- | --- | --- | --- | --- |
| Personal info → **Email address** | Yes | No | No | Required (it comes with Apple or Google sign-in) | App functionality, Account management |
| Personal info → **Phone number** | No (phone sign-in is off at launch) | | | | |
| Personal info → **User IDs** | Yes | No | No | Required | App functionality, Analytics, Account management |
| Financial info → **Purchase history** | Yes | No | No | Optional (only if the learner buys Unlimited) | App functionality, Analytics |
| App activity → **App interactions** | Yes (progress, answers, review, analytics events) | No | No | Required | App functionality, Analytics |
| App activity → **Other user-generated content** | Yes (content reports and notes) | No | No | Optional | App functionality |
| All other types (name, location, contacts, photos, audio, files, calendar, health, messages, web browsing, installed apps, crash logs, diagnostics, device IDs) | No | | | | |

If the name check in *Confirm* item 1 finds names from Google, add Personal info → **Name** (collected, not shared, optional, App functionality and Account management).

## Apple age rating

App Store Connect → App Information → Age Rating. Apple's current questionnaire (checked against Apple's "Age ratings values and definitions" page, 2026-09-26; **confirm** the wording when you fill it in, it changes):

| Question | Answer | Why |
| --- | --- | --- |
| Parental Controls | No | |
| Age Assurance | No | |
| Unrestricted Web Access | No | No browser; only links to the privacy policy, terms and store subscription pages |
| User-Generated Content | No | Content reports go only to us; nothing a learner writes is shown to anyone else |
| Messaging and Chat | No | |
| Social Media | No | Friends and leaderboards are post-MVP and not built |
| Advertising | No | |
| Profanity or Crude Humor | None | |
| Horror/Fear Themes | None | |
| Alcohol, Tobacco, or Drug Use or References | **None or Infrequent: you decide** | Factual, non-promotional mentions: Egyptian bread and beer as staple food, fermentation making alcohol in chemistry, tobacco as a health risk in the Human Body tree, medicines in chemistry. Apple's definition covers "references to ... consumption", so **Infrequent is the cautious answer, and it raises the rating to 13+.** |
| Medical or Treatment Information | None | The Human Body tree explains how the body works and, occasionally, public-health facts; it gives no diagnosis, medication or treatment guidance. **Confirm.** |
| Health or Wellness Topics | **Yes (cautious)** | A few levels list heart-health behaviours (eat better, move more, don't smoke, sleep). Apple's example is lifestyle recommendations. Yes gives 9+. |
| Mature or Suggestive Themes | **Infrequent** | Apple lists "war or political strife" and "real-world crimes" here. History trees cover wars, conquest, slavery, executions, plague and sacrifice; the Government tree covers courts, elections and international law. All factual and presented neutrally. Infrequent gives 9+. |
| Sexual Content or Nudity | None | The Human Body tree covers puberty and reproduction as biology, text only. Art history names works such as *Nude Descending a Staircase* (an abstract painting). **Confirm** no level art shows nudity. |
| Graphic Sexual Content and Nudity | None | |
| Cartoon or Fantasy Violence | None | |
| Realistic Violence | None | Wars and executions are described in text, briefly and factually; nothing is depicted. **Confirm** no level art shows combat or injury; if any does, answer Infrequent (13+). |
| Prolonged Graphic or Sadistic Realistic Violence | None | |
| Guns or Other Weapons | None | Weapons appear only as historical facts in text. **Confirm** against the level art. |
| Gambling / Simulated Gambling | No / None | |
| Contests | None | No competition between users. (Apple's examples mention trivia quizzes; BrainScroll's questions are personal learning checks with no rankings, but **Infrequent** is harmless: it stays at 4+.) |
| Loot Boxes | No | |

**Expected rating: 9+** with these answers; **13+** if you answer Infrequent for alcohol or realistic violence. Either is fine for an app aimed at 13 and over.

## Google Play: IARC content rating

Play Console → App content → Content rating → start the questionnaire. Category: **Reference, News, or Educational**. The IARC wording differs slightly by version; these are the intended answers:

| Topic | Answer | Notes |
| --- | --- | --- |
| Violence | No depictions of violence | History is described in text (wars, executions, sacrifice), factually and without detail. If a question asks about *references* to real violence in an educational context, answer Yes there. |
| Sexuality / nudity | No | Human reproduction and puberty are covered as biology, text only. |
| Language (profanity) | No | |
| Controlled substances (drugs, alcohol, tobacco) | References only, no use shown or encouraged | Same factual mentions as the Apple answer above. Answer the "references" question Yes if the form separates references from depictions. |
| Crude humour | No | |
| Gambling (real or simulated) | No | |
| Users interact or exchange content | No | Reports go only to the developer. |
| Shares the user's location with others | No | |
| Digital purchases | Yes | The Unlimited subscription |
| Unrestricted internet access | No | |
| Sensitive or controversial topics | Educational content on history, politics and government, presented neutrally | Answer as the form allows; Play's "controversial topics" questions are about promoting a view, which BrainScroll doesn't. |

**Expected result:** ESRB Everyone or Everyone 10+, PEGI 3 or 7, with "In-App Purchases" noted. The questionnaire assigns the final ratings; re-run it after any big content change.

**Target audience (Play):** 13 and over (see `store-listing.md`). If you ever choose younger age groups, Google's Families policy and COPPA apply (`privacy-policy.md`, *Children*).
