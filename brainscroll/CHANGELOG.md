# BrainScroll changelog

Concise record of completed work. Newest first. Product rules live in `docs/specs/` (`CURRENT_PRODUCT_DECISIONS.md` wins over older wording).

## 2026-10-03: Unlimited leads when Brainpower runs out

- **The out-of-Brainpower screen offers Unlimited first** (owner: "unlimited needs to appear more"): a highlighted card with the gold brain, the price and a See Unlimited button, right after Dr. Scroll. Still only after a day's learning, never mid-lesson.
- **The ways to earn more shrink to one row of icons** (streak, trophies, chapter reviews, perfect levels) with the refill time; "Review what I learned" becomes a secondary button.

## 2026-10-02: A quieter, more premium type scale

- **Headlines and big numbers are about 20 to 25% smaller and tighter** ("Knowledge reinforced" fits one line), labels are quieter, and buttons read in sentence case ("Next: Level 2") instead of spaced capitals. Lessons stay a size up for reading: paragraphs 19 pt, key ideas 19 pt bold, answer choices 17 pt. Still Nunito; the owner chose this over the old scale and over Plus Jakarta Sans after seeing all three on real screens. `docs/design-system.md` has the new scale.
- **A new trophy's card shares with one tap anywhere on it,** marked by a small round share icon in its corner, instead of a big Share button that made the card tall.

## 2026-10-02: Brainpower you earn flies to your balance

- **Each +1 now travels:** on Level Complete and after a chapter review, a spark lifts off the line that earned it (a trophy, the streak, the lucky drop, the review), arcs up to a Brainpower chip pinned top right, and the number ticks up with a small pulse and tick. Two awards fly one after the other. At 10 the spark still lands but the number stays and the chip says "Full". With Reduce Motion the number just changes.
- The chip starts at the balance before the awards and ends on the server's number, so it never shows a count the server didn't return.
- The spark is a glowing pink and violet dot until the owner's `ui_brainpower-spark` art arrives; the images still to make are listed in `docs/images-brainpower.md`.

## 2026-10-02: Brainpower replaces the daily cap

- **Free learners now have Brainpower** (owner, 2026-10-02): 🧠 refills to 5 each day (more is kept), holds at most 10, and a new level uses 1 when it's first cleared. Reviews, replays, chapter reviews, social and wrong answers cost nothing. New accounts start at 5 (the first-day bonus of 10 is gone).
- **Ways to earn +1:** extending the streak (once a day, from day 2), every trophy, a chapter's first completed chapter review, and a 10% truly random drop after a perfect first clear. Anything earned at 10 isn't kept ("Brainpower Full"). Unlimited is ∞ Brainpower.
- **Server:** migration `20261031000000_brainpower.sql` adds `user_brainpower` and `brainpower_awards` (RPC-only, deleted with the account), spends and grants in triggers, and `daily_status_for` now reports the balance and what an action earned. Existing trophies and chapter reviews are recorded as already paid, so nobody gets a windfall. `brainpower.test.sql` covers refill, cap, spending, every award and Unlimited.
- **Core:** `brainpower.ts` mirrors it for local play; `BRAINPOWER` replaces `DAILY_FREE_NEW_LEVELS` and `FIRST_DAY_NEW_LEVELS`.
- **App:** Brainpower sits beside the streak flame on the World Map, built the same way: a brain and the count (∞ on Unlimited) that opens its own screen with the balance, the refill and the ways to earn more. It uses the 🧠 emoji until the owner's art arrives (`docs/images-brainpower.md`). Skill maps show "🧠 7 / 10"; Level Complete and chapter reviews show each +1; Daily Knowledge Complete became the out-of-Brainpower screen with the ways to earn more; welcome, Settings and Unlimited copy say Brainpower.
- **After merging:** run `supabase db push` on staging.

## 2026-10-02: Database hardening from Supabase's security advisor

- **Nothing that runs with elevated rights is callable without signing in.** `get_level_bundles` (granted to signed-out callers before accounts were required), `log_events` and `report_content` are now for signed-in learners only, and trigger functions can't be called directly at all. Migration `20261030000000_function_hardening.sql`.
- **Every function pins its search path**, so names can't be shadowed: 13 small helpers didn't.
- `security.test.sql` checks both for every function, so a new one can't slip through.
- **The app typechecks on newer React Native types:** `Field` dropped a `style` prop no screen used, which those types rejected.

## 2026-10-02: Docs for the launch setup

- **Sign in with Apple on iPhone needs only the bundle id** in Supabase (Client IDs `app.brainscroll`, no secret key); `docs/supabase-setup.md` says so. The Services ID and key are only for Android and web.
- **The release checklist** tests that a level left partway starts over (it still asked for the old resume).

## 2026-10-02: iPhone builds can receive pushes

- **The `expo-notifications` plugin is now in `app.json`.** Without it iOS builds had no push entitlement, so social notifications could never reach an iPhone; it also gives Android notifications Dr. Scroll's silhouette in brand purple. Needs a new build. `docs/notifications.md` says to deploy `send-push` from `backend/`, where the project is linked.

## 2026-10-02: Generated usernames always pass the filter

- **A generated username could be one the filter refuses:** 22 of the 10,000 number suffixes read as blocked words once look-alike digits count as letters (`8008`, `7175`), so about 1 new learner in 450 got a name the admin's queue then flagged (and the moderation reset could hand out another). `generate_username` (migration `20261029000000_generated_username_filter.sql`) and the development harness now skip those. `social.test.sql` checks 5,000 generated names.
- **Google sign-in loads on first use, not at launch:** a build without its native part no longer crashes on start in Supabase mode; it just doesn't offer Google.
- **`npm run supabase:check` no longer crashes on Windows** as it exits.

## 2026-10-02: Migrations apply cleanly on hosted Supabase

- **`supabase db push` stopped at the social migration** ("unsafe use of new value LEAGUE_FINISH"): it added the league-prize ledger type and used it in the same file, and Supabase applies each file in one transaction. The new value now has its own migration (`20261021500000_league_finish_type.sql`), applied first.
- **`npm run test:db` now applies each migration in one transaction**, as Supabase does, so this can't slip through again.

## 2026-10-02: A level left partway starts over

- **Closing a level partway forgets it** (owner: "if you close a level, you start back at the beginning of it when you reopen it"). The level in progress lives only while it's open, and is never saved to the device, so closing, going back or quitting the app means it opens on its first card next time. Skill maps no longer say "Resume". Old saved positions are cleared on sign-in.
- **Dr. Scroll checks first:** leaving after the first card, or after any answer, shows "Heading out? If you leave now, this level starts over from the beginning next time." with **Keep going** and **Leave anyway** (new spot `lesson.leave`). Leaving from the first card, before answering anything, just leaves.
- **Starting over never changes what a level pays:** first attempts are still recorded on the server when checked.

## 2026-10-02: Crowned Dr. Scroll on the launch screen

- **The launch screen shows crowned Dr. Scroll** (owner: "use the same Dr. Scroll image... the png I gave you for the Android icon, instead of the minimalist one"). `splash-mark.png` is now that art, trimmed to the character; the native splash and the in-app `BrandSplash` share it. The minimalist `splash-mark.svg` is gone. Like the app icon, the native splash only changes with a new build.
- **The website's two side-by-side phones** are bigger, with a slim frame that keeps a real phone's shape.

## 2026-10-02: Plain random Choose for me, and two Dr. Scroll touches

- **Choose for me is plain random** (owner: "pick completely at random now... just the next level of a random tree"). Every skill with a level left is equally likely, whatever its subject or progress, including the one you're on. "Pick again" never shows the same skill twice in a row. Core `chooseForMe`.
- **"Take another look, then choose again."** The wrong-answer line no longer says "below", since the cards can sit above it.
- **Mind & Reasoning's region shows Dr. Scroll with his idea pose** instead of thinking, whose frown read as sad.

## 2026-10-02: Dr. Scroll is a guest on card pictures, not a stand-in

- **Dr. Scroll no longer fills every card without a picture** (owner: "Drscroll was supposed to be used supplementally in the levels. Not replace all relevant images... I'd like to not spam drscroll"). He now shows on at most one learning card a level, in about two levels out of five, and never in a level where he already has an aside: about one learning card in ten. Other cards without a picture show none. Core `mascotPictureCard`, with a test that holds him near one card in ten.
- **207 more cards have their own picture** (1,822 in all, up from 1,628). Every remaining card was compared against all 754 images, keeping only images that show what the card is about: not a passing mention, a metaphor, or a different thing with the same name. Examples: Dalí's melting clocks, the Sydney Opera House, Pavlov's bell, the trolley problem. Most of the remaining cards are about ideas no image in the library shows; new images are what would raise coverage further.
- **Gradients reach the right edge on phones.** Gradient fills now measure their box and draw at that exact size, instead of relying on percentage sizes that some devices stopped short of.

## 2026-10-02: Friend and league notifications

- **Real push notifications from the server** for:
  - a friend request ("@ana wants to be friends on BrainScroll.");
  - a new friend ("You and @ana are friends now. See how you compare!");
  - someone passing you in your league ("@kofi just passed you by 30 XP. One level could put you back in front.");
  - your league result ("You finished 2nd and won 500 XP! A new league starts now.");
  - reactions to your moments.
- **Database triggers queue each one** in `notification_outbox` (migration `20261028000000_social_push.sql`). The new `send-push` function, run by a cron job every 5 minutes, sends them through Expo:
  - only with the switch on and a device registered;
  - between 9 am and 9 pm local;
  - at most 4 a day, one per kind ("@ana and 2 others…");
  - a note that waited over a day is dropped.
- **Weeks now close on schedule.** `send-push` closes finished weeks first (`finalize_due_leagues`), so results arrive Monday, not whenever someone next opens Social.
- **App:** the device registers its push token when a signed-in learner opens the app and forgets it on sign-out. A tap opens Social, the league or the friend's profile. Settings has a new "Friends and leagues" switch, on by default.
- **Tested:**
  - `push.test.sql` covers every event, the once-a-day "passed", quiet hours, the daily cap, grouping, expiry, the switch, and that learners can't read or send anything;
  - `scripts/test/push.test.ts` covers the copy, including a no-guilt check, plus the Expo messages and the cron secret;
  - account deletion covers the two new tables.
- **Docs:** `docs/notifications.md` has the owner setup (Apple push key via EAS, Firebase for Android, deploying the function, the cron job). The privacy policy and store answers now cover push tokens, and Expo is listed as a processor.

## 2026-10-02: The brainscroll.app home page

- **A real home page in the repo** (`site/src/index.html`, `home.css`). Canva's website generator produced a layout with no text at all, so the owner chose to build it here. It has:
  - the hero, "Stop scrolling. Start leveling.", with Dr. Scroll waving beside the Home screen;
  - how it works, using real lesson, question and level-complete screens, each shown in a phone frame with a notch, a status-bar strip and a home bar so nothing is clipped;
  - your brain growing (profile and skill map);
  - weekly leagues with friends;
  - all 26 skill trees with their avatars, grouped by subject;
  - "free to learn, for real";
  - privacy and account-deletion links in the footer.
- Store buttons appear once `APP_STORE_URL` / `PLAY_STORE_URL` are set; until then it says "Coming soon to iPhone and Android".
- It works from phone to desktop with no sideways scrolling, uses system fonts, and loads nothing from other sites.
- **The new app icon** (owner, 2026-10-02: "I love the icon"): the crowned Dr. Scroll holding his scroll (`DrScrollIcon.png`).
  - It's now `app/assets/images/icon.png` (iOS and the Expo fallback) and the website's tab, home-screen and header icons.
  - **Android** uses the owner's transparent crowned Dr. Scroll as the adaptive icon's foreground, sized into the middle 60% so every launcher shape (circle, squircle, teardrop) keeps the whole crown. The background is the iPhone icon's purple, and there's a one-colour silhouette for Android 13 themed icons.
