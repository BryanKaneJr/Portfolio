# BrainScroll Privacy Policy (draft)

> **Draft for the owner.** It describes what the app actually collects as of 2026-10-02 (from the database schema and the analytics catalog), including social. It has not had a legal review; have it reviewed before launch. `npm run site:build` publishes it as `/privacy` on the BrainScroll site, filling the `{{...}}` items from the site's environment (`SITE_OPERATOR`, `SITE_ADDRESS`, `SITE_CONTACT_EMAIL`, `SITE_EFFECTIVE_DATE`), so personal details never go in this repo. This note isn't published. Update the policy whenever the data we collect changes.

**Effective date:** {{EFFECTIVE_DATE}}
**Who we are:** BrainScroll is operated by {{OPERATOR}}, {{ADDRESS}}. Contact: {{CONTACT_EMAIL}}.

## The short version

- You need an account to use BrainScroll, so we keep your sign-in details and your learning progress.
- We use your data to run the app and to improve lessons. We don't sell it, share it for advertising, or show ads.
- We measure learning (what you finished, what you got right), never how long you spend in the app.
- Other learners see only what you'd expect in a learning game: your username, avatar, levels, XP, streak and trophies, and moments like a trophy you earned. Never your email or anything else about your account.
- You can delete your account and all of its data from inside the app, at any time.

## What we collect

**Account details.** How you signed in and the identifier that comes with it: the email address and account identifier from Sign in with Apple or Google (Apple may give us a private relay email instead of your real one). We also store your time zone, so your day's levels reset at your midnight.

**Learning progress.** The levels you've started and finished, your answers to questions (which option you chose, whether it was right the first time), your reviews (scheduled reviews and the chapters you go back over), Weekly Quest progress, trophies, XP and levels, and how many new levels you've done each day.

**Your social profile.** Everyone gets a generated username (like `curious_otter_4821`), a random avatar and an invite code; you can change the username and avatar. We also keep your friends, friend requests you've sent or received, people you've blocked, which weekly league you're in, and the Dr. Scroll reactions you give to moments in the feed.

**What other learners see.** Only your friends and the people in your current weekly league can see you, and only: your username and avatar, your brain level and your level in each skill, your total XP, this week's XP and league place, your learning streak, the trophies you've earned, and recent moments (a trophy earned, a chapter finished, a streak milestone, a league podium). They never see your email, how you signed in, your answers, or anything else. Someone you've blocked, or who has blocked you, can't see you at all. Anyone who knows your exact username or invite code can find you to send a friend request.

**Reports.** When you report a problem with a card or question, we keep the report, what it's about and any note you write. When you report another learner, we keep who reported, who was reported, the reason and any note; the person you report is never told who reported them. We use reports to fix lessons and to keep BrainScroll friendly, for example by resetting an offensive username.

**Product analytics.** A small, fixed list of events: the app opened, onboarding steps completed, a level left unfinished (which card), the daily limit reached, the sign-in method chosen, the report form opened, the Unlimited screen and purchase steps, Choose For Me, Weekly Quests viewed, started and finished, chapter reviews started and finished, and that a trophy or streak was shared (which one, never where or to whom). Events never include your email, phone number or anything you type, and we don't record time spent.

**Sharing.** Sharing is optional and happens only when you tap Share. The trophy or streak card is made on your phone and goes through your phone's share sheet to the app you pick. It carries no name, email or account identifier, and it doesn't pass through our servers.

**Subscription status.** If you buy Unlimited, we keep whether it's active, when the current period ends, whether it renews, the plan and the store. Apple or Google handles payment; we never see your payment details.

**Crash reports.** If the app crashes, a report of what went wrong in the app's code is sent to Sentry so we can fix it. It carries no name, email, phone number, IP address or account identifier.

**Reminders.** Daily reminders are scheduled on your phone, at the times you choose, only if you turn them on. Their timing and your notification permission stay on your device.

**Our website.** The BrainScroll website, including the pages invite links open, uses no cookies, analytics or trackers. Our hosting provider keeps routine request logs (such as IP addresses) to run and protect the site.

**What we don't collect:** your contacts, location, photos, microphone or camera, advertising identifiers, or data from other apps. Inviting friends uses a link you share yourself; we never read your contacts. BrainScroll doesn't track you across other companies' apps or websites.

## How we use it

To sign you in and keep your progress on every device; to run lessons, reviews and the daily limit; to run friends, weekly leagues (including their XP prizes) and the feed; to provide Unlimited; to find and fix mistakes in lessons; to act on reports and keep usernames friendly; and to understand, in aggregate, which lessons work well.

## Who processes it

- **Supabase** hosts our database and sign-in ([Supabase privacy policy](https://supabase.com/privacy)).
- **Apple and Google** if you sign in with them, and for in-app purchases.
- **Sentry** receives crash reports ([Sentry privacy policy](https://sentry.io/privacy/)), with nothing that identifies you.
- **Cloudflare** hosts our website and the pages invite links open ([Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/)).
- **RevenueCat** manages subscription status for purchases ([RevenueCat privacy policy](https://www.revenuecat.com/privacy)). It knows your BrainScroll account id and your purchase history, not your name or email.

We don't sell personal data, and we don't share it for cross-context behavioral advertising.

## How long we keep it

Until you delete your account. Deleting your account permanently removes your account and everything linked to it: progress, answers, reviews, XP, your username, avatar, friends, requests, blocks, league places, reactions, reports, analytics events and subscription status. Friends and league mates simply stop seeing you. Raw analytics events are deleted after 13 months even if you keep your account.

## Your choices and rights

- **Delete your account:** Profile → Settings → Delete account. It's immediate and can't be undone. Deleting your account doesn't cancel an Unlimited subscription; cancel that in your App Store or Google Play settings. If you can't use the app, email {{CONTACT_EMAIL}} from your account's email address and we'll delete it for you.
- **Change what others see:** change your username or avatar in Profile → Edit profile, remove a friend or block someone from their profile.
- **Access or correct your data:** email {{CONTACT_EMAIL}}.
- Depending on where you live (for example the EU, UK or California), you may have further rights, such as to receive a copy of your data or to object to processing. Contact us and we'll respond within the time the law requires.

## Children

BrainScroll is for people aged 13 and over and isn't directed to children under 13. We don't knowingly collect personal data from children under 13. If you believe a child under 13 has an account, email {{CONTACT_EMAIL}} and we'll delete it.

## Changes

We'll post any changes here and update the effective date. For significant changes we'll tell you in the app.