- **The 3D crowned icon** (the owner's pick of the marketing art) leads the closing "Free to learn" section, and is the link preview image (`og.png`) for the home page and invite links, so a pasted link shows it in iMessage and other apps.
- **One Cloudflare Pages project serves both domains:** `brainscroll.app` (home, privacy, delete account) and `invite.brainscroll.app` (invite links). The app's privacy link is now `https://brainscroll.app/privacy`. Setup is in `docs/invite-links.md`.

## 2026-10-02: Privacy policy and account deletion, published

- **The privacy policy covers social now:**
  - the username, avatar and invite code;
  - friends, requests, blocks, leagues and reactions;
  - exactly what friends and league mates can see (and that they never see your email);
  - learner reports, and that the reported person is never told who reported;
  - the website having no cookies or trackers;
  - Cloudflare as a processor, and 13+ only.
- **13-month analytics retention, enforced.** The policy now promises it, so the server does it: `purge_old_analytics()` deletes old events in batches, `log_events` runs it now and then, and a nightly job runs it where pg_cron is enabled (migration `20261027000000_analytics_retention.sql`, tested).
- **Published on the site.**
  - `npm run site:build` renders `docs/privacy-policy.md` into `/privacy` and adds `/delete-account`, the web deletion page Google Play requires.
  - The operator's name, address, contact email and effective date come from the host's environment (`SITE_*`), never the repo. A test checks the repo copy has no email address in it.
  - The app's privacy link points at `https://invite.brainscroll.app/privacy` (`app/eas.json`).
- **Store answers updated for social** (`docs/store-privacy.md`):
  - usernames and reactions are now declared as user content;
  - Apple's User-Generated Content answer is now Yes, with the filter, report, block and moderation queue that guideline 1.2 asks for;
  - Google's "users interact" answer is now Yes.

## 2026-10-02: brainscroll.app

- The owner registered **brainscroll.app** on Cloudflare. The home page will be made in Canva, and invite links live at **invite.brainscroll.app** on Cloudflare Pages, since Canva can't serve the files phones need to open the app.
- Every build profile now sets `EXPO_PUBLIC_INVITE_DOMAIN=invite.brainscroll.app` (`app/eas.json`), so invites are `https://invite.brainscroll.app/invite/CODE`. The setup steps are in `docs/invite-links.md`.

## 2026-10-01: Moderation, a real username filter, and invite links that work for everyone

- **Username filter.** The old crude word list blocked innocent names (anything with "grape" in it) and didn't run at all in local play. It's now a curated list with the usual normalisation:
  - look-alike digits (`sh1t`), repeated letters (`fuuuck`) and spaced-out letters (`f_u_c_k`) are caught;
  - innocent words that contain a term (`grape`, `therapist`, `scunthorpe`) pass;
  - short terms that hide inside ordinary words (`dick` in `dickens`, `cock` in `cocktail`) only count as a whole word.

  It runs on the server (`username_blocked`, migration `20261026000000_username_filter.sql`) and in the app (core `usernameFilter`, so Edit profile says so instantly). A test keeps the two lists identical. See `docs/moderation.md`.
- **Learner reports in the Content Admin.** `npm run insights:pull` now also pulls open learner reports and existing usernames that fail the filter. The admin's new **Learner reports** view lists them, most reported first. Who reported is never shown.
  - **Reset username** gives the learner a fresh generated name and closes the username reports about them.
  - Other reports can be marked Resolved, Triaged or Dismissed.

  Server: `admin_user_reports`, `admin_set_user_report_status`, `admin_reset_username` and `admin_flagged_usernames`, callable by the service role only.
- **Invite links for people without the app.** With `EXPO_PUBLIC_INVITE_DOMAIN` set, invites are `https://<domain>/invite/CODE`:
  - With the app installed, the link opens it straight to the invite (iOS Universal Links, Android App Links).
  - Without it, the link opens a small private page (`site/`, built with `npm run site:build`) with the store button for that phone and the code to enter after installing.
  - The build writes the two verification files from public IDs. Owner setup is in `docs/invite-links.md`.
- **An invite opened while signed out** now waits through sign-in and opens right after, instead of being lost. Its Continue button goes Home, so a brand-new learner still gets onboarding.
- The admin's live-project calls now send a new `sb_secret` key the same way `insights:pull` does (as the apikey only).
- Tested: core and SQL filter tests (every generated username passes), moderation SQL tests, admin server tests, site build tests, and an e2e check that an invite opened signed out opens after sign-in.

## 2026-10-01: Home in the middle of the tab bar

- **Tabs, left to right: Skills, Review, Home, Social, Profile** (owner). Home stays the first screen at launch, and Back from another tab still returns to it.

## 2026-10-01: Your avatar in your brain, and Edit profile

- **No letter avatars.** Every account is given a random tree avatar when it's created. Migration `20261025000000_starter_avatars.sql` adds `random_starter_avatar`, assigns one as each profile is made, backfills everyone without one, and makes `set_avatar` refuse null. "Use my initial" is gone from the picker. In local play, you and every simulated learner wear one too.
- **No ring around avatars.** The art is its own circle, so the league podium's gold, silver and bronze rings are gone (the prize text keeps its colour).
- **Profile:** your avatar sits in the centre of your brain ring, with your Knowledge Level in a rank pip at its lower right (a bigger version of each subject icon's pip, so it reads as part of the ring), and your @username under the ring.
- **Edit profile** opens from a pencil at the top right of Profile (and from your avatar on Social or your own profile page). It holds your avatar, your username and your title. The username and avatar cards left Add friends.
- **Social:** a friend request's name gets its own line, with Accept and Not now below, so a username no longer squeezes into a column of letters.
- Tested in `social.test.sql` (a starter avatar at sign-up and on first use; null refused) and both e2e suites (Edit profile, the username change, a starter avatar with no way back to a letter).

## 2026-10-01: Legendary avatars

- **14 owner-made legendary avatars**, one per top gold trophy, in a gold laurel ring on plum. They unlock with their trophy:
  - Master of All: a golden Dr. Scroll, the one avatar he appears in;
  - Jack of All Trades: a gold jack card;
  - the six subject masteries;
  - A Thousand Levels, Fifty Chapters, 1,000 Perfect Lessons, Steel Trap, Quest Legend and 1,000 Days.
- They have their own section in the avatar picker, each locked with "Earn the <trophy> trophy to unlock" until earned. The server checks it: migration `20261024000000_legendary_avatars.sql` with `legendary_avatar_trophy`, mirroring core `LEGENDARY_AVATARS`.
- **League banner:** the number on the medal is gone; "11th place" beside it says it.

## 2026-10-01: A league banner worth tapping

- **The banner is a violet gradient card with a chunky edge**, not a plain card. The medal from the UI set sits beside "11th place", and becomes the trophy when you're in the top 3. Owner: no number on the medal; the place is already written beside it.
- **It says how close the next place is:** "98 XP to pass @kofi", or "You're leading. Hold on to it!" in 1st.
- **A mini podium along the bottom** shows the current top 3's avatars in gold, silver and bronze rings, each with the prize they're on course for (+1,000 / +500 / +250 XP).

## 2026-10-01: Avatars

- **52 owner-made avatars in the app:** one per tree, all open from the start, and a gold one per tree that unlocks at Level 100 (mastery).
- **Your avatar** opens from three places: the Social header, the Add friends card, or tapping yourself on your profile. The picker groups the trees by subject. Gold avatars sit in their own section, locked ones dimmed with "Master <tree> to unlock".
- **Shown everywhere you appear:** leagues, the feed, friend requests and friend lists, and profiles. Without an avatar, you show as your initial. In local play, the simulated learners wear avatars too.
- **Server:** migration `20261023000000_avatars.sql`, adding `profiles.avatar`, `set_avatar` (which checks that gold needs mastery) and the avatar on every learner card. Core: `avatarIdFor` and `avatarUnlocked`. Tested in `social.test.sql`, core unit tests and both e2e suites.

## 2026-10-01: Social: friends, leagues and a feed

Owner: "friends and leagues or some social aspect are a must before launch if we want the app to spread." Recorded in CURRENT_PRODUCT_DECISIONS §22; CLAUDE.md, product rules and the older social spec updated.

- **A Social tab** (medal icon, between Skills and Review) with:
  - the league banner on top: name, your place, your XP, days left, the prizes;
  - friend requests;
  - "This week with friends", ranked by XP;
  - the feed.
- **Leagues:** weekly, up to 20 learners matched by brain level.
  - Matching: within 20% of each other, and anyone under Level 100 is fair game. A safety net puts a learner with no match in a league still under 5.
  - The standings screen marks the prize places. When the week ends, the top 3 earn **1,000 / 500 / 250 XP** (`LEAGUE_FINISH`), and Social shows "Last week: 1st in your league!"
- **Friends:**
  - Share an invite link (`brainscroll://invite/CODE`; whoever opens it becomes your friend), or search an exact username, or enter a code.
  - Everyone gets a friendly username (curious_otter_4821) and can change it under Add friends.
- **Feed:** 14 days of trophies, finished chapters, streak milestones and league podiums from you, your friends and your league.
  - It's derived from existing records, so nothing is stored twice.
  - Reactions are Dr. Scroll poses only (Applause, Celebrate, Nice one, Wow, Genius): React opens them large, with their names. No comments, no messages.
- **Profiles:**
  - Brain overview, three rarest trophies, and every subject side by side with yours: split down the middle, you on the left and them on the right, with bars growing out from the centre line. The leader's bar and number are green, the trailing side's coral, a tie violet, each lit toward its tip. A bar is full only at 100 levels (then the scale steps to 200, 300...). This follows the owner's markup: no summary sentence.
  - Add friend, Block and Report on every one.
- **Server:** migration `20261022000000_social.sql`, every call through RPCs, with `social.test.sql` covering:
  - usernames and invites;
  - matching, the safety net and the band rule;
  - prizes paid once;
  - the feed, reactions, profiles and blocks;
  - no direct table access.
  The account-deletion test now covers every social table, including other people's rows about the learner.
- **Core:** `social.ts` (the shared rules, unit-tested).
- **Local play:** a simulated league of 12 learners whose XP grows through the week, who accept requests, post moments and react. Your own row, moments and prizes are real.
- **E2E:**
  - local: 12 new checks (league banner, feed, request, reaction picker, standings, a profile comparison, username search, invite code);
  - remote: 8 new checks, against the real migrations (league join, feed, username, request, invite, cascade on delete).
- **Fixed while building:** a safety-net joiner could close a beginners' league to everyone after them; your own moments were labelled "Friend".

## 2026-10-01: "Up next" follows what you play; stronger first-level names

- **Up next follows the last tree you played** (owner: "should always suggest the last tree used, or at the very least a chapter that was left unfinished"). Starting a level now sets it. Opening a skill's map or tapping it on the Skills tab no longer does, so browsing doesn't change Home. When the last-played tree has nothing left to play, it falls back in order: a tree with a level in progress, then a tree with an unfinished chapter (furthest along first), then the furthest along (`useCurrentSkill`).
- **"X in One Level" is now "X: The Big Picture":** every tree's Level 1 except Astronomy ("Your Cosmic Address") and World Geography's six continent levels ("Africa: The Big Picture"). Their syllabus entries changed too, and two recap headlines were reworded ("Philosophy at a glance", "World Religions: the takeaways"). The 31 levels are revision 2, so re-import the content to publish them.

## 2026-10-01: Perfect streak, fresh lines, fixed reminders

- **Perfect streak:** clear a level with every question right on the first try, right after another perfect level, and it pays 1.1×, then 1.2× and so on, up to 1.5×. It works across all skills. Only level first clears count; reviews, chapter reviews and quests neither build nor break it. A level with a miss ends it quietly. Level Complete shows "Perfect!" with what the next one would pay, then "Perfect streak ×1.2 · +20 XP". The bonus is inside the level's one `LEVEL_COMPLETE` event, derived from completed levels (migration `20261021000000_perfect_streak.sql`, core `perfectStreakBefore` / `perfectStreakBonus`, `XP.PERFECT_STREAK_*`), with matching SQL and core tests.
- **Dr. Scroll varies what he says:** 10 to 12 lines for each Level Complete outcome, mastery, replays, Daily Knowledge Complete and Review (`DR_SCROLL_SAYINGS`). They step by level number or day, so the next level or day never repeats the last. Each skill starts at a different point in the list. A test enforces at least 10 lines per moment.
- **No repeated pictures on the skill map:** the map now picks its two floating pictures per chapter. It starts with the level's own image, then that level's card pictures, then the rest of the chapter's, skipping anything already on the tree. All 26 trees now show 20 different pictures, where some showed as few as 14 (Human Body's lungs and bones came back again and again). Core `scenery.ts`; `scripts/test/map-scenery.test.ts` checks every tree for no repeats within three chapters.
- **Reminders that bring people back** (owner: "we want people to use the app"):
  - Asked once on Level Complete after the first level ("Want a reminder to come back?"). Settings keeps just the on/off switch.
  - When on, notes come at 8 am, noon and 7 pm every day, plus 11 pm when today would break a streak.
  - They speak to where the learner is: "Finish Chapter 7 of Astronomy! 3 levels to go.", "Astronomy Level 64 is ready for you.", "4 cards ready for review.", "Keep your 6-day streak going!" After a level today: "Nice work today! You still have 3 new levels to use."
  - A day with nothing left to do gets no more notes. They're planned two weeks ahead on the device.
  - The one line: never a jerk (no guilt, threats or fake deadlines), held by a copy test. CURRENT_PRODUCT_DECISIONS §19 and CLAUDE.md updated.
- **Skills tab:** the label no longer cuts off as "Skil…": iOS measured the letter-spaced label too short, so the letter spacing is gone and it can shrink slightly instead of cutting off. The icon is now the star.
- **Dr. Scroll's headphones pose is gone** (his hair was missing in it).

## 2026-10-01: A picture for each card

- **The right picture above each card:** on big screens, a learning card shows its own picture instead of the level's one image, so Level 4's Jupiter card shows Jupiter, not Saturn. The picks are in `content/card-art.json` (card ID → image ID, outside the levels, so no published revision changes). 1,628 cards have one so far, between 4% (Government) and 54% (Astronomy) of a skill's learning cards.
- **How they were picked:** `npm run card-art -- --suggest` matches each card's words against image names and descriptions and lists up to 3 candidates. Word matching alone was wrong about a quarter of the time ("war" in a treaty card matched a war elephant), so every sheet was reviewed card by card. A pick was kept only when the picture shows what the card is about. `npm run card-art` builds `app/src/content/cardArt.ts`, and `check` fails if it's stale or a pick is invalid.
- **Dr. Scroll fills the gaps** (owner: "I want to avoid having no images if the rest have them"). A card without a picture shows him doing something that fits the skill (`SKILL_ACTION_POSES`: piano, violin, guitar, drums and conducting for Music; telescope, space helmet and juggling planets for Astronomy; diving, sailing and fishing for Oceans). He takes turns with his subject's prop (flask, scroll, brush, wrench) and calm poses (reading, magnifier, idea, explaining). His thinking pose is left out because its frown reads as sad beside a card. He's silent there; a card with his aside gets no second Dr. Scroll. New spot `lesson.card-picture`, core `cardPicturePose`, and `reading` joins the calm lesson poses.

## 2026-10-01: Quest tile on the map

- **This week's quest beside the road:** a tile at the top left of the skill map (after Duolingo's) with the quest's art and a band showing the days left in its week ("4 days"), or "Done" in green once it's finished in its week; tapping opens the quest. Calm by rule (owner's call, recorded in CURRENT_PRODUCT_DECISIONS §9): a plain count, same colour every day, no "only", nothing louder near the end. Shown only while a quest is live.

## 2026-10-01: Chunkier, more colourful chrome

- **Waypoints:** a thicker 3D side, a flat face with one diagonal sheen stripe, and an icon for what the level is (book for a regular level, shield for a checkpoint, flag for Level 50, star for the Mastery Challenge) instead of its number; the number is in the "Start · Level N" callout and the waypoint's label.
- **Chapter banner:** a solid slab in the subject's colour with a chunky edge, ink chosen for contrast.
- **Tab bar:** illustrated icons from the UI set (welcome, level-up, review, profile) in place of system symbols; inactive tabs dimmed. A dedicated set is briefed in `docs/images-chrome.md`.
- **Header:** the streak is a chip in the streak's own colour. **Profile** opens on a full-width deep violet header behind the ring. **Dr. Scroll** stands at his large size beside the path.
- Button gradients softened so they don't compete with the sheen.

## 2026-10-01: Gradients

- **Lit from above:** filled buttons (violet, mint, gold), level emblems and the skill map's waypoints now have a soft top-to-bottom gradient (a lighter tint fading into the colour), and progress bars brighten toward their leading edge. One shared `GradientFill` (`components/ui/gradient.tsx`, react-native-svg, so no new native build) and `lift()` for the lighter tint. Level Complete's "Lv. 0 → 1" now uses the subject colour too.

## 2026-10-01: Skill trees in their subject's colour

- **More colour:** each skill tree now wears its subject's colour (History terracotta, Science blue, Geography teal, Arts pink, World lavender, Mind green) instead of violet: the skill map's waypoints, road, ring and chapter banner; level emblems and progress bars on the Skills tab, subject page and Level Complete (with the level-up card's border and glow); Home's "Up next" frame; and the lesson progress bar. Buttons stay violet and mastery stays gold. Shades derive from one colour per subject (`theme/subjectTheme.ts`); every subject passes AA for its ink and text.

## 2026-09-30: First fixes from the iPhone

- **Back slides the right way:** the Subject and Skill map back buttons navigated forward to the screen behind (so it slid in from the right); they now go back.
- **Report a problem is one step:** "Problem with this lesson?" and a text box; Send waits for a description. Sent as category `other` (the server and the admin queue keep the finer categories).
- **Knowledge ring:** the gap between subject arcs is sized from the stroke, so the rounded ends no longer touch.
- **Skills tab:** one compact list of the skills you're leveling, highest level first (level, name, subject, stars and a thin bar to the next ★), instead of large cards.
- **Settings screen:** plan, sound and haptics, the daily reminder, the account and Delete account moved from Profile to Settings, opened from a button at the bottom of Profile. Docs point to Profile → Settings.
- **Native layout bugs:** the Level Complete progress bar grew into a tall blob and the "Trophy earned" badge frame spread over its text on iPhone (both stretched to fill a column, which the web build ignores). The bar now grows only in rows (`grow`), and the badge takes its slot's width.

## 2026-09-30: Dev server works on Windows

- **Metro finds `@brainscroll/core` by folder too:** on Windows, npm links workspaces with junctions holding an absolute path, so a repo installed from `C:\dev` and run from `C:\Dev` failed with "Unable to resolve @brainscroll/core". `app/metro.config.js` now falls back to `packages/core` directly (tested by breaking the link: the bundle still builds). The EAS project is linked in `app.json`, and `docs/release.md` has Windows notes (path capitalisation, Local Network, firewall, tunnel).

## 2026-09-30: Lesson upload works on a hosted project

- **`npm run content:import` uploads in pieces:** the catalog is about 26 MB, too big for one request to a real Supabase project, so staging got no lessons. It now sends the subjects and skills, then sources and concepts in batches, then 25 levels at a time, with progress lines and up to three retries on network errors or timeouts. Safe to re-run (a second run publishes nothing new). Tested against the real migrations: all 2,600 levels, 4,645 concepts, 7,652 sources and 8 quests. Keys pasted with stray spaces are trimmed.
- **The upload function works on hosted Supabase:** it recalculated every skill's highest published level with an UPDATE that had no WHERE clause, which hosted Supabase refuses ("UPDATE requires a WHERE clause"; local Postgres doesn't). Migration `20261020000000_import_safe_update.sql` limits it to the skills in that upload, and a new check in `npm run check` fails on any such statement in a database function.
- **`npm run supabase:check` counts every published level** (it stopped at the API's 1,000-row cap) and checks for the newest migration's table (`user_learning_days`).

## 2026-09-30: Polish, round 2

- **Trophy moment:** when a trophy is earned (Level Complete, a review, a quest's finish), its badge springs in with a small wobble just after the card arrives, with the unlock haptic; gold trophies then catch the light twice. With Reduce Motion it simply appears and the haptic still marks it.
- **Onboarding "The deal":** the level you picked waits at the top (on phones with room), and the deal reads as four short lines with icons instead of a paragraph.
- **Profile trophies:** open slots show the next trophies to earn, dimmed, instead of "Empty", and open the Trophies screen. The Trophies screen and Profile share one rule for what's next (core `trophiesAhead`).

## 2026-09-30: Art fills the room on big phones

- **Learning cards on large phones:** when a card leaves a lot of empty screen, the level's art now sits above it, sized to the room (120 to 200 pt). Cards that fill the screen, and small phones, show none, and questions never do (the space under a question stays empty on purpose: anything there could give answers away). The card is measured before it shows, so the text never jumps, and re-measured if it reflows (rotation, a resized window).

## 2026-09-30: Chapter reviews pay more; five quest trophy tiers

- **Chapter reviews pay up to 30 XP** (was 15), still scaled by first tries (9 of 10 right is 27). Server (`app_settings.xp_chapter_review_max`) and core (`XP.CHAPTER_REVIEW_MAX`) together, tested on both sides.
- **More quest trophy tiers:** Quester (4), Quest Pro (10), Quest Champ (25) and Quest Legend (52, gold), for weekly quests finished in their week (the first quest already earns its own trophy). They replace the 3 and 10 tiers; derived, so nothing to migrate. SQL and core tested.

## 2026-09-30: Polish, round 1

- **Trophies "Still ahead" is shorter:** one row per series (the next tier only, with "N more after this"), so the list shows what's next instead of every tier.
- **Checkpoint complete uses the owner's art:** the chapter book (the halfway art on Level 50) replaces the plain trophy icon in a violet circle.
- **"Trophy earned" card:** Share sits under the text, so the eyebrow and title no longer wrap on small phones.
- **Level Complete on small phones:** tighter spacing below 720 px tall, so the next step stays closer.
- **Screens:** a scrolled Trophies shot (`trophies-ahead`); swept at iPhone SE and Pro Max sizes.

## 2026-09-30: Learning days dated when they happen

- **Streaks survive time zone changes:** each learning day (a first clear or a scheduled review answer) is now recorded as it happens, in the learner's time zone at that moment, and never re-dated. Before, every past day was re-dated with the current time zone, so moving an hour east could merge two days and take a streak trophy away. Streaks still count calendar days. Server: `user_learning_days` with triggers and a one-time backfill; core: `learningDays`, backfilled on older saves. Tested on both sides.

## 2026-09-30: Overnight review fixes

- **Chapter reviews can't be gamed with replays:** replaying a cleared level shows whether an answer is right, so a script could score 15 every time. A chapter-review first try now counts only if that question wasn't checked outside the review since it started (SQL and core, tested).
- **Empty chapter reviews:** a chapter whose levels were all retired can't be started (`CHAPTER_NOT_AVAILABLE`), and a review with nothing left to answer gives no quest credit.
- **Share only what you hold:** the share screen checks the learner's own shelf, so a deep link can't make a card for a trophy they don't have. Captured share images are cleaned up; the web build no longer says "Copied" when it couldn't copy. A progress reset also clears NEW tags.
- **Quest screens on small phones:** Quest complete now scrolls (on an iPhone SE the Done button covered the extra trophies). The Final Round's card caption names the level the card comes from.
- **Privacy docs** updated for sharing, chapter reviews and the quest and share analytics events.
- **Streak history survives content corrections:** removing a question used to delete every review answer to it, and with them learning days behind the streak and its trophies (which must never be taken away). Answers now stay with the question cleared.
- **Local chapter reviews no longer get stuck** when a correction removes one of their questions (core now counts only questions that still exist, as the server does).
- **Share screen:** a link to a trophy you don't hold, or to a streak of 0, shows "Nothing to share yet" with Close instead of a blank screen.
- **Reviews celebrate trophies:** a scheduled review that earns one (a streak day, Long Memory) shows the "Trophy earned" card; the review-complete screen scrolls on small phones.
- **Reset:** clearing progress forgets which trophies were shown, so re-earned ones are new again and remote doesn't re-celebrate every trophy.

## 2026-09-29: Gold top tiers

- **The top trophy of each counted series is gold** (owner's six new images): A Thousand Levels, Fifty Chapters, 1,000 Perfect Lessons, Steel Trap, Quest Veteran and 1,000 Days. They get the gold art, the gold edge, the gold number outline and the gold "Trophy earned" and share cards, like a mastery: the most of something is its mastery.

## 2026-09-29: Clean gradient outlines, the streak screen, and share from Profile

- **Badge numbers redrawn as vector text** (react-native-svg): a white numeral with a smooth, even outline in a top-to-bottom gradient (light violet to deep violet, gold for mastery, gold to orange for streaks), replacing the rough stacked-text outline. Trophy tiles leave room under the art so a count never runs into the name.
- **The streak screen:** tapping the flame on the World Map (or the streak tiles on Profile) opens it: the current streak big on the flame, current and longest, the six streak trophies (earned ones open their share card), and **Share your streak** ("I'm on a 12-day learning streak on BrainScroll!"). Quiet copy: it says whether today counts, never what could be lost.
- **Share from Profile:** tapping any trophy in Profile's row opens its share card, as on the Trophies screen.

## 2026-09-29: Trophy counts like badges, and NEW tags

- **Counts sit on the art:** a counted trophy's number is now big, bold and outlined, overlapping the lower edge of its image (violet edge, gold for mastery, orange for streaks), on the Trophies screen and on the share card, instead of a small pill or a separate line below. The streak share card has an orange border.
- **NEW:** trophies earned since the learner last opened the Trophies screen carry a NEW tag for that visit (kept on the device, per account).

## 2026-09-29: Share a trophy

- **Share** on the "Trophy earned" card, on a quest's finish, and on every earned trophy in the Trophies screen. It opens the card as it will be sent: the trophy's art, the count big for counted ones ("100" over "day streak", "1,000" over "perfect lessons"), the name, a line like "I hit a 100-day learning streak on BrainScroll!" or "I mastered History on BrainScroll!", and the BrainScroll mark, with the gold edge for mastery. Streak milestones share through their streak trophies (7 to 1,000 days).
- iPhone sends the image with the line; Android sends the image (the line is printed on it); the web build shares or copies the line. Nothing leaves the phone unless the learner sends it.
- Share lines live in core (`trophyShareText`, tested for every trophy). Analytics: `trophy_shared` (trophy id and kind only, never where or to whom). Adds `expo-sharing` and `react-native-view-shot`, so the next phone build needs a rebuild.

## 2026-09-29: The UI image set, and the streak flame

- **Fix:** the owner's UI image set (delivered 2026-09-25) had only its mastery badges and trophy imported. The other 23 are now in `app/assets/images/ui/` (256 px WebP), with the new `streak-ember`.
- **Streak flame:** the World Map header shows the owner's flame once today counts, and the ember while the run is still yesterday's.
- **Placed on screens** (the owner's call on what looks premium): the review cards next to the Review tab's count; the caught-up cards when nothing is due; the unplugged cord on "Couldn't load" and the cloud on the offline screen (in place of Dr. Scroll, who keeps the screens where he speaks); the flame and ember on Profile's streak tiles; the gold star for mastery stars; the empty box when no trophy is earned yet. Tried and cut: level-up, target, calendar, bell and sound, which looked tacked on. Left out on purpose: heart (no lives), chest (no loot), stopwatch (never speed) and gem (XP isn't a currency); share waits for a share feature.

## 2026-09-29: Trophy art

- **All 21 trophy images are in** (the owner's art): the gold Dr. Scroll bust for Master of All, the gold jack of spades, gold subject masteries, and the violet milestones, with the streak flame for the streak trophies. Converted to 384 px WebP (432 KB in all) and wired in `trophyArt.ts`; counted trophies show their number over the shared image. The "Trophy earned" card's image is a little larger.

## 2026-09-29: Streak trophies, and a slot for the streak flame

- **Streak trophies:** One Week, One Month, A Hundred Days, One Year, 500 Days and 1,000 Days in a row. Earned by the longest run ever, so a missed day never takes one away; dated by the day the run reached the tier. Derived like the other milestones (SQL `milestone_trophies`, core `trophies.ts`), tested on both sides, and they get the "Trophy earned" moment.
- **Streak flame:** the World Map header is ready for the owner's flame image (`app/assets/images/ui/streak-flame.webp`, then one line in `uiArt.ts`); the flame icon shows until then. The streak trophies can share it.
- The streak rule now allows these permanent trophies as its only reward (CLAUDE.md, product decisions §19).

## 2026-09-29: "Trophy earned", and a launch-readiness pass

- **Trophy earned:** Level Complete now shows any trophy the level unlocked (First Level, Chapter One, a skill's mastery in gold, ...) as a card that opens the Trophies screen; a Weekly Quest's finish shows any others it brought (Quest Regular, ...). Each trophy is celebrated once per account: the app compares the server's shelf with the trophies it has shown. Offline, it stays quiet. Tested in local and remote e2e.
- **Launch readiness:** `docs/build-order.md` brought up to date (26 trees published to Level 100 and fact-checked; rewards and quests done; "Up next" is the owner-side launch steps). The device QA checklist in `docs/release.md` now covers chapter reviews, Weekly Quests, trophies and the reminder. The screens walkthrough covers chapter reviews; every screen checked at iPhone SE size. A chapter review with no first-try answers no longer shows "+0 XP".

## 2026-09-29: Chapter reviews

- **Go back over any cleared chapter, any time,** from the Review tab: one question from each of its ten levels (a different one each time), graded like a level, with misses corrected from the source cards. Leaving keeps your place.
- **Up to 15 XP a review** (a regular level's minimum), scaled by first tries. Repeating pays again, by design (owner: fine to farm, just a small return). It never touches concept strength, the review schedule, the daily cap or the streak, and each answer counts as a check so the next scheduled review of it pays nothing.
- **Mastered skills can feed quests:** once a skill has no new levels left for you, each chapter review in it counts as one level toward a Weekly Quest (each chapter once). The Review tab marks those skills "Counts toward quests".
- Server (`20261013000000_chapter_reviews.sql`: tables, RPCs, `CHAPTER_REVIEW` ledger rows, quest counting, analytics `chapter_review_started` / `chapter_review_completed`), core mirror (`chapterReview.ts`), both backends, SQL and core tests, and local and remote e2e.

## 2026-09-29: Master of All, Jack of All Trades, perfect lessons to 1,000

- **Master of All** (every skill to Level 100) leads the trophy room as the greatest trophy, with **Jack of All Trades** (Level 50 in every skill) beside it; both show progress ("12 of 26 so far").
- **Perfect lessons** now go 10, 25, 50, 75, then every 100 up to 1,000 ("300 Perfect Lessons").
- **Trophy art:** a registry (`trophyArt.ts`) ready for 20 images briefed in `docs/images-trophies.md` (gold Dr. Scroll bust, gold jack of spades, subject masteries in gold, the rest in violet). Counted trophies share one image per series and the app draws the count in front. Icons show until the files exist.
- **Fix:** "every skill" and "every subject" trophies counted only skills marked published, but production skill rows stay draft; they now count skills with published levels, so Explorer, Polymath and subject mastery are reachable.

## 2026-09-29: Mastery trophies and more milestones

- **A mastery trophy for every skill** ("Mastered: Astronomy", its Level 100, with the skill's mastery art) and **one for every subject** ("Master of History", once every skill in it is mastered), with the gold mastery edge. The old "Mastered" is now "First Mastery".
- **New milestones:** Sharp, Sharper, Precise, Exacting, Flawless (10/25/50/75/100 perfect lessons), Warming Up (25 levels), A Thousand Levels, Ten and Fifty Chapters, Steel Trap (500 first-try reviews), Curious (10 skills), Explorer (every skill), Quest Regular and Quest Veteran (3 and 10 live quest clears). All derived from existing progress, never stored; SQL and core mirror each other with tests.
- The trophy room shows a mastery tally (skills and subjects).

## 2026-09-29: Quest titles and emblems

- **A live-week clear now also unlocks the quest's title** (Citizen of Rome, Clear Thinker, Storm Chaser, Wonder Hunter, Civic Mind, Storyteller, Engineer at Heart, Naturalist) **and its emblem** (the quest's art). Choose them on the Trophies screen; Profile shows the title under your name and the emblem beside it. The Archive unlocks neither. Server-validated (`set_equipped`), mirrored on-device, tested in SQL, core and remote e2e.

## 2026-09-29: Milestone trophies and the trophy room

- **Nine milestone trophies**, derived from progress (never stored), each dated when reached: First Level, Chapter One (a Level 10 checkpoint), Halfway There (Level 50), Mastered (Level 100), Well Rounded (Level 10 in five skills), Polymath (a level in every subject), Century (100 levels), Five Hundred, and Long Memory (100 first-try reviews). SQL `milestone_trophies()` and core `milestoneTrophies()` mirror each other, with tests on both sides.
- **The shelf:** `get_quests` returns quest trophies and milestones together; Profile shows the newest three, and a new **Trophies** screen lists everything earned plus the milestones still ahead.

## 2026-09-29: Content reports queue in the admin

- **Reports** view in the Content Admin: every open learner report from the last insights pull, newest first, with a link to the level's preview and **Fixed / Triaged / Dismiss** buttons (also on each level's Learners tab). Status changes go to the live project through the admin server with the service key from its environment; the key never reaches the page. Admin test and guide updated.

## 2026-09-29: An optional daily reminder

- **Off by default.** Profile → Reminder: one quiet local notification at 8 am, noon, 7 pm or 9 pm, only on days you haven't learned yet. Re-armed as a single one-shot on each app open or level clear, so it never chains into nagging; the copy is never about streaks. Native only (`expo-notifications`); nothing leaves the device. Product decisions updated.

## 2026-09-29: Crash reporting and quest analytics

- **Crash reporting (Sentry), off until keyed:** set `EXPO_PUBLIC_SENTRY_DSN` to turn it on. Crashes and unhandled errors only: no user, email, phone, IP, screenshots, session or performance tracking; emails and numbers in messages are scrubbed. The web build never reports. Store privacy answers, privacy policy draft and release guide updated.
- **Quest analytics:** `quest_viewed`, `quest_started`, `quest_final_round_started`, `quest_completed` (with `live_clear`).

## 2026-09-29: Quests unscheduled; the Final Round is a lesson

- **Dates TBD (owner):** quests can have no start date yet (`startsOn: null`); an unscheduled quest never shows. All eight are TBD until there's a launch week.
- **Final Round as a lesson (owner):** instead of three questions, it's a card from each of the quest's five skills, then a question on each, all taken from the levels you did for the quest. Server, on-device rules, screens and tests updated.

## 2026-09-29: Weekly Quests (v1)

- **What it is:** one quest a week from `content/quests.json` (eight first themes, e.g. The Roman World: Ancient Rome, Architecture, Art History, Philosophy and World Religions, five new levels each). New levels count automatically during the week; at 25 / 25 a three-question **Final Round** opens (questions from the levels you did, a miss shows the cards, then try again).
- **Catching the week matters (owner):** finishing in the live week earns the quest's **trophy** plus its XP bonus (+50). Afterwards it's in **the Archive**: still completable for the knowledge and the XP, never the trophy. One Archive quest at a time; your own unfinished week carries over; switching resets the one you leave.
- **Where:** a quest card on Home, the quest page, the Final Round, the Archive, quest progress on Daily Knowledge Complete, and earned trophies on Profile.
- **How:** progress is counted from the existing level-clear ledger, never stored; server functions (`get_quests`, `start_quest`, `open_final_round`, `answer_final_round`, `complete_quest`) with the same rules on-device for development builds. Tests: `quests.test.sql`, `quests.test.ts`, a remote e2e run through the Final Round to the trophy.
- **Before launch:** give `content/quests.json` real dates once there's a launch week. Titles, cosmetics and quest analytics come later.

## 2026-09-29: Less on the nose

- **Voice rule (owner):** show the game, don't name it. Learner copy never says "RPG", "like a character" or "character sheet"; leveling words stay, and the tagline is "Level up your brain." (`docs/visual-direction.md` "Voice").
- **App:** the sign-in line is now "Short, finished lessons in real subjects, 100 levels deep. Level up your brain." Game jargon is gone from labels too: Skills "Your build" is "Your brain"; Profile "Character sheet" is "Everything you know", with "Trophies" (was Showcase), "Subjects" (was Attributes) and "No title yet" (was "No title equipped yet"); Home drops "World map" from its header and "Current quest" is "Up next"; a subject page says "Subject" (was Region); back buttons say "Home"; the tile you're on says "Learning" (was Playing); onboarding's "See the world map" is "See all subjects".
- **Store listing:** subtitle "Level up your brain", no RPG wording in the description, Play short description or keywords, and the description now lists all 26 trees.

## 2026-09-29: Launch with Apple and Google sign-in only

- **Owner decision:** launch builds offer Sign in with Apple and Sign in with Google only. `EXPO_PUBLIC_SIGN_IN_METHODS` (default `apple,google`) sets what a build offers; the phone and email code flows stay in the code and in the e2e runs, and come back by listing them.
- **Sign in with Apple on Android:** Supabase OAuth in a secure browser tab (`expo-web-browser`), returning to `brainscroll://auth-callback`, so someone who signs in with Apple on an iPhone keeps their account on Android.
- **Docs:** product decisions, accounts, Supabase setup (Phone and Email can stay off; no SMS provider needed), store privacy answers (no phone number collected), privacy policy draft, store listing (also now 26 trees and 2,600 levels), and the reviewer sign-in plan (a dedicated test Google account instead of a test phone number).

## 2026-09-29: Offline no longer looks like being signed out

- **Fix:** launching without a connection dropped a signed-in learner on the sign-in screen with a raw error, and nothing recovered until the app was reopened. Now the saved sign-in is kept, Home, skill maps, Skills and Profile show "Couldn't reach BrainScroll" with **Try again**, and the app retries by itself when it returns to the foreground or comes back online. The launch-time timezone update no longer fails startup.
- **Fix:** if a level saved but the progress reload right after it failed, the lesson said "Couldn't save your progress". It now goes on to Level Complete, and the tabs show the offline state until the reload works.
- New e2e check (remote): offline at launch stays signed in and recovers with Try again.

## 2026-09-29: Room for 26 trees, and one motion system

- **Skills tab:** full cards only for the skill you're playing and those in progress; untouched skills are a compact list by subject under "Start something new", instead of 26 tall cards.
- **Onboarding:** the first-skill picker's rows are compact, so all 26 skills scan in a few swipes.
- **Motion presets (polish pass row 1):** shared easings, springs and one looping helper (`ease`, `spring`, `useLoop`) replace per-component curves in map scenery, the Start callout, skeletons, rewards and Dr. Scroll. Nothing looks different; new motion now can't drift.

## 2026-09-29: Ten new trees published

- **1,000 more levels published** (26 trees, 2,600 levels) on the owner's approval after the full claim review. Approvals are in `content/approvals.json` with the new basis `full-review` (every claim reviewed, not a sample). Corrections from now on are new revisions.
- **Momaday's Pulitzer** stays in Literature Level 80 (owner decision).
- Not yet pushed to Supabase: run `npm run content:import` when ready.

## 2026-09-28: Full claim review of the ten new trees

- **6,062 claims reviewed** against sources, two reviewers per tree (Levels 1 to 50 and 51 to 100): 5,971 OK, 81 softened, 10 fixed. All corrections are in the content, with the old wording kept on each verification record. Details and the list of fixes: `docs/verification/full-pass/README.md`.
- **Sources:** thin or unopened sources the writers flagged were re-checked; new sources added where a better page backs a claim (ICS 2024 chart, NOAA's solar-geoengineering fact sheet, World History Encyclopedia on Juvenal, CS50's 2022 notes), and moved Bell Labs and NIST links updated.
- **Weak evidence:** 5 claims across all 26 trees are now set aside to revisit (`docs/verification/weak-claims.md`).
- **Next:** owner approval by sample, then publishing the ten trees.

## 2026-09-28: Polish pass finished (pending sound files)

- **Every UI state designed:** skeletons for loading, one shared block for empty and error states with retry, button loading, card selected/completed/locked, and a checking state on answers. A failed Review load no longer shows "caught up".
- **Consistency:** about 80 one-off sizes and colours moved onto tokens (new tokens in `docs/design-system.md`).
- **Motion:** lessons and review rise into focus, results fade in over them; a wrong pick gets a small nudge; every animation respects Reduce Motion from the first frame.
- **Accessibility audit:** state (selected, checked, busy, disabled) now reaches screen readers on web too; verdicts and errors are announced; checkpoint recap reads in order; touch targets of 44 pt or more; deliberate text-scaling caps; the lesson footer scrolls at large text. Contrast fixes to WCAG AA, including primary buttons (brand violet nudged from #7C5CFF to #7856FF, white labels 4.59:1) and the correct-answer tick (9.9:1). A VoiceOver and TalkBack pass on real devices is still to do.

## 2026-09-28: Whole-tree milestones and the first polish work

- **Level 50 and Level 100 rebalanced in all ten new trees.** Each Mastery Challenge now asks one question per chapter and each milestone spans Chapters 1 to 5, using only cards and concepts the tree already teaches. US History Level 41's recall question now tests the Cherokee Nation's syllabary, constitution and newspaper, so no taught concept goes untested.
- **Validator:** a level may not list the same concept twice (the database import rejects it); Psychology Level 30 had one repeat, now removed.
- **Feedback system (polish pass §14):** every acknowledged action is an event with a tier (tiny, normal, major, rare) that sets its haptic and sound. Wrong answers get a soft single tap. Sounds play once files are added to `app/assets/sounds/`; until then the app is silent. Sound and Haptics each have a switch under "Feel" on the profile screen.
- **Checkpoint moment:** on a chapter's last level the recap lines come first, one at a time; "You know this now." lands with the checkpoint's haptic; XP and progress follow.
- **Choose For You:** a short, slowing cycle of skill names before the pick lands (under a second and a half; skipped with Reduce Motion and screen readers).
- **Map:** the level that just opened wakes up after a clear; Levels 50 and 100 read Milestone and Mastery.

## 2026-09-28: Premium polish pass on the roadmap

- **Roadmap §14** adds the owner's pre-launch polish pass (brief saved as `docs/specs/PREMIUM_POLISH_PASS.md`): twelve areas in order, each with what the app already has and what is left, plus the product rules the polish must keep (quiet lesson screens, server-owned rewards, no streak rewards, nothing casino-like, separate sound and haptics toggles). The launch checklist gains a Polish row.

## 2026-09-27: All ten new trees written

- **1,000 draft levels:** World Religions, Film & TV and US History are now fully written too, so every new tree has all 100 levels (draft). Chapters interrupted by the usage limit were rewritten from their saved research notes.
- **Next:** rebalance the Level 100 and Level 50 challenges, the fixes and source review listed in `docs/writing/HANDOFF-chapters.md`, then owner approval.

## 2026-09-27: Chapters 2 to 10, paused partway

- **Seven of the ten new trees are fully written** (all 100 levels, draft): Logic, Probability, Psychology, Computers & the Internet, Earth, Weather & Climate, Literature and Philosophy.
- **World Religions and Film & TV are mostly written.** Religions Chapters 2 to 6 and 8 to 10 and Film & TV Chapters 2 to 7 are saved in `drafts/` as merge-ready deltas, waiting for their trees' last chapters. US History Chapters 2 to 10 are still to write.
- **Resume kit:** `docs/writing/HANDOFF-chapters.md` (status, steps, revisit and source-review lists), `docs/writing/chapter-writer-prompt.md` (the writer brief), `scripts/writing/extract_chapter_delta.py` (save a finished chapter as a small delta) and `scripts/writing/thin_asides.py` (hold Dr. Scroll to four asides per chapter).

## 2026-09-27: Six subjects and the next ten trees

- **No image twice in a row.** Consecutive levels always show different art, checkpoints included (owner rule). 176 repeats across the 20 trees were replaced with fitting images from the library, and the validator now rejects a repeat. 155 published levels got a new revision for their new image.
- **Wave 2 and 3 images in:** 210 approved images; the 26 rejected are replaced in the syllabi by images already in the app. Eight had see-through gaps (a generator flaw) filled with a matching shade.
- **Waves 2 and 3 planned:** 100-level syllabi and tree rules for Literature (mythology first), Film & TV, Computers & the Internet, Earth, Weather & Climate, Philosophy and World Religions, with every level's image chosen (no back-to-back repeats). 236 new images to make are listed in `docs/images-waves2-3.md`.
- **Mastery art for all ten new trees.** Dr. Scroll awarding each tree's gold emblem (Level 100 art) and the emblem alone (UI badge), made by the owner. Wave 1 badges are wired; waves 2 and 3 are ready for when their trees exist.
- **Wave 1 images in.** 111 approved images for US History and the Mind & Reasoning trees are in the app (`mind.*`, `us.*`); the 15 the owner rejected are replaced in the syllabi by images already in hand.

- **Catalog locked** (`CURRENT_PRODUCT_DECISIONS.md` §20): six subjects of 3 to 5 skills. Money & Economics is retired as a subject and How Money Works joins How the World Works (same skill ID, progress kept). Mind & Reasoning is the new sixth subject (owl landmark, lightbulb icon, lime colour); it shows as "coming soon" on Profile until its first tree ships.
- **Wave 1 planned:** 100-level syllabi, tree rules and image lists for US History, Logic & Critical Thinking, Probability & Statistics and Psychology (`content/skills/*/syllabus.json`, `docs/writing/tree-rules/`, `docs/images-to-make.md`: 130 new images). The three Mind & Reasoning trees were checked against each other and against existing trees, and each topic has one owner (e.g. experiment design is Probability's, bias experiments Psychology's, fallacies and how science reasons Logic's). US History gives the 20th century two full chapters.
- **Only published levels ship.** `content:build` now leaves draft levels (and skills with none published) out of the app, so trees can be written in place without appearing half-done.
- **Ten new trees planned, in waves:** US History, Logic & Critical Thinking, Probability & Statistics, Psychology; then Literature (with mythology) and Film & TV; then Computers & the Internet, Earth, Weather & Climate, Philosophy, World Religions.

## 2026-09-24: Autonomous build pass (no Supabase/phone testing yet)

- **Choose for me under the subjects, in green.** The button now sits below the grid, and a pick scrolls into view. (Fixed along the way: Home's scroll view ref never attached because the loading screen mounted it without one.)
- **World Map as a grid.** Subjects are now smaller tiles in a two-column grid under "Pick any subject", with no road between them, so it's clear any subject can be started. Tiles show the landmark, level ring, level, skill count and a "Playing" flag.
- **Learning streaks.** A day counts when the learner clears a new level or answers a scheduled review, in their time zone. A flame and the count sit in the World Map header, Level Complete says "Streak started" or "Day N streak" on the day's first learning, and Profile shows current and longest. Missing a day resets it quietly; no warnings, freezes or rewards. Derived on the server (`learning_streak`, new migration) and in core (`streakFrom`), with database, unit and e2e tests.
- **Review lives only in its tab.** The World Map no longer mentions review (the "things worth refreshing" strip is gone).

- **"I know this now" and what a level means** (substance audit, ideas 5 and 3):
  - Clearing a chapter's last level shows its recap as proof on Level Complete: "10 levels ago, could you have explained this?", each line checked off, then "You know this now." No score. That level no longer ends on the same recap card.
  - Every skill has a `masteryPromise` (what Level 100 means), shown on Level Complete as "At Lv. 100: …".
  - The skill map's chapter banner carries one line of what the chapter gives you ("By Level 20, you'll know how …", then "You know how …").
  - **All 1,600 levels published** after the review, the borderline tightening and the owner's go-ahead. Corrections from now on are new revisions.
  - **Privacy:** agents and scripts must never send the owner's email, name or username in web requests (`CLAUDE.md`). Some review requests had carried an identifier derived from the owner's email; nothing in the repo, its history or saved scripts contains it.
  - **Full claim review.** All 10,193 claims were reviewed against sources, one reviewer per tree (`docs/verification/full-pass/`): 23 factual errors and 25 overstatements, all corrected wherever the detail appeared (cards, questions, summaries, recaps). 9,252 claims were checked against a page, including every one previously tagged weak; weakly backed claims fell from 4,444 to 2. Each claim's verification records carry the verdict as `review` (never a verification). Borderline items for the owner are listed in the review's README.
  - **Source spot check and approval to publish.** 20 claims per tree (two per chapter) were reviewed against their sources: 3 factual errors and 9 overstatements in 320, all fixed (review reports in `docs/verification/spot-check/review/`). All 16 trees passed, and the owner approved publishing on that basis: `content/approvals.json` lets an approved tree publish without claim-by-claim verification.
  - **Choose for me** on the World Map: for when you don't know what to learn. It offers another skill (usually one you haven't started, from a different subject) with its next level and what Level 100 means; "Pick again" moves on; Start drops you into the level. Logged as `choose_for_me_started` (new migration).
  - **Nine weak connection links rewritten** so each needs its earlier level (two, Technology 78 and Oceans 78, are still parallels rather than shared mechanisms: nothing earlier in those trees shares one).
  - **Later levels connect back.** All 266 regular levels from 61 to 99 that lacked one now have a connection question that needs an idea from an earlier chapter (e.g. "From Level 27: which law lets astronomers turn a binary star's orbit into a mass?"); its "Take another look" cards include the earlier card.
  - **Dr. Scroll teaches instead of joking:** card asides cut from 1,126 to 619, at most one per level (the validator now warns above one), each a teaching move: keep this, don't memorize the detail, a common mix-up, or a link to another level. Rome and Astronomy, which had almost none, gained about 25 each.
  - `validate:content` no longer cuts off its output when piped (`| grep` saw only the first 64 KB).
  - **All 160 chapter-end recaps rewritten** as what the learner can now explain, not trivia (e.g. "Why seasons come from Earth's tilt, not from how close Earth is to the Sun."). Each sums up the whole chapter in 3–4 lines opening with How, Why, What, When, Where, Which or Who; the validator warns on any other opening.
  - `docs/writing/`: the chapter brief now carries the understanding arc (later chapters ask how, why, then connect and reason) and Dr. Scroll's teaching asides; the validator warns when a level from 61 up has no connection question reaching an earlier chapter.
- **Security review and fixes** (`docs/security-review.md`). No critical issues were found. Fixed:
  - **High:** the app shipped every question's correct answer. Builds that use Supabase, including all release builds, now contain answer-free lessons only; verified at zero correct flags.
  - **Review XP:**
    - Checking an answer by replay or practice before a review no longer earns review XP.
    - Missing on purpose no longer pays: the re-check after a miss earns nothing (product rules updated).
  - **Content corrections:** they no longer fail to import once a removed question has been reviewed.
  - **Sandbox purchases:** they no longer grant real Unlimited (staging can allow them).
  - **Time zone:** it changes at most once a day, closing a daily-cap loophole.
  - **Low-severity items:**
    - Analytics keep only declared props.
    - Display names are capped at 60 characters.
    - `sync-entitlement` returns a generic error instead of the raw database error.
    - The deletion test lists every learner table.

  New database suite `security`; core tests for the XP rules; a test that keeps the server's analytics prop allowlist in step with the app.
- **Play-through pass** at iPhone SE size (375×667), 25 screens from sign-in to review. It found no page errors, no horizontal overflow and no controls without a screen-reader name. Fixed:
  - **Review gave away answers.** The caption above a review question named its concept (e.g. "Andromeda, our big neighbor" above "which is farthest from Earth?"). It now shows only the skill and the count.
  - **Dr. Scroll says less:**
    - The onboarding hello drops a paragraph, and the Daily Complete bubble drops its second line.
    - The first-question, first-checkpoint and first-review tips are shorter.
  - **Headers fit small phones:**
    - The skill map's eyebrow is just the day count ("Bonus day 1 / 10"). It no longer wraps onto two lines.
    - The quest card says "Done for today" instead of "Current quest · done for today".
  - **Large text:** numbers inside fixed-size badges (level emblems, map hexagons) grow at most 1.2× with Dynamic Type and stay on one line. Hero numbers like "+35 XP" grow at most 1.4×. All other text still scales fully.
- **Faster startup: content loads per skill.** The app used to evaluate all 1,600 lessons (a 17 MB JSON bundle) at launch.
  - **What changed:** `npm run content:build` now writes `app/src/content/built/`. That's a 518 KB index loaded at launch (subjects, skills, chapters, concept titles, each level's title, number and art) and one lessons file per skill, evaluated the first time one of its lessons or cards is needed. Screens that only show titles or art read the index. The unused source list is no longer shipped.
  - **Measured** on the web build at 4× CPU slowdown: time to the sign-in screen went from 4.1 s to 2.8 s (median of 5), and the JavaScript heap from 22.3 MB to 10.7 MB.
  - **Also updated:** the validator and Content Admin read the per-skill files as their revision baseline.
- **Release setup (Stage 11), everything that needs no owner accounts:**
  - **Icons:** the app icon and Android adaptive icon (with a one-colour themed version) and the favicon are drawn from Dr. Scroll's mark on the launch purple, replacing Expo's template placeholders. SVG sources are in `app/assets/images/source/`.
  - **Build profiles:** `app/eas.json` has development, preview and production. The last two refuse to run without Supabase, and build numbers increment remotely. `expo-dev-client` is added so development builds can make purchases and use native sign-in.
  - **Config:** declared that the app uses no non-exempt encryption. Expo packages are updated to their SDK patch versions, and `expo-doctor` passes all 21 checks.
  - **Drafts:** `docs/privacy-policy.md` (written from what the app actually stores and sends; needs legal review and hosting), `docs/store-listing.md` (copy within the stores' limits, category, age rating, App Privacy and Data safety answers, review notes) and `docs/release.md` (environment variables, first build on a phone, TestFlight and Play internal testing, a QA checklist).
- **Less explaining on screen** (owner: cut the over-explaining bloat). Removed:
  - Sign-in's progress/privacy footer and Level Complete's "Up next" line (the button already names the next level).
  - The Review tab's footer and empty-state explainer, and the Account card's repeat of the sign-in footer.
  - Repeated "Unlimited only removes the limit" lines, and "levels available" on Skills cards.

  Shortened: onboarding's deal (five lines to three), Review Complete, the reinforced-concepts note and the sign-in code step. Kept the deletion warning, the subscription terms and errors. `docs/design-system.md` gains a "say it once" copy rule.
- **Unlimited (Stage 8) is built** (owner: subscription first). $4.99/month or $39.99/year removes the daily limit on new levels and changes nothing else.
  - **Server:** only the service role writes entitlements. A `revenuecat-webhook` Edge Function applies RevenueCat events: purchase, renewal, cancel (runs to the end of the period), billing grace, expiry, refund and transfer. Older events never overwrite newer ones. A `sync-entitlement` function lets the app have the server re-read RevenueCat right after a purchase or restore, so the cap lifts at once. `has_unlimited()` already gated the cap.
  - **App:** RevenueCat on iPhone and Android, logged in as the Supabase user. A sandbox store runs with the development harness, so the whole flow works with no accounts or money. The web says Unlimited is bought in the phone apps.
  - **Screens:** a new Unlimited screen says what stays free, shows both plans with store prices, and carries restore, manage, the auto-renew terms and the Terms / Privacy links. Daily Complete offers it through a quiet "Want more today?" card, and Profile has a Plan card. It never interrupts a lesson.
  - **Analytics:** four funnel events (seen, plan chosen, started, restored), counts only.
  - **Tests:** a new SQL suite, RevenueCat parsing tests, and both e2e suites (sandbox purchase locally; webhook and cap on the real migrations).
  - **Still yours:** store products, RevenueCat keys and a privacy policy (a launch blocker), all listed in `docs/subscriptions.md`.
- **Weakly backed claims are tagged to revisit later** (owner: mark them and move on to building the app). `npm run verify:flag-weak` tags an automated check `weak`, with its reasons, when only one independent page backs the claim (`one-page`), only Wikipedia, blogs or forums do (`weak-pages`), or the cited page couldn't be opened (`unopened-source`). 4,450 of 10,193 claims are tagged; most only for `one-page`. They stay in the app. `docs/verification/weak-claims.md` summarises them by skill, and every skill now has a checklist and CSV with a weak-evidence column.
- **Open items handled** (owner: "can you handle the open items?"):
  - **Every level has art.** The six planned images that were never drawn use existing art (owner: "generic Roman images"): the fasces and raised-hand levels show the eagle standard, signet ring, forum, rostra, bronze tablets or Greek temple; Archimedes shows an amphora, the Wars of the Roses a shield, and Oceans' star navigation the star trails. Dr. Scroll's chalkboard pose shows his explaining art. `docs/images-to-make.md` lists each stand-in.
  - **Launch screen:** Dr. Scroll's mark is drawn (peach crown, off-white tufts, dark round glasses, matching his reference art), replacing the placeholder disc. Its SVG source sits beside the PNG.
  - **Google button** carries Google's standard four-colour "G", drawn from Google's own asset.
  - **Learning cards share one layout** (UX review P3): optional label, heading, body, then a "Key idea" box that is always labelled and always last.
  - **The next level is the brightest thing on a skill's map** (P4): the chapter banner is now a quiet card, and cleared waypoints are a muted violet with violet numbers.
  - **Level Complete labels its scopes** (P5): the skill card splits its level from Mastery ("Long-term goal"), and Knowledge Level and today's count sit under "Across BrainScroll" ("Today 1 / 10 new levels").
- **Oceans is complete: all 100 levels** (drafts), and with it **all 16 skill trees: 1,600 levels**. Chapters 2 to 10 cover the ocean floor (Seabed 2030's mapped share, dated), waves and tides (matching Astronomy's two tidal bulges), currents and climate (IPCC wording and confidence levels kept exactly, no predictions of our own), the sunlit sea (Level 50 milestone; "about half of Earth's oxygen" as NOAA phrases it), the deep (no "we know more about the Moon" cliché), coasts and islands, polar seas (sea-ice trends dated to NSIDC's September 2026 analysis), exploring the ocean (Polynesian wayfinding with named navigators and islands; Tupaia's part in Cook's first voyage) and people and the ocean (Level 100 Mastery Challenge; fishing from FAO's 2026 report, the High Seas Treaty in force since January 2026, and the shipping-emissions, marine-reserve and plastics-treaty debates as named sides). 196 concepts and 598 facts, each checked against a second page; none human-verified. Level 82 waits on the planned `astronomy.star-chart` image.
- **Music is complete: all 100 levels** (drafts). Chapters 2 to 10 cover instruments, early music (the oldest bone flutes; the Divje Babe "flute" shown as disputed), Baroque and Classical (Salieri's poisoning and the "Mozart effect" taught as myths), the Romantic century (Level 50 milestone; Wagner's antisemitism stated factually), music around the world (gamelan, raga, maqam, West African drumming, flamenco, Latin rhythms, folk song), blues and jazz (their African American origins stated plainly, from spirituals to the Great Migration), rock and pop (rock and roll's roots in rhythm and blues and its Black pioneers named), hip-hop, electronic and beyond (the Bronx, 1973, given as the date most often cited) and music and you (Level 100 Mastery Challenge; brain and health claims only from research, stated cautiously; safe listening from the WHO). 197 concepts and 658 facts, each checked against a second page; none human-verified. Two chapters had both created a program-music and a Mendelssohn fact id; one of each is renamed.
- **Government is complete: all 100 levels** (drafts). Chapters 2 to 10 cover kinds of government, democracy, constitutions and rights (the Universal Declaration; women's suffrage from New Zealand's 1893 petition; civil rights and the end of apartheid), how laws are made (Level 50 milestone), courts and justice (juries, the presumption of innocence, police and prisons as general facts, never legal advice), elections (voting systems, gerrymandering, polls, audits, and spotting misinformation taught as general methods with no current disputes), money and government (budgets, schools, healthcare and pensions with OECD figures; corruption), countries and the world (the UN, the EU, treaties, international courts, refugees with UNHCR's end-2025 figures) and citizenship (Level 100 Mastery Challenge). It stays strictly neutral: every live debate is framed as named sides. 203 concepts and 622 facts, each checked against a second page; none human-verified.
- **Architecture is complete: all 100 levels** (drafts). Chapters 2 to 10 cover ancient wonders, temples and churches (Hagia Sophia to Angkor Wat; beliefs attributed), castles and palaces (the Great Wall "seen from space" taught as a myth, citing NASA), homes around the world (Level 50 milestone; igloos, gers, Taos Pueblo and stilt houses named by their peoples and places), engineering marvels, skyscrapers, modern masters, cities, and building the future (Level 100 Mastery Challenge; tall timber and 3D-printed houses with dates, the Moon habitat as a study, no predictions). Figures shared with Rome, Egypt, Art History and Everyday Technology match those trees. 239 concepts and 683 facts, each checked against a second page; none human-verified.
- **Sources:** two Britannica links in the Rome tree (`brit_us_constitution`, `brit_insula`) returned 404 and now point at the working pages.
- **Ancient Greece is complete: all 100 levels** (drafts). Chapters 2 to 10 cover city-states (slavery stated plainly), Athens and democracy (only adult male citizens voted; who was left out gets its own level), Sparta and war (Thermopylae's numbers as ranges with Herodotus's figure flagged; the Boeotians and helots who also stayed), gods and heroes (Level 50 milestone; myths told as myths), thinkers, science and math, theater and the arts, Alexander and after, and the Greek legacy (Level 100 Mastery Challenge; statues were painted; the torch relay began in 1936). 126 concepts and 655 facts, each checked against a second page; none human-verified. Two chapters had both created an "Athena's owl" fact id; one is renamed.
- **Chemistry is complete: all 100 levels** (drafts), the fourth Science tree. Chapters 2 to 10 cover atoms (from Democritus to Chadwick; carbon dating), the periodic table (Mendeleev's gaps; elements from stars), elements up close, bonds and molecules (Level 50 milestone), reactions, acids and bases (ocean acidification with NOAA and IPCC figures), the chemistry of life, chemistry at home, and great chemists (Level 100 Mastery Challenge; Rosalind Franklin's part in DNA told fairly). 210 concepts and 570 facts, each checked against a second page; none human-verified. Safety held throughout: fireworks and explosions are explained conceptually with no compositions or quantities, cleaning safety is limited to the CDC's and Poison Control's never-mix warnings, and no level gives experiment instructions or dose figures.
- **UX review fixes** (an external review of 29 screenshots, verified against the code first):
  - **Onboarding skill picker** now scrolls, so no skill is ever cut off under the button on short screens or at large text sizes. It lists every playable skill grouped by subject (Science alone has three), and starts with nothing selected, so Continue waits for a deliberate pick.
  - **Day one's 10 levels** are labeled as a bonus ("Today is a bonus: your first day gets 10" on the deal screen; "Day one bonus 3 / 10" in the bars), so they no longer seem to contradict the 5-a-day promise. The daily rules are unchanged.
  - **After a wrong answer the choices stay in view:** "Take another look" now appears under the answer choices instead of above them, and the screen no longer jumps to the top.
  - **Contrast:** violet text (eyebrows, chips, stat numbers, the map's Start label, the active tab) uses a new lighter `brandText` that passes WCAG AA on every surface; violet fills and buttons are unchanged.
  - **Sign-in:** a "Change email"/"Change number" button on the code step keeps what you typed; buttons say "Sending…" and "Verifying…" while working; "Send a new code" has a 30-second cooldown; phone and email buttons carry icons (Google's button needs its official logo asset before it gets one).
  - **Skills tab:** cards end with a "View skill map" cue, and the skill you're playing is listed first, then others in progress.
  - **Smaller fixes:** "Look around first" is now "See the world map"; Level Complete puts "Lv. 0 → 1" on its own unbreakable line; Dr. Scroll's "Got it" is a small pill button; cleared waypoints on a skill map are a shade darker so the next level stands out.
  - **Not changed:** content hidden under the tab bar (B2) didn't reproduce (the tab navigator lays screens out above the bar, and every tab ends with space to spare); structural card grammar (P3), the chapter banner's weight (P4) and staging the reward screen's systems (P5) are design decisions left for the owner.
- **The last six trees begin, Chapter 1 each (Levels 1–10, drafts), with their art:** **Ancient Greece** ("Myth and Memory": Minoans and Mycenaeans, Linear B, Troy as real and the war as legend, the Homeric question left open, the alphabet's new vowels), **Chemistry** ("Matter": states, plasma, mixtures, density, physical vs chemical change; no home experiments), **Government** ("Why Government?": rules, power and authority, Hammurabi, public goods, taxes with OECD 2024 figures, Hobbes, Locke and Rousseau each in their own words; strictly neutral, examples from about ten countries), **Architecture** ("How Buildings Stand": loads, beams, arches, domes, materials, blueprints, Hooke's hanging chain), **Music** ("How Music Works": sound as a pressure wave, A4 = 440 Hz, rhythm, melody, chords, major and minor with "minor = sad" shown as largely learned, reading music) and **Oceans** ("The Blue Planet": five oceans including the Southern Ocean's status, where Earth's water came from as an open question, salt, layers, light and pressure). Each fact was checked against a second page; none human-verified. Four planned images are still to make (`rome.fasces`, `rome.raised-hand`, `rome.baths`, `astronomy.star-chart`).
- **Animals is complete: all 100 levels** (drafts), the third Science tree and the app's 1,000th level. Chapters 2 to 10 cover mammals (about 6,800 living species, Mammal Diversity Database 2026), birds (record flights with their studies and years), reptiles and amphibians (venom vs poison, no first aid; chameleons change colour mainly to signal, not to hide), life in the water (Level 50 milestone; shark bites as sourced rarities), insects and other invertebrates, how animals survive (bear "hibernation" presented as debated), animal behavior (the "alpha wolf" idea and its correction by Mech), evolution (stated as established science, from Darwin's finches to walking whales and Majerus's peppered moths), and animals and people (Level 100 Mastery Challenge; the Red List with version and year; the zoo debate as named views; Laika told honestly). 195 concepts and 561 facts, each checked against a second page; none human-verified.
- **Ancient Egypt is complete: all 100 levels** (drafts). Chapters 2 to 10 cover pharaohs and power ("pharaoh" only from the New Kingdom; Hatshepsut's erasure presented as debated), the pyramids (built by paid, rotating Egyptian crews: the workers' cemetery and Merer's logbook), gods and the afterlife (beliefs framed as the Egyptians' own; about 8 million animal mummies at Saqqara), writing and knowledge (Level 50 milestone; hieroglyphs as sound and meaning signs, not picture writing), daily life (the first recorded strike, about 1157 BCE), the New Kingdom (Akhenaten's monotheism and Punt's location as debates), famous pharaohs (Kadesh as a draw; the mummy's curse as myth), decline and conquest (Kush as a major civilization; the Library of Alexandria's slow decline, not one fire), and rediscovering Egypt (Level 100 Mastery Challenge; Young credited before Champollion; repatriation views attributed to the British Museum, Berlin and Egypt's officials). 100 concepts and 626 facts, each checked against a second page; none human-verified. Two chapters had both created a "Cleopatra learned Egyptian" fact; one is renamed.
- **The Middle Ages is complete: all 100 levels** (drafts). Chapters 2 to 10 cover Charlemagne and the Vikings (no horned helmets; L'Anse aux Meadows dated to 1021 by tree rings), castles and knights (the feudal pyramid presented as a simplification; armor about 20 to 25 kg, no cranes), faith and the Church (the flat-Earth belief debunked; the Inquisition with sourced counts, neither exaggerated nor minimized), the Crusades (Level 50 milestone; told from Latin, Byzantine, Muslim and Jewish sides, including the Rhineland massacres and 1099), town life, the Islamic world and the East, kings, parliaments and law, plague and war (Yersinia pestis confirmed by ancient DNA; rats versus human fleas presented as an open debate; the persecution of Jews stated plainly), and a wider world (Level 100 Mastery Challenge; Columbus with his toll on the Taíno, Mansa Musa's wealth as an unmeasurable claim, Great Zimbabwe built by the Shona's ancestors). 176 concepts and 789 facts, each checked against a second page; none human-verified. Three claims in Level 94–96 cite only Wikipedia and should be checked first.
- **Three new trees begin, Chapter 1 each (Levels 1–10, drafts):** **The Middle Ages** ("After Rome": why "Middle" and why historians avoid "Dark Ages", 476 as a convention, Byzantium, Justinian and Hagia Sophia, the Franks, monasteries, the rise of Islam described neutrally, Sutton Hoo; 88 facts), **Ancient Egypt** ("The Gift of the Nile": Herodotus's phrase in context, the flood, Black Land and Red Land, farming seasons, sailing south and floating north, the Two Lands, Narmer presented as partly legend; 57 facts) and **Animals** ("What Makes an Animal": the checklist that makes a sponge an animal, species counts as sourced estimates, backbones, scientific names, why "cold-blooded" misleads, food webs, Paine's sea stars and keystone species, the largest and smallest animals; 50 facts). Each fact was checked against a second page; none human-verified. Their images come from the owner's library (Middle Ages Level art `medieval.rose` is still to be made).
- **Home is now a World Map** (owner direction: a map of the categories first, RPG-inspired). Each subject is an island on an overworld, joined by a dotted road: its landmark floats inside a ring filling toward Lv. 100 in the subject's colour, over a plate with its name and level (gold with ★ once mastered), with scenery drifting alongside. The subject you're playing flies a flag with Dr. Scroll and his map beside it. A Current Quest card continues your skill, and due reviews wait above it. Tapping an island opens its skill's map, or first its region (Science now has Astronomy and The Human Body). A skill's map lives one step in, with its back arrow returning to the World Map, and Level Complete's button now reads "Back to the map".
- **The Human Body is complete: all 100 levels** (drafts). Chapters 2 to 10 cover bones and muscles, heart and blood, breathing, food and digestion (Level 50 milestone), brain and nerves, the senses, defending the body, growing and changing, and keeping healthy (Level 100 Mastery Challenge). 193 concepts and 648 facts, each checked against a second page; none human-verified. It gives no medical advice: guidelines are attributed to the WHO, CDC, NIH or AHA with their year, diet and calories stay body-neutral with no weight-loss content, breath-holding is explained as dangerous rather than a challenge, asthma and allergies name no drugs, vaccines are presented as the scientific consensus, and reproduction and puberty are covered factually and age-appropriately. Popular myths are debunked rather than repeated (left-brained people, the tongue map, 10% of the brain, sugar making kids hyper and more), and history is told carefully (Lind's scurvy trial, Florey and Chain's part in penicillin, variolation before Jenner).
- **Home is just the map** (owner feedback: it felt busy). The "N things worth refreshing" strip moves from Home's pinned bar to the top of the Skills tab, so Home is the slim bar and the map. On iPhones the pinned bar already sits below the notch (safe-area insets); web previews simply have no notch.
- **Validator:** the check for a question prompt that gives away its answer now matches whole words, so "which vitamin causes scurvy?" no longer counts as containing the answer "Vitamin C".
- **Redrawn images swapped in** from the owner's second library: Dr. Scroll's reference, money, clapping and archaeologist poses, the Art History and Astronomy mastery images, and a reframed dying star. The rest of the library matched what was already in the app.
- **The Human Body, Chapter 1 (Levels 1–10)** as drafts, the second Science tree: the body's 11 systems as a team, cells, how many cells you have (about 30 trillion, most of them red blood cells), from cells to organs, DNA, genes (about 20,000 protein-coding genes, and why no single gene decides your height), water (sourced ranges by age, not the popular 70%), the microbes on you (roughly one bacterium per human cell, not the old ten-to-one), how we learned about the body, and a checkpoint on how many cells you replace each day. 71 facts from 34 sources, each checked against a second page; none human-verified. No medical advice. All 37 of the tree's images are in the app.
- **The owner's second image library is in.** Dr. Scroll gains 39 poses (the magnifier plus his topic scenes: telescope, toga, map, piggy bank, easel, laptop, doctor's stethoscope, knight, violin and more), and on each skill's map he now wears that skill's costume, so he's peering through a telescope beside Astronomy and wearing a toga beside Rome. Clearing a skill's Level 100 now shows that skill's own gold mastery badge (a telescope for Astronomy, a laurel wreath for Rome) on Level Complete; checkpoints keep the violet trophy, since gold only means mastery. 116 of the 121 missing planned images arrived, all for trees not yet written, so they wait in the library until each tree is added. Every written tree already had its art except Rome Level 82; `docs/images-to-make.md` now lists just the 6 images still to make.
- **Everyday Technology is complete: all 100 levels** (drafts). Chapters 2 to 10 cover power for the world (the grid, every kind of power plant, storage, energy and climate), engines and motion, getting around (planes, jets, trains, ships, radar, rockets, GPS, traffic, self-driving cars), communication (Level 50 milestone), computers, the internet, home and health, building and making, and tomorrow's technology (AI, chatbots, VR, drones, gene editing, fusion, quantum computers; Level 100 Mastery Challenge). 188 concepts and 619 facts, each checked against a second page; none human-verified. Statistics carry their year and source; climate science is stated as fact (NASA, IPCC) while energy policy is presented as named groups' views; disputed invention credits (telephone, radio, television, the first computer) are shown as disputes; lift is explained without the equal-transit myth; the bicycle's self-stability is presented as partly open; vaccines follow the WHO consensus with no medical advice; password advice is defensive and follows NIST and CISA; the AI, fusion and quantum levels give dates and make no predictions. Two chapters had used the same fact id for augmented reality and antibiotic resistance, now renamed.
- **Everyday Technology, Chapter 1 (Levels 1–10)** as drafts, the first lessons in the World Systems subject: technology as knowledge put to work (stone tools older than our own genus), what energy is, electricity (the electrons are already in the wire and drift about a meter an hour), circuits, the light bulb, batteries, magnets and motors, generators, Edison, Tesla and AC, and a checkpoint that teaches watts and the kilowatt-hour on your bill. Analogies are labeled as analogies. 71 facts from 42 sources, each checked against a second page; none human-verified. The tree's 28 remaining illustrations are added from the library, so all 50 of its planned images are in the app.
- **Art History is complete: all 100 levels** (drafts). Chapters 2 to 10 cover ancient worlds (Mesopotamia, Egypt, Greece, Rome, early China and India), faith and empire, the Renaissance, Baroque to Neoclassicism (Level 50 milestone), Romanticism to Impressionism, the modern breakaways from Van Gogh to Surrealism, art around the world (ukiyo-e, Benin, Aboriginal art, the Americas, Mexican muralism, Kahlo), modern and contemporary art, and how to look at art (composition, symbols, museums, restoration, forgery, theft, digital art; Level 100 Mastery Challenge). 207 concepts and 740 facts, each checked against a second page; none human-verified. Interpretations are presented as readings, contested claims (the Parthenon's curves, Vermeer and the camera obscura, the Salvator Mundi attribution) as open questions, and the Benin Bronzes' looting and returns as plain fact. Several museum pages blocked automated reading, so their source notes ask a human to open them. Four checkpoints had the same recap question, now worded for each chapter, and one source title lost its em dash.
- **Art History, Chapter 1 (Levels 1–10)** as drafts: art history as one day (writing arrives after 10 p.m.), what counts as art (the Brancusi customs case), the artist's toolkit, how colour works, the first marks, hands and scenes, Lascaux and Chauvet, the first sculptures, Stonehenge and Göbekli Tepe, why early people made art (four ideas, presented as ideas), and a checkpoint on how cave art is dated. 81 facts from 47 sources; the oldest-art record (a hand stencil at least 67,800 years old, from a 2026 study) may move as new finds are dated. None human-verified.
- **How Money Works is complete: all 100 levels** (drafts). Chapters 2 to 10 cover earning and spending, banks and borrowing, saving and investing, markets and prices (Level 50 milestone), governments and money, inflation, booms and busts, trade, companies and work, and big ideas in economics (Level 100 Mastery Challenge). 211 concepts and 772 facts, each checked against a second page; none human-verified. It explains how money works and never gives financial advice, recommends products or predicts prices; contested topics (taxes, debt, tariffs, globalization, central banks, schools of economic thought) are presented as competing views, attributed to who holds them. The decoy-pricing card uses a plain hypothetical instead of Dan Ariely's subscription figures, since his other work faces data-fabrication allegations. Levels 36 and 37 use the rising-chart image until an eggs-in-a-basket image is made. Chapter writers stayed inside their own chapter's topics, so the merge had no clashes.
- **How Money Works, Chapter 1 (Levels 1–10)** in the approved voice, as drafts: a WWII prison camp where cigarettes became money, barter's problems, cowries, salt and Yap's stones, the first coins, paper money, why money has value, the gold standard, money as bank numbers, a balanced look at cryptocurrency, and a checkpoint on what makes money useful. It explains how things work and never gives financial advice. 81 facts from 30 sources, with historians' disagreements stated as such; none human-verified.
- **World Geography is complete: all 100 levels** (drafts), the first new tree in the approved voice. Chapters 2 to 10 cover the restless Earth (plates, quakes, volcanoes, the rock cycle), water, climate and weather, biomes (with the Level 50 milestone), Africa and the Middle East, Europe and Asia, the Americas, Oceania and the poles, and people and places (with the Level 100 Mastery Challenge). 199 concepts and 707 facts, each checked against a second page before use; none is human-verified yet. Where sources disagreed, the writers dropped or softened the claim (for example the Nile's exact length and how fast the Himalayas rise). Writers drafted chapters in parallel copies and were merged; ideas taught in two chapters (the Ring of Fire, monsoons) are now taught once and reinforced later, and repeated questions became "From Level N" callbacks.
- **`validate:content -- --dir <path>`** validates a copy of `content/`, so a chapter can be drafted and checked in isolation before it's merged.
- **World Geography, Chapter 1 (Levels 1–10), the first lessons for a new tree.** Written in the approved voice, as drafts: the planet in one level, why every map is wrong (Mercator and the Greenland illusion), latitude and longitude, the Equator and tropics, time zones, compass directions, reading the land, continents and oceans by size, how GPS finds your phone, and a checkpoint on antipodes ("Dig straight down from the US. You won't reach China."). 70 facts from 39 sources (13 US government pages; the rest Britannica, National Geographic and specialist sites), each checked against a second page before use. None is human-verified yet. Geography is now playable, so its arc on the Profile ring can fill.
- **Dr. Scroll moves to the right pocket** in your current chapter, so the pocket across from the 3rd waypoint always shows its level's illustration.
- **Scenery on the map** (owner idea): the open pockets across from the road's bulges now float the illustration of the level beside them (for example the Moon beside Astronomy's eclipse level), drifting gently and dimmed while that level is still locked. In your current chapter Dr. Scroll keeps the left pocket.
- **Subjects can be mastered** (owner decision). Clearing 100 levels in a subject puts a ★ after its name and turns its name and level gold, on the Profile and the Skills tab, and its level starts again from 1 toward the next ★. XP still counts toward the Knowledge Level as always. The rule lives in core as `subjectAttribute()`, with unit tests. History's colour moves from orange to terracotta so it can't be mistaken for mastery gold.
- **Simpler attributes:** each subject's bar is a solid bar that grows one step per level, 1 to 100 (no notches), and the skill lines underneath ("Astronomy Lv. 6") are gone.
- **Subject levels are just levels cleared** (owner decision, recorded in CURRENT_PRODUCT_DECISIONS.md). Profile's attributes and the Skills tab now show a subject as "Lv. N", the levels cleared across its skills, instead of a rank curve, and XP no longer appears beside them (it only feeds the Knowledge Level). Each attribute's notched bar is the current 10-level chapter. Polish: the character ring sits on a framed disc with each subject's level on its icon, "Soon" subjects are compact dimmed rows listed last, the line under the trophies is gone, and the Account card's heading is no longer green.
- **Profile becomes a character sheet** (owner reference: an RPG stat screen, taken lightly). Each subject gets its own colour. A ring of six subject arcs, each filling with that subject's rank, circles the Knowledge Level badge, and an Attributes panel lists every subject like an RPG stat (History, Science, Geography…): icon, a notched bar filling toward the next rank, "Rank N", and its skills underneath. Subjects not yet available sit dimmed as "Soon".
- **Home is the whole skill map, under a slim pinned bar** (owner feedback). The bar always shows where you are: a back arrow to the Skills list, the skill and its level ("Astronomy · Lv. 6"), today's count, and a review strip when concepts are due. Below it every chapter scrolls by in order, each banner sitting where its chapter begins, and Home opens scrolled to the next level. Tapping a skill on the Skills tab now makes it active and returns to its map on Home, so the separate skill page is gone.
- **The level path becomes an adventure map** (owner feedback: less of a Duolingo copy, more RPG). Waypoints are hexagons with their level number instead of circles with icons, joined by a drawn dotted road (violet where you've walked, faint ahead). Locked waypoints fade into a fog of war, cleared ones carry a mint check, and each chapter ends in a bigger shield-marked boss waypoint labeled Checkpoint. The chapter banner gets a map icon, the "Start" callout gets its own room so it never covers a waypoint, and Home scrolls the next level into view. Drawn with `react-native-svg`.
- **Each skill has its own path page.** Tapping a skill on the Skills tab opens its whole tree as stacked chapter paths, scrolled to the chapter you're in (with Dr. Scroll beside it), and makes it the skill Home follows. Before, the card jumped straight into the next level.
- **Checkpoint trophy:** clearing a chapter's 10th level pops a big trophy badge at the top of Level Complete (gold on a mastery level).
- **Review, Profile and Skills get pictures.** When concepts are due, Review opens with Dr. Scroll ("A few old friends came back to visit. Say hello before they wander off again.", new spot `review.ready`) and lists them as rows with a book icon. Profile's empty trophy slots show a trophy outline instead of the words "Trophy slot". Each Coming soon subject on Skills has its own icon.
- **More pictures, less text:** the first-skill picker shows each skill's Level 1 art, and each Skills card shows the art of the level you're on.
- **Motion pass.** Each lesson step slides in, the answer verdict rises into place with its badge popping, a picked answer gives a small spring, and when you return Home the level you just cleared pops on the path. Path nodes give a haptic tick. All of it is quick (about 0.2 s) and snaps into place with reduce motion.
- **Home is a level path now** (owner decision). The Continue card is replaced by the current chapter as a winding trail of round, raised level nodes under a violet chapter banner: cleared levels are violet with a check, the next level is bigger and ringed with a bouncing "Start" bubble naming it (no bounce with reduce motion), later levels are locked, and every 10th level is a trophy (gold on a mastery level). Tapping a cleared level replays it. Dr. Scroll reads beside the trail (new spot `home.path`), and the next chapter is teased at the bottom. Chapter titles now ship in the app bundle from each syllabus.
- **Depth pass (the UI stops feeling flat).** Buttons, cards, stat tiles and badges now stand on a thick 4 px edge in a darker shade, like the answer tiles already did, with 2 px borders instead of hairlines; buttons press down into their edge. Level and skill badges are solid violet with white numerals (gold for mastery). Stats and status chips carry icons (XP bolt, knowledge, stars, skills, today), the lesson progress bar is chunkier, and the active tab sits in a violet-outlined box.
- **UI polish pass.** The app now uses Nunito everywhere instead of the system font (the launch screen waits for it). The sign-in screen is a centered hero (Dr. Scroll, tagline, one-line pitch) above four equal sign-in buttons, with the small print centered at the bottom. Text fields show a violet border when focused instead of the browser's white outline. The lesson top bar uses real close and flag icons instead of text characters. Level art is larger and centered in lessons and on Home, where it no longer squeezes the level title. The level and skill badges lose their inner second border. Level Complete and Daily Complete drop the dark circle that sat behind the headline, and Dr. Scroll is bigger on Level Complete. Profile drops the repeated "XP earned" line and capitalizes the name.
- **The illustration library is in the app.** 199 of the 200 written levels now show art: 100 use the first-round image made for that exact level (for example the corvus boarding bridge on The First Punic War), 96 use the shared image, and 3 use the closest registry match (star trails for constellations and the Reading the Sky checkpoint, the curule chair for Two Consuls). The syllabi were updated to match. Rome 82 (Diocletian) shows no image until one is made. Dr. Scroll now has 26 of his 28 poses; chalkboard and magnifier still use the reference. Images are stored as 512 px WebP (about 31 KB each, 4.8 MB in total). Only the finished images are in this repo, not the library's style specs or prompts.
- **Dr. Scroll has a voice** (owner direction): a warm old Italian American grandpa who knows everything, playful and a little theatrical, with no accent or stereotypes and one flourish per line. His intro, reactions, tips and the Level 1 aside are rewritten ("I'm old, not nosy", "Hold on, I need to find a frame for this", "Take another look, I'll wait"), and `docs/mascot.md` records the voice with examples.
- **Restyle complete: all 200 Astronomy and Rome levels** are now in the approved voice (one idea per card with a payoff line, one story per level, callbacks to earlier levels, light humor), written from registered facts only. Every level is inside the word norm (175 levels had fallen short before). Unsupported lines in the old cards were cut (for example Nero's "first" fire brigade, "the steady hiss" Penzias and Wilson heard, Japan's civil law). Where a question's correct answer leaned on an unregistered claim, the question was reworded to match the facts: about two dozen questions across both trees (for example Mars's thin air, star lifetimes, the legion's three lines, the Pantheon's dome), plus one recap line and a few rationales. Claims the writers wanted but couldn't use are listed in `docs/fact-wishlist.md`. Four facts no longer appear on any card (moon distance, Earth's orbit distance, Olympus Mons, Mars's rust color) and stay registered for later. None of this is human-verified.
- **Depth, refined (owner feedback on the sample):** make the concept memorable, don't add neighbors to it. Priority is learn > interesting > fun, with no tangents. A regular level is now 180–320 words (checkpoints 120–320, milestones 80–320, mastery up to 250), and a card body is one focused paragraph (600 characters). Levels 1–3 were re-trimmed to match.
- **Restyle, first chapters:** Astronomy 4–10 and Rome 1–10 rewritten in the approved voice from registered facts only (a checker enforces facts, budgets, no em dashes and question evidence before anything is applied). Unsupported lines in the old cards were dropped (for example "each chunk orbits Saturn like a tiny moon", the Tiber in the twins story). Rome 3's answer "drained and paved" had no fact behind "paved", so it now reads "drained and became Rome's public center", which two registered facts cover. A regular level may have 2–5 learning cards (the writing matters more than the count). Borrowed ideas from earlier levels are now listed as `reinforce`, from later levels as `preview`.
- **Sample rewrite, Astronomy Levels 1–3 (approved voice):** about 180 words each, one idea per card with a payoff line ("If it vanished right now, you'd keep seeing it for about 8 more minutes"), one story across the level (the cosmic address written line by line), numbers only when they're the point, and humor back ("We're the crumbs"). The style guide records these techniques, and the regular-level floor is now 150 words. Every sentence maps to a registered fact; two are new (NASA's front-door-and-nickel comparison and the Sun's gravity holding the solar system together), fact-checked against NASA on 2026-09-25. None is human-verified.
- **New concept role `preview`:** a level can mention an idea a later level teaches in full (validated: some later level must teach it). Migration `20261002000000_concept_preview_role.sql`; the admin offers it.
- **Deeper lessons (owner decision):** learners should come away interested, not just informed. A regular level is now 3–5 fleshed-out cards of 300–500 words (checkpoints 150–400, milestones 100–400, mastery up to 300), and a card's body can hold a real paragraph (900 characters, up from 360). The content guide gains *Writing to interest* (open with a hook, tell how we know, explain the why, make scale concrete, connect, stay accurate). Spec, product rules, roadmap, visual direction and CLAUDE.md are updated. The existing 200 levels now fall short of the word norm (a warning) until they're rewritten.
- **Level art is wired:** every level and syllabus entry (all 16 trees, 1,600 levels) has an `art` field naming its image from the image list, validated for format and checked against the syllabus. Drop a file into `app/assets/images/art/<id>.png`, run `npm run art:sync`, and it shows at the top of the lesson and on Home's continue card; missing images show nothing. `npm run check` catches a stale registry. Verified with a stand-in image (removed).
- **Dr. Scroll arrives with one small bounce** (a snap with reduce motion).
- **Slate background and a plum launch screen** (owner decision): the app moves from Midnight Navy to a blue-gray Slate (`#131F24` background, `#202F36` cards) so colours pop more, and all contrast pairs still pass. The launch screen is deep plum with Dr. Scroll's minimalist mark (bald crown, hair tufts, glasses) and the white wordmark, shared by the native splash and an in-app `BrandSplash`. It stays up until sign-in state is known and its mark has shown for 0.6 s (so it never flickers or shows empty), with a 1.5 s safety net. The mark is a placeholder at `app/assets/images/splash-mark.png`. The image list now asks for transparent backgrounds.
- **Dr. Scroll spots:** every place he appears has a stable spot ID (23 in all, in `packages/core/src/mascot.ts`), and all artwork is wired in one file (`app/src/components/ui/mascotArt.ts`): a spot image, else the pose image, else the reference. New spots: sign-in, checkpoint levels, Review Complete, loading (after a short delay), level load errors, locked levels and not found. Each placement is labeled `testID="mascot:<spot>"`.
- **Bow Tie Plum:** Dr. Scroll's color (`plum`, `#C07BE8`) joins the palette. His speech bubbles, tip actions and the "Did you know" label on fact cards use it; buttons and progress stay brand violet.
- **Dr. Scroll card asides:** learning cards can carry an optional `mascot: { pose, line }` (calm poses only, 140 characters, no new facts, a warning above 2 per level). The lesson shows him after the card, the content admin can edit it, and Astronomy Level 1 has the first one.
- **Dr. Scroll's one-time tips:** on the first question ("Pick an answer, then tap Check"), the first miss, the first checkpoint and the first review. Each shows once per account (stored with the account's device-side state), can be dismissed with "Got it", and uses a calm pose. The local e2e suite checks they appear once and never return.
- **Dr. Scroll reactions:** a small thumbs-up or kind shrug beside answer feedback (image only, lessons stay quiet), and a one-line bubble on Level Complete (by outcome, level-up and mastery), Daily Complete and the empty Review tab.
- **Dr. Scroll in the app:** a `DrScroll` / `DrScrollSays` component (speech bubble, screen-reader friendly, reference image for every pose until the pose images exist) and a new first onboarding screen where he introduces himself. Both e2e suites updated and passing.
- **Dr. Scroll simplified** so the image tool can repeat him: five signatures only (round body, bald crown with white tufts, round glasses, plain brown jacket, violet bow tie), no pencil, patches or buttons, and at most one prop per pose. The reference is to be re-edited to match before any pose is made.
- **Dr. Scroll's reference image approved** and saved as `docs/mascot-reference.webp` (transparent background). The character guide now describes that image, so every pose matches it.
- **Mascot defined:** `docs/mascot.md` describes Dr. Scroll, an original cute old genius (not Einstein, whose likeness is licensed), with 29 poses for lessons, feedback, progress screens and subjects, plus how to keep him consistent across images. He isn't in the app yet.
- **Six more trees planned, bringing the total to 16:** Ancient Egypt, Ancient Greece, Chemistry, Architecture, How Government Works and The Oceans. They were written to reuse images: 600 levels need only 63 new images, plus 20 from the first-round image list.
  - The image list now has a substitutes table (and `docs/image-substitutes.json`) that maps 41 planned images to first-round images that can stand in, so images already approved from that list get used.
  - The list's descriptions that described two subjects now describe one object each (for example, rocky planets, merging galaxies, eggs across baskets).
- **Four more trees planned, bringing the total to 10:** The Human Body and The Animal Kingdom (Science), The Middle Ages (History) and Music (Arts & Culture). Same setup: a skill and a 100-level syllabus, no levels yet, kept out of the app. The image list adds 102 images for them, and reuses 48 existing ones.
- **Four more trees planned to 100 levels:** World Geography, How Money Works, Art History and Everyday Technology, one for each subject that had none.
  - Each has a `skill.json` and a `syllabus.json` (10 chapters, 100 level titles and objectives). No levels are written yet.
  - A skill with a syllabus but no levels stays out of the app bundle and the Supabase import (`build-content.ts`, `import-content.ts`). So these trees don't show in the app until Level 1 exists.
  - `docs/image-manifest.md` now covers all six trees: 117 more images, with 25 shared across the new trees and 16 reused from the Astronomy, Rome and app lists.
- **Fact-check complete: all 943 claims** have an automated fact-check against independent sources. The session's web-search allowance was raised to 2,000. Nothing is marked verified: all 979 ledger records stay `unverified` until a person checks the cited page.
  - **This round:** the last 599 claims came back 579 corroborated, 11 corrected (including one I corrected myself from my own search: the 2019 Nobel was split, half to Peebles) and 9 disputed and hedged. Cards, questions, summaries and recaps were updated to match.
  - **Astronomy changes:**
    - The hottest stars are blue, not blue-white.
    - The Sun is hotter and brighter than most stars (most are red dwarfs), not "a thoroughly average star".
    - It looks white from space and yellowish only through our air.
    - The ecliptic also crosses Ophiuchus.
    - An exoplanet is any planet outside the solar system, including free-floating ones.
    - Mayor and Queloz shared *half* of the 2019 Nobel.
    - A few meteor showers (the Geminids) come from an asteroid.
    - The observable universe holds billions of galaxies, *many* (not each) with billions of stars.
  - **Rome changes:**
    - More than a thousand Vindolanda tablets have been found, not hundreds.
    - Etruria was mostly Tuscany, plus parts of Lazio and Umbria.
    - The tribune's veto covered other magistrates, but probably not a dictator.
    - Pompey was *hailed* Magnus rather than taking the name himself.
    - Nero blaming the Christians rests on Tacitus.
    - The patrician monopoly on magistracies is tradition.
    - The Colosseum is "also known as" the Flavian Amphitheatre.
    - Where Romanian took shape is debated.
  - **Totals:** 905 corroborated, 24 corrected and 14 disputed. `check` and `test:db` pass.
- **Fact-check, wave 2 (claims with numbers first):** 214 more claims checked the same way (independent sources, never marked verified).
  - **Results:** 204 corroborated, 7 corrected, 3 disputed and hedged. Cards, questions and recaps were updated to match.
  - **Astronomy changes:**
    - The Local Group has about 100 or more galaxies, not "more than 50".
    - Genzel and Ghez shared *half* of the 2020 Nobel Prize in Physics.
    - The AU is roughly the average Earth–Sun distance, and has been fixed exactly since 2012.
  - **Rome changes:**
    - Hannibal's attack on Saguntum sparked the Second Punic War.
    - Most of his elephants survived the Alps and died soon after.
    - Valerian was the *first* emperor captured by a foreign enemy, not the only one.
    - Italians gained citizenship *during* the Social War.
    - The Five Good Emperors adopted heirs because none had a surviving son.
    - Brutus and 509 BCE are framed as tradition.
    - Virgil is "widely regarded as" the greatest Augustan poet.
  - **Coverage:** 344 of 943 claims now have a fact-check (322 corroborated, 14 corrected, 8 disputed). The rest (599) haven't been checked: this session's web-search allowance (200 searches) ran out partway through. A claim with no fact-check was simply not checked; nothing was marked corroborated without a source.
- **Fact-check pass on the 130 riskiest claims** (every claim flagged with a pre-check note while drafting, in both trees). The cited Britannica and NASA pages are blocked from this environment, so each claim was checked against independent sources found by web search. That is recorded as a new `factCheck` field in the ledger (result, evidence, up to three URLs, previous wording), which is explicitly **not** verification. All 979 records stay `unverified` until a person checks the cited page.
  - **Results:** 118 corroborated, 7 corrected, 5 disputed and reworded to hedge. Each change was carried into the cards, questions and recap lines that state the claim.
  - **Astronomy changes:**
    - Jupiter has around 100 known moons, not "dozens".
    - More than 6,000 exoplanets are confirmed, not 5,000.
    - The Sun being single is normal: most stars are single red dwarfs. It is not "a bit of a loner".
    - Andromeda: a 2025 study puts the chance of a merger within 10 billion years at about 50%. Level 83, its question and the Level 98 forecast timeline were updated.
    - Kuiper Belt comets are the short-period ones that return every few years, not every few decades or centuries.
    - Level 2 no longer says the Sun's core fuses "trillions" of nuclei a second. The real rate is about 10^38.
  - **Rome changes:**
    - Most kings were chosen with the Senate's and people's approval, not all of them.
    - Cicero said boys *no longer* memorized the Twelve Tables in his day.
    - Historians debate whether the pilum was designed to bend.
    - Tacitus tied the "secret of empire" to Nero's fall in 68 CE.
    - Hadrian was the first emperor *regularly portrayed* with a beard.
    - Early-teen marriage applied to elite girls; most others probably married in their late teens.
    - Paris and Vienna *grew from* Roman towns (they were Celtic settlements first).
  - **Checks:** 0 validator errors, and `check` and `test:db` pass. Results are in `docs/verification/*.md` and `*.csv` under "Fact-check".
- **Accounts are required; guest mode removed.** Per the new product decision (CURRENT_PRODUCT_DECISIONS §14, product rule 12), learners sign in before any progress exists: open the app → choose a sign-in method → onboarding → Level 1. Signing in creates the account on first use.
  - **Methods:** Sign in with Apple, Sign in with Google, phone number (SMS code) and email (code) as the fallback.
    - Native Apple uses `expo-apple-authentication` with a hashed nonce. Native Google uses `@react-native-google-signin/google-signin`. Both pass an ID token to `signInWithIdToken`.
    - Web uses OAuth redirects with PKCE.
    - The app offers only the methods the project reports as enabled (`/auth/v1/settings`) and the device supports, so a missing credential hides a method rather than falling back to a guest.
  - **Removed:**
    - anonymous sessions (`signInAnonymously`);
    - the guest, linking and device-only states, and email linking to an anonymous user;
    - the "guest progress won't be added" warning, and the guest sign-out rule;
    - the guest-merge and guest-cleanup open decisions;
    - the `account_link_*` analytics and the `saved_account_share` metric.
  - **Server:** migration `20261001000000_accounts_required.sql`.
    - `handle_new_user()` refuses anonymous users, deletes any that exist, and swaps in `sign_in_started` / `sign_in_completed` events (props: `method` only).
    - `admin_learning_health` reports `new_accounts_by_method` in place of `saved_account_share`.
    - `config.toml` has anonymous sign-ins off and phone/SMS on, with Apple, Google and Twilio sections ready but off until credentials exist.
    - `supabase:check` now fails if anonymous sign-ins are on or no method is enabled, and reports each method.
  - **App:**
    - a new sign-in screen (the premise moved there, so onboarding is now two steps: pick a skill, the deal);
    - `AuthGate` redirects every signed-out route to sign-in;
    - device-side sessions, onboarding and active skill are stored per account;
    - Profile shows the account with Sign out;
    - Delete account returns to sign-in and creates nothing in its place;
    - analytics are only sent under a signed-in account, and the sanitizer now also drops anything that looks like a phone number;
    - `app.config.ts` adds the Apple entitlement, and the Google plugin once `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` exists;
    - store builds set `EXPO_PUBLIC_RELEASE=1` to refuse to run without Supabase.
  - **Development without credentials:** the local backend is now a harness with simulated accounts (all four methods; every code is `123456`), labeled on screen. Progress belongs to the simulated account, never the device. Pre-accounts device progress is dropped on launch.
  - **Tests:**
    - the new `accounts.test.sql` (anonymous inserts refused; every method creates a profile; the funnel is logged);
    - updated analytics, fixture and probe tests; core account tests rewritten;
    - `fake-supabase.mjs` now handles phone/email codes, ID tokens, the web OAuth redirect with PKCE, and settings, and refuses anonymous sign-up.
    - Both e2e suites sign in first. Remote covers a phone sign-in with a wrong code first, a reinstall that restores 195 XP and skips onboarding, a Google OAuth account with its own onboarding, and deletion. Local covers sign-out, a second account on the same device, and deletion.
    - `check`, `test:db` (6 suites) and both e2e suites pass.
  - **Not verified (needs credentials and a device build):**
    - the native Apple and Google sheets (typechecked only);
    - real SMS delivery;
    - real Apple/Google OAuth.
- **Ancient Rome complete to Level 100.** Chapter 10, "The Fall and the Legacy": Alaric's sack of 410, Attila, 476 and Odoacer, why the West fell (including Gibbon and the "transformation" view), the Eastern Empire to 1453. Integration Levels 96–99 cover Rome in modern law and government, Rome in words, calendars and cities, how historians know about Rome, and the arc from 753 BCE to 1453 CE. Level 100 is the 10-question Mastery Challenge, drawn from across the tree with every question pointing back to its source card.
  - **Tree totals:** 100 levels, 327 questions, 100 concepts and 498 claims, all unverified. Britannica is the working reference, plus one MIT News article on Roman concrete.
  - **Checks:** 0 validator errors. The right answer is conspicuously the longest option in 8% of questions (limit 25%). `check`, `test:db` and both e2e suites pass.
  - **Schema:** no changes were needed. A chronology tree fits the same structure as the conceptual science tree, which is what Build Order step 35 asked us to prove.
- **Ancient Rome Levels 81–90 drafted** (Chapter 9, "Crisis, Christianity and Division": the Crisis of the Third Century, Diocletian and the Tetrarchy, the first Christians, persecution from Nero to Diocletian, Constantine and Nicaea, Constantinople, Julian the Apostate, Theodosius and the Christian empire, Adrianople; L90 is a 5-question checkpoint comparing the empire of 395 with Augustus's). 10 concepts and 53 claims (454 for Rome), all unverified. 0 errors.
- **Ancient Rome Levels 71–80 drafted** (Chapter 8, "How Rome Held an Empire": roads, aqueducts, Roman concrete (including the 2023 MIT finding on self-healing lime), the Pantheon, running the provinces, citizenship to 212 CE, Roman law and Justinian's code, money and trade, life on the frontier with the Vindolanda tablets; L80 is a 5-question checkpoint on what held the empire together). 10 concepts and 52 claims (401 for Rome), all unverified. 0 errors.
- **Ancient Rome Levels 61–70 drafted** (Chapter 7, "Life in the Roman World": insulae and the Forum, slavery and manumission, bread and circuses, gladiators (including the uncertain thumb signal), chariot racing and the factions, the baths, food and garum, Latin and the Romance languages, Roman women; L70 is a 5-question checkpoint on everyday Rome, patrons and clients). 10 concepts and 56 claims (349 for Rome), all unverified. 0 errors.
- **Ancient Rome Levels 51–60 drafted** (Chapter 6, "Emperors Good and Bad": Tiberius and the succession problem, Caligula and hostile sources, Claudius and Britain, Nero and the Great Fire (including the "fiddling" myth), the Year of the Four Emperors, the Flavians and the Colosseum, Pompeii, Trajan at the greatest extent, Hadrian's Wall; L60 is a 5-question checkpoint on the Five Good Emperors). 10 concepts and 57 claims (293 for Rome), all unverified. 0 errors. Correct answers are the longest option in 11% of Rome questions (limit 25%).
- **Ancient Rome Levels 41–50 drafted** (Chapter 5, "Augustus and the New Empire": Octavian and the Second Triumvirate, Antony and Cleopatra, Actium, Augustus and the Principate, the Pax Romana, the city of marble, Virgil's Aeneid, the Julian calendar with July and August, the Teutoburg Forest). Level 50 is the 7-question milestone "From Republic to Empire", with a timeline from 133 to 27 BCE and a Republic vs. Principate comparison. 10 concepts and 52 claims (236 for Rome), all unverified. 0 errors.
- **Answer-length tell fixed for Rome.** After Level 50 the validator warned that the right answer was noticeably the longest option in 47 of 162 Rome questions, above the 25% limit. I rewrote 28 questions in Levels 31–50, mostly by making the distractors as specific as the answer and in a few cases by shortening the answer. The warning is gone.
- **Ancient Rome Levels 31–40 drafted** (Chapter 4, "The Republic in Crisis": the Gracchi, Marius and the landless army, Sulla's march on Rome and the proscriptions, Spartacus, Pompey, Cicero and Catiline, the First Triumvirate, Caesar in Gaul, the Rubicon; L40 is a 5-question checkpoint on the Ides of March and why killing Caesar did not save the Republic). 10 concepts and 47 claims (184 for Rome), all unverified. 0 errors, and no quality warnings other than verification. Seven short levels got a sourced extra card each (for example Julia's marriage, Cicero's letters, "alea iacta est").
- **Ancient Rome Levels 21–30 drafted** (Chapter 3, "Rome Against Carthage": Carthage, the First Punic War and the corvus, Hannibal over the Alps, Cannae, Fabius the Delayer, Scipio at Zama, the Macedonian wars and Greek culture, the destruction of Carthage and Corinth, the legion; L30 is a 5-question checkpoint on how Rome came to dominate the Mediterranean). 10 concepts and 43 claims (137 for Rome), all unverified. 0 errors, and no quality warnings other than verification. The thin levels got real content (Carthage's age, Hannibal's 15 years in Italy, the bending pilum), not filler.
- **Ancient Rome Levels 11–20 drafted** (Chapter 2, "The Early Republic": res publica and SPQR, consuls and the dictatorship, the Senate, patricians and plebeians, the Twelve Tables, tribunes and the veto, Cincinnatus, the Gallic sack, conquering Italy; L20 is a 5-question checkpoint on Polybius's mixed constitution). 10 concepts and 49 claims (94 for Rome), all unverified. 0 errors, and no quality warnings other than verification.
- **Second skill tree started: History · Ancient Rome.** Build Order step 35 says a second tree "with a different structure" should prove the schema isn't overfit. The roadmap names Ancient Rome alongside Astronomy as a flagship prototype, and Rome is chronology (people, events, cause and effect) where Astronomy is conceptual science.
  - **Syllabus:** a 100-level syllabus in 10 chapters: founding and kings, the early Republic, Carthage, the Republic's crisis, Augustus (Level 50 milestone), the emperors, daily life, how Rome held an empire, crisis and Christianity, the fall and legacy (96–99 integration, Level 100 Mastery).
  - **Golden 10:** Levels 1–10 drafted to the Astronomy standard (11 concepts, 45 claims, all unverified, Britannica as the working reference). The validator reports 0 errors, with no quality warnings other than verification.
  - **Schema:** no changes were needed.
  - **Single-skill assumptions fixed in code:**
    - Home always showed the first skill. It now follows an **active skill**, set by onboarding and whenever a level starts from any skill.
    - The DB import test compared one skill's top level with the total. It now checks every skill's 1..n.
    - The authoring helper was hard-wired to Astronomy.
  - **Tests:** a new e2e check confirms choosing Rome on the Skills tab moves Home to it. `docs/build-order.md` statuses were refreshed; they had fallen behind.
- **In-app account deletion** (App Store / Google Play requirement; it was the pre-launch gap flagged in `docs/accounts.md`).
  - **Server:** `delete_my_account()` removes the auth user, and every learner table cascades through `profiles`. A new SQL suite checks all 11 tables are emptied for that learner and nobody else is touched, and that anonymous callers are refused.
  - **App:** Profile → **Delete account** → one honest confirmation. It lists what goes, notes that store subscriptions are cancelled in the store, and offers "Keep my account". The app then restarts at onboarding as a fresh guest, with the local session, level sessions and queued analytics cleared. Offline builds offer **Erase my progress**.
  - **Also:** a new `danger` button variant for irreversible actions only (outlined coral, never a filled red slab). 6 new e2e checks across both suites. `CLAUDE.md` now requires any new learner-data table to cascade from `profiles`.
- **Hard editorial rule: no em dashes (U+2014) in BrainScroll-authored text.** It's recorded in `CURRENT_PRODUCT_DECISIONS.md` §13, product rule 11, `content-guide.md` "Editorial rules" (with a rewrite table and an AI-prompt line) and `CLAUDE.md`.
  - **Audit:** about 150 occurrences were each rewritten by what the dash was doing (comma, colon, semicolon, parentheses, period or conjunction; never a mechanical swap). That covers:
    - 23 in curriculum and content data (L1–L10, concepts, the skill description, a source note, a ledger note)
    - app and admin strings, where an em dash used as an empty-value placeholder became "n/a"/"none"
    - validator and script messages, SQL comments and code comments
    - the product specs; node-diagram connectors became box-drawing lines
    - the verification report generator, which produced 1,405 of them
  - **Exempt:** verbatim source quotes (`supportingQuote`) and source title, publisher and URL. The `.docx` snapshots in `docs/source/` are archives of the originals and were left as-is.
  - **Enforcement:**
    - `validate:content` makes an authored em dash an **error**, which blocks publishing and CI, and names the field path
    - new `npm run lint:copy` in `check` scans 248 non-curriculum files
    - Content Admin text fields flag an em dash as you type
    - the curriculum authoring helper refuses them
    - core has 5 new unit tests
- **UI Foundation Pass** (`docs/design-system.md`; screenshots in `docs/ui/`). The principle: **learning is calm, progress is powerful.** No mechanics changed: question counts, first-attempt XP, source-card reinforcement, required resolution, review, the daily cap and progression all behave exactly as before, and both e2e suites pass.
  - **Design system:**
    - tokens: a type scale with an 18/28 reading size, reading width, touch sizes, soft state colours, elevation, **reward-only glow**, motion, haptics (`expo-haptics`) and reduce-motion
    - `components/ui/` primitives: text, buttons (depress on press; primary/secondary/ghost/success/mastery), surfaces, progress (lesson bar, pips, chapter rail), answer cards, feedback panel, evidence block, lesson shell, and reward pieces (count-up, reveal, pop, halo, emblem, stars, stat tile)
  - **Lessons:** a quiet lesson shell (✕ · thick progress · ⚑; content at reading width; one bottom-anchored action). Learning cards are typographic pages. **Questions are select → CHECK** with large lettered answer cards. In-context feedback appears in a tinted footer. A wrong answer crosses out the pick and shows **Take another look** under the prompt, then asks to choose again. Review sessions use the same shell.
  - **Progression:** Level Complete is now the payoff: outcome headline, XP count-up with halo, the skill emblem counting up, progress toward the next ★, and one line of detail. It turns gold only for a mastery star. Daily Complete got the same treatment.
  - **Tab screens:**
    - Home has one dominant Continue card; Review becomes primary after the cap.
    - Skills: emblem, rank, stars, chapter rail and road to ★, with coming-soon subjects.
    - Review: one calm card, not an inbox.
    - Profile is now a character sheet: Knowledge Level emblem, title slot, three honest empty trophy slots, subject ranks and skills.
    - Onboarding, the tab bar, the report sheet and the account card were restyled too.
  - **Bug fixed along the way:** the Review tab's focus effect looped forever (its `reviewQueue` dependency changed on every snapshot refresh). It predates this pass; a new e2e check visits the tab.
- **Product decision recorded: Unlimited perks.** Unlimited's only gameplay/progression advantage is removing the daily new-level cap; it may also include non-progression cosmetic or personalization benefits (themes, profile customization). Accomplishment cosmetics (mastery frames, quest rewards, rare trophy treatments, prestige effects) stay earned. Updated product-rules rule 10, CURRENT_PRODUCT_DECISIONS §8, README, CLAUDE.md, social-expansion.md (open question closed) and code comments.
- **Analytics and content reporting** (`docs/analytics.md`). It measures learning and product health, **never time spent**: no durations anywhere, and a test enforces it.
  - **Server** (migration `20260929`):
    - service-role insight functions built on existing records: per-question first-try rate and **first-pick counts per option**, delayed-recall rate, level funnel with the card where people leave, return days, daily-cap reach, saved-account share
    - an allowlisted, rate-limited `log_events`
    - a validated, deduped, rate-limited `report_content`; direct inserts are now blocked
  - **Client:** a 7-event catalog in core, mirrored in SQL with a sync test. It's sanitized twice: typed flat props, no emails. The queue batches and persists across reloads; offline builds send nothing, and `EXPO_PUBLIC_ANALYTICS=off` turns it off.
  - **App:** a ⚑ **Report a problem** sheet in the level player for the card or question on screen.
  - **Content Admin:** after `npm run insights:pull`, there's a Learner health view, a per-level Learners tab and plain-language flags (hard question, tempting distractor, never-picked distractor, weak recall, drop-off card), shown only with at least 20 learners.
  - **Tests:** a new SQL suite, core, sync, pull and admin tests, and 6 new remote e2e checks, including that a report lands and that no email reaches analytics.
- **Account persistence: anonymous → permanent** (`docs/accounts.md`). A guest adds an email to the **same** Supabase user, so progress is never migrated and can't be lost. Flows:
  - save progress (email → one-time code)
  - sign in on another device (never creates accounts)
  - an email already in use points to sign-in, warning first that guest progress isn't merged
  - saved accounts can sign out to a fresh guest; guests can't sign out and orphan their progress

  It uses codes rather than magic links, so no deep links are needed. Pieces:
  - core `account.ts`: states, error mapping, player-facing copy
  - account methods on both backends; local builds report device-only saving
  - a Profile **Account** card
  - the Supabase stand-in now speaks the email-code endpoints

  E2E: 11 new remote checks, including that linking keeps the same user id and every XP point and that sign-in restores progress, plus 1 local check. Core has 4 new unit tests. Apple/Google are not set up. Open decisions are listed in the doc: merging guest progress, cleaning up abandoned guests, and **in-app account deletion, required before store launch**.
- **Supabase integration prep (no credentials needed).** Connecting a real project is now a five-step checklist at the top of `docs/supabase-setup.md`:
  - **`npm run supabase:check`**
    - Offline, it validates the app's URL and key and **refuses a service_role/`sb_secret_` key**. It also confirms `.env.local` is gitignored and that the importer key really is a secret key.
    - Online, it runs read-only probes: auth reachable, anonymous sign-ins and email enabled, base and latest migrations applied, content published, and server functions present.
  - A committed `backend/supabase/config.toml`, so there's no `supabase init`. It enables anonymous sign-ins and email, and sets the deep-link redirects and a local email catcher.
  - `app/.env.example`.
  - The app itself now refuses to start remote mode with a secret key or malformed URL. The check is `checkClientConfig` in core, shared with the CLI.
  - It handles both legacy JWT keys and the new `sb_publishable_`/`sb_secret_` keys.
  - Tests: 4 core unit tests plus 4 probe tests against a stub. `e2e:remote` still passes, and local play is unchanged.
- **Content Admin v1** (`npm run admin` → http://127.0.0.1:4321; `admin/README.md`). It's a local, credential-free tool that reads and writes `content/` directly:
  - browse by syllabus chapter, with status and issue badges
  - edit level metadata, concepts, cards (every type; add, reorder, delete) and questions (options, rationales, source cards), with character budgets taken from core
  - a raw JSON tab
  - a phone-width preview in the app's colors that walks the answer flow, including "Take another look"
  - per-level and global validation (the same validator and revision baseline as the CLI)
  - read-only concept, claim-status and source views
  - **draft/published control:** drafts save even with errors; `in_review` and `published` are refused while the level has errors, so nothing unverified can be published

  Safety: schema-invalid saves are refused, writes are atomic, and it binds to 127.0.0.1 with Host and header checks. Six API tests (`admin/test`) cover these and run in `npm test`/`check`. I also drove the UI in Chromium: edit and save, preview answer flow, publish refusal, and the concepts and sources views.
- **Astronomy Levels 91–100 drafted: the tree is complete** (Chapter 10, "The Universe": the Big Bang, the CMB, the first stars and galaxies, dark energy, the observable universe, four integration levels (atoms to galaxies, how we know, cosmic futures, open questions), and **the Level 100 Mastery Challenge with 10 questions**). 9 concepts and 31 claims (445 total), all unverified. The two concepts that had been taught but never tested are now tested: precession in L98, asterisms in L100. That clears the last content-quality warning, so the only warnings left are about verification.
- **One schema adjustment for the Mastery Challenge.** The validator required every level to teach a new concept, but the Mastery structure allows zero learning cards. So a `mastery` level may now be pure recall, and there's a unit test for it. This is a rule clarification, not a workaround: the other level types still must teach. L100 has a single intro card, 10 recall questions spread across all ten chapters (most combine two concepts), and cites the sources behind every card it points back to.
- **Word-count fixes in L83, L84 and L86.** Those three galaxy levels were under the 100-word norm; each got a claim-backed fact card. L96 q2 now tags the concept its timeline card actually states.
- **Astronomy Levels 81–90 drafted** (Chapter 9, "Galaxies": galaxy types, the Milky Way's structure, collisions and the Andromeda merger, the Local Group, dark matter, clusters and gravitational lenses, quasars, Hubble's expanding universe, redshift; L90 is a 5-question checkpoint on the ladder of scale up to the cosmic web). 11 concepts and 35 claims (414 total), all unverified. The checks caught a prompt that contained its answer (L81) and feedback that gave away a later answer (L83); both fixed.
- **Astronomy Levels 71–80 drafted** (Chapter 8, "Extreme Objects and Other Worlds": neutron stars, pulsars, black holes, the event horizon and the EHT image, Sagittarius A*, gravitational waves, finding exoplanets, the habitable zone, the search for life; L80 is a 5-question checkpoint). 10 concepts and 43 claims (379 total), all unverified. I adjusted one metaphor to avoid confusion ("heard" gravitational waves, next to a question explaining that sound can't cross space).
- **Astronomy Levels 61–70 drafted** (Chapter 7, "The Lives of Stars": parallax and parsecs, luminosity vs. brightness, the H–R diagram, the main sequence, binary stars, stellar nurseries, red giants and planetary nebulae, white dwarfs, supernovae and star stuff; L70 is a 5-question checkpoint on how a star's mass decides its fate). 10 concepts and 39 claims (336 total), all unverified.
- **Astronomy Levels 51–60 drafted** (Chapter 6, "The Sun and the Solar System's Edge": dwarf planets and Pluto, the Kuiper Belt, comets, meteors, the Oort Cloud, the Sun's layers, sunspots, space weather, how the solar system formed; L60 is a 5-question checkpoint on the heliosphere and where the solar system ends). 10 concepts and 43 claims (297 total), all unverified. The leak checks caught two question sets whose earlier feedback gave away a later answer; both were rewritten.
- **Astronomy Levels 41–50 drafted** (Chapter 5, "The Planets Up Close": Mercury, Venus, Earth's protection, Mars's lost water, the asteroid belt, Jupiter's storms and moons, ocean worlds, Titan, Uranus and Neptune). **Level 50 is the first 7-question milestone**, and the schema held without changes. It deliberately tests the four solar-system concepts that nothing had tested yet (the Sun's mass share, Mars's color, Jupiter's mass, Saturn's rings), so they can now come back in review. 10 concepts and 52 claims (254 total), all unverified. I also fixed my own slips before commit: a distractor in L43 was actually true ("largest rocky planet"), and L46 mentioned Europa's ocean one level before it's taught.
- **Astronomy Levels 31–40 drafted** (Chapter 4, "Light, Telescopes and Spacecraft": the spectrum, spectral lines and helium, refractors vs reflectors, space telescopes and Hubble, radio astronomy, infrared and Webb, orbits and escape velocity, Voyager, Apollo; L40 is a 5-question checkpoint on matching wavelengths to tools). 15 concepts and 62 claims (199 total), all unverified. The new checks caught this batch's thin levels (68–95 words): each got another substantive card. They also caught three taught-but-untested concepts, which were folded in or tested, and a figure-check false positive on "Level 10" references.
- **Stronger content validation (item 5, pulled ahead of the admin tool).** Near-duplicate and answer-leak checks matter most before more levels are written, so this came first. New `quality.ts` checks cover the spec's pre-publish list and more: unsupported numbers on cards, cards with no claim, prompts containing their answer, feedback that gives away a later answer, identical and near-duplicate questions, the "longest answer is right" tell, evidence cards that don't state the tested concept, all/none-of-the-above, concept coverage (re-teaching, taught-but-untested, unused), unused sources, reference-only assets, card caps, file-name/number mismatches, and revision/stable-ID safety against the committed bundle. `validate:content -- --json` for tools. 14 new unit tests. **They found real issues, now fixed:** in 45 questions (Golden levels included) the right answer was conspicuously the longest option. Those distractors were rewritten to be as specific as the answer, or the answer was shortened. L6's connection question near-duplicated L5's, so it was rewritten to connect phases and seasons. An L10 rationale gave away two other answers. Five cards had figures with no claim behind them. Six taught concepts are still never tested: four are reserved for the Level 50 Solar System milestone (Sun's mass share, Mars's color, Jupiter's mass, Saturn's rings), and asterisms and precession wait for a later level.
- **Astronomy Levels 21–30 drafted** (Chapter 3, "How We Figured It Out": ancient sky-watchers, Eratosthenes, the geocentric model, Copernicus, Galileo, Kepler, Newton, measuring the AU, Uranus and Neptune; L30 is a 5-question checkpoint capped by Bessel's 1838 stellar parallax). 14 concepts and 42 claims (145 total), all unverified. History sources are Britannica (`reference_only`, facts cited, nothing reproduced) and NASA, all marked "URL not opened". The authoring helper now enforces the schema's text budgets before writing.
- **Astronomy syllabus 1–100** (`content/skills/science.astronomy/syllabus.json`): 10 chapters with a title and objective for every level, following the spec's band purposes (fundamentals → core systems → intermediate depth → broader context → advanced synthesis → integration → Mastery Challenge). New validator checks: syllabus covers 1..N in chapters, and a drafted level whose title drifts from the plan gets a warning.
- **Astronomy Levels 11–20 drafted** (Chapter 2, "The Sky Above You": daily spin, the year and leap years, constellations, the North Star, the ecliptic, retrograde motion, tides, the Moon's origin, craters and maria; L20 is a 5-question checkpoint). 21 new concepts and 48 new claims (103 total), each tied to the cards that state it and logged as unverified. 8 new sources, recorded as "URL not opened": this environment has no web access, so a human must confirm each page. Regular levels have 3 questions (recall, understanding, connection) and connection questions reach back to earlier levels. Answer positions stay balanced (13–17 per letter over 64 questions). The DB content-import test now derives its expected counts from the curriculum instead of hard-coding 10 levels.
- **Claim verification system (Astronomy 1–10).** Every factual statement on a card is now a claim: a concept fact with a stable ID (`fact.astronomy.*`), exact text, sources and the `cardIds` that state it. 55 claims cover Levels 1–10; 29 are new, capturing card statements that had no fact behind them. Verification lives in a separate ledger, `content/verification.json`, with 57 (claim, source) records, **all `unverified`**. Ten carry drafting pre-check notes: one flags a real wording problem ("trillions" of fusions per second in L2 understates ~10³⁸) and should become a revision. The validator blocks publishing any level whose stated or taught claims aren't verified, and requires who/when/quote for `verified`. New commands: `verify:report` (checklist grouped by source page, plus CSV, in `docs/verification/`), `verify:sync`, `verify:record`, `verify:import-csv`. L8 now lists `source.nasa_moon_facts`, which one of its claims uses.
- **Stale-rule sweep.** README now describes review XP as +10 for a scheduled item right on the first try (corrections earn nothing). `docs/social-expansion.md` no longer cites the retired 20-hour delayed-recall rule, and uses `final_encounter_resolved_at` (no pass/fail language). `CLAUDE.md` no longer bans leaderboards outright: they are post-MVP, friends-only and weekly, matching the decisions. No other contradictions with `CURRENT_PRODUCT_DECISIONS.md` found in docs, code or app copy.
