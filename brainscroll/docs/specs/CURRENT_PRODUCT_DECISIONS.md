# BrainScroll: Current Product Decisions

This file records product decisions made after parts of the converted DOCX specifications were authored.

> **Status: merged (2026-09-23).** Every item below is now reflected in `PRODUCT_ROADMAP.md`, `BUILD_ORDER.md`, `VISUAL_DIRECTION.md` and `SOCIAL_REWARDS.md`, and implemented where it applies to the MVP (`packages/core/src/constants.ts`, the SQL migrations). This file remains as a concise decision record.

## 1. Learning first, testing second

BrainScroll is a learning app, not a quiz app. A normal level should feel like an interesting learning encounter followed by lightweight checks that reinforce the material.

**Depth (owner decision, 2026-09-25):** the goal is to make the concept being taught *memorable*. Priority order: **learn > interesting > fun**. Each card makes its one idea interesting (how we know it, why it happens, a concrete sense of scale) and never wanders into neighboring topics, however interesting: those get their own level. A level should never feel like reading a bare fact, and never like a tour of tangents. This replaced the earlier 2–4 short cards of 100–250 words.

Typical normal level:

- 2–5 focused learning/reading cards, each one short paragraph (about 50–90 words).
- Roughly 150–320 words total, depending on topic.
- Optional image, map, timeline, diagram, comparison, or connection card.
- 3 questions.
- Roughly 3–6 minutes total.

The normal three questions should generally cover:

1. **Recall:** did the learner retain the core fact or idea?
2. **Understanding:** do they understand why it happened, how it works, or why it matters?
3. **Connection:** can they connect it to another concept, event, system, or previously learned idea?

## 2. Canonical encounter question counts

These counts are locked:

| Encounter | Questions |
|---|---:|
| Regular level | 3 |
| 10-level checkpoint | 5 |
| Level 50 milestone | 7 |
| Level 100 mastery challenge | 10 |
| Review | Variable, based on due concepts |

The UI does not need to advertise the count. These are content/product rules.

## 3. Wrong answers teach; they do not create failure loops

Every question in a normal level must eventually be correctly resolved before the level completes.

If a learner answers incorrectly:

1. Keep the question in context.
2. Show the specific learning card / verified evidence that supports the answer directly beneath it.
3. Let the learner skim the material.
4. Present the choices again.
5. Require the learner to select the correct answer.

Do not restart the whole lesson. Do not use hearts, lives, negative XP, or a traditional fail screen.

Core rule:

> First-attempt retention determines reward quality. Correct resolution determines progression.

## 4. Regular-level XP: first attempt only

The first-attempt score determines the XP award. Correcting missed answers is required for completion but does not restore lost XP.

| First-attempt result | XP |
|---|---:|
| 3 / 3 | 100 XP |
| 2 / 3 | 70 XP |
| 1 / 3 | 35 XP |
| 0 / 3 | 15 XP |

Additional rules:

- Primary level XP is awarded only once.
- Replaying a completed level cannot farm leaderboard XP.
- The first-attempt result is immutable for that completion.
- Correction attempts award no extra XP.
- Missed concepts receive earlier/higher-priority review scheduling.

### Perfect streak (owner, 2026-10-01)

A level cleared with every question right on the first try, straight after other perfect levels, pays more. The 2nd perfect level in a row pays **1.1×**, the 3rd **1.2×**, and so on, up to **1.5×** (+50%). It works on any level type, from that level's own first-attempt XP.

- **What counts:** first clears of levels only. Reviews, chapter reviews and quests neither build it nor break it, and replays don't count. A level cleared with any first-try miss ends it, and the next perfect level starts again at 1×.
- **How it's paid:** the bonus is part of that level's single `LEVEL_COMPLETE` event, so there's still one XP row per level. The streak is derived from completed levels, never stored as a counter (SQL `perfect_streak_before`, core `perfectStreakBefore`; `XP.PERFECT_STREAK_*` and `app_settings.perfect_streak_*`).
- **Where it shows:** Level Complete only (lessons stay quiet). A first perfect level says what the next one would pay ("×1.1"). Later ones show the multiplier and the bonus. Ending a streak shows nothing: it ends quietly.
- **Why a cap:** nothing dwarfs a level. At most a perfect regular level pays 150.

## 5. Checkpoint / milestone / mastery XP

Use separate configurable bands rather than scaling normal-level XP linearly.

### 5-question checkpoint (max 150 XP)

| First-attempt result | XP |
|---|---:|
| 5 / 5 | 150 |
| 4 / 5 | 105 |
| 3 / 5 | 60 |
| 0–2 / 5 | 25 |

### Level 50 milestone (7 questions, max 250 XP)

| First-attempt result | XP |
|---|---:|
| 7 / 7 | 250 |
| 6 / 7 | 175 |
| 4–5 / 7 | 90 |
| 0–3 / 7 | 40 |

### Level 100 mastery (10 questions, max 500 XP)

| First-attempt result | XP |
|---|---:|
| 10 / 10 | 500 |
| 8–9 / 10 | 350 |
| 5–7 / 10 | 175 |
| 0–4 / 10 | 75 |

All missed questions still require evidence-based correction before the encounter resolves.

## 6. Level 100 mastery star

The normal mastery/prestige star does **not** require a minimum first-attempt score.

The star means the learner completed and correctly resolved Levels 1–100 and the Level 100 mastery encounter.

After all 10 mastery questions are correctly resolved:

- Award the first mastery/prestige star.
- Award XP according to the first-attempt mastery band above.
- Unlock Levels 101–200 when available.

Do not stack a separate old `+250` Level 100 mastery bonus on top of the 500-XP mastery encounter.

A future rare accomplishment may recognize exceptional first-attempt mastery performance, but it is not required for the standard star.

## 7. Review behavior

Review also requires correct resolution.

If a scheduled review question is wrong:

1. Record the first-attempt miss.
2. Show the relevant supporting learning card/evidence.
3. Require the learner to select the correct answer before the review item resolves.
4. Increase review priority / reduce recall confidence as appropriate.

Review XP:

- Correct on the first attempt: **+10 XP** for that scheduled review occurrence, except the quick re-check after a missed review and a question whose answer was checked outside review since it came due (both earn no XP; security review, 2026-09-26).
- Wrong on the first attempt: **0 XP** for that item, even after correction.
- Corrections award no additional XP.
- The same scheduled review occurrence cannot be replayed for farming.

Review never consumes one of the 5 daily new-level allowances.

## 8. Daily free progression

- Free users: **5 new resolved levels per day**.
- Unlimited users: no new-level daily cap.
- Unlimited’s only gameplay/progression advantage is removing the daily new-level cap. Unlimited may also include non-progression cosmetic or personalization benefits (themes, profile customization).
- Unlimited never provides exclusive knowledge, stronger progression, better XP rates, exclusive achievement trophies, or anything that implies greater mastery.
- Cosmetics that signify accomplishment (mastery frames, quest rewards, rare trophy treatments, prestige effects) are always earned, never purchasable or subscription-gated.
- Review remains available after the cap.
- No ads, hearts, energy, gems, loot boxes, or exclusive paid knowledge.
- The subscription sells freedom to continue, not stronger stats or exclusive curriculum.
- Current working price: **$4.99/month**, with an annual option around **$39.99/year**.

At 5 / 5, completion should feel successful, not like running out of energy.

Brand voice example:

> No more doomscrolling. Go touch grass.

## 9. Weekly Knowledge Quests

Weekly Knowledge Quests are the BrainScroll equivalent of RPG questlines / boss-like objectives without literal combat.

### Standard weekly quest

Default target:

- **25 new levels total**.
- Usually **5 related skills × 5 levels each**.
- A free learner can finish in five learning days if they devote their daily allowance to the quest.
- Unlimited users can finish faster or continue unrelated skill progression in the same week.

Example: **The Roman World**

- Roman History +5
- European Geography +5
- Art & Architecture +5
- Government & Society +5
- Mythology & Religion +5

Quest progression must consume canonical **resolved level-completion events**. Merely opening or swiping through a lesson never counts.

### Final encounter

After the level requirements are complete, unlock a short final encounter: normally **3 synthesis questions** connecting the skills studied that week.

### Rewards

Weekly quests can award:

- Trophy
- Title
- Earned profile cosmetic
- Knowledge XP bonus

No coins or gems.

### No FOMO

Featured quests move into an archive such as **The Chronicle** after their live week. The main trophy, title, cosmetic, and learning remain obtainable later. A live-week completion can receive a subtle dated marker, but not exclusive permanent knowledge/status that becomes impossible to earn.

### The quest tile's day count (owner, 2026-10-01)

The skill map shows this week's quest as a tile beside the road (after Duolingo's), with a **plain count of the days left in its week** ("4 days"), or "Done" once it's finished in its week. This narrows the older "no countdowns" rule: a calm day count is allowed; urgency is not. It stays the same colour every day, never says "only" or "hurry", never turns red, pulses or grows louder near the end, and sends no reminder about it. Missing the week still only moves the quest to the Archive.

## 10. Social and reward philosophy

- No fake currency economy.
- Profile should prominently show the three rarest / most prestigious trophies, then skill levels and the broader trophy collection.
- Weekly friend leaderboards reset; lifetime mastery remains on profiles.
- Leaderboard XP must come from canonical server-side reward events.
- Premium must not multiply leaderboard XP.
- Streaks may exist quietly, but BrainScroll should celebrate accumulated knowledge rather than threaten users with streak loss.

## 11. Server-authoritative anti-farming rule

The client never decides how much XP it earned.

Canonical backend events should drive:

- XP
- skill progression
- concept mastery / review priority
- leaderboard totals
- Weekly Knowledge Quest progress
- trophies / achievements
- daily new-level allowance

Reward events must be idempotent so retries do not duplicate awards.

## 12. Build-order implications

Keep the core learning loop ahead of expansion systems.

Recommended dependency order:

1. Canonical curriculum and level schema.
2. Normal lesson player with 3-question reinforcement flow.
3. Server-authoritative resolved completion + first-attempt XP.
4. Skill progression / character sheet.
5. Review and mastery engine.
6. 5-new-level daily cap.
7. Subscription entitlement.
8. Reward event ledger / achievements / titles / profile rewards.
9. Weekly Knowledge Quest model and progress tracking.
10. Quest UI, final encounter, Chronicle/archive.
11. Friends / friend profiles / weekly leaderboards.
12. Friend-facing quest progress and later social extensions.

## 13. Editorial rule: no em dashes

BrainScroll-authored text never uses em dashes (U+2014). This covers both curriculum and product copy:

- **Curriculum:** learning cards, questions, answer choices, explanations, reinforcement text, headings.
- **Product copy:** UI copy, onboarding, achievements, trophies, titles and descriptions, Weekly Quests, notifications, subscription copy, error messages.
- **Everything else:** seed/demo content, admin-generated content, and future AI-generated content.

Replace each one by rewriting the sentence according to its purpose: a comma, colon, parentheses, a semicolon, a conjunction, a period, or no punctuation at all. Never use a mechanical global substitution.

- Exact source quotations keep their original punctuation, and so does source metadata such as source titles.
- Paraphrased, summarized or adapted material follows the rule.
- An authored em dash is a validation error, so it blocks publish-ready status until corrected.

See `docs/content-guide.md` ("Editorial rules").

## 14. Accounts are required; there is no guest mode

BrainScroll requires an account before persistent learning progress begins.

- **Flow:** open the app → choose a sign-in method → account created or signed in → onboarding → start learning. Signing in creates the account on first use, so there's no separate sign-up form. The goal is extremely low friction: one tap with Apple or Google.
- **Methods:** launch with **Sign in with Apple and Sign in with Google only** (owner, 2026-09-29: "I'd rather launch Apple and Google only. So much easier."). Apple works on iPhone (system sheet), Android (browser sign-in) and web, so a learner who changes phones keeps their account. The phone (SMS code) and email (code) flows stay in the code, switched off by the build's `EXPO_PUBLIC_SIGN_IN_METHODS` (default `apple,google`); listing them brings them back. A method appears only once it's configured. A missing credential never turns into a guest fallback.
- **Never:** anonymous user records, guest progress, guest-to-account migration, guest cleanup jobs, or merge logic.
- **Persistence:** progress belongs to the authenticated account, so it survives reinstalls and follows the learner to any device.
- **Enforcement:** anonymous sign-ins are off in the project, and the database refuses anonymous users (`20261001000000_accounts_required.sql`).

See `docs/accounts.md`.

## 15. A subject's level is the levels cleared in it

Owner decision, 2026-09-25. A subject's attribute (History, Science, …) on the Profile and the Skills tab is simply the number of levels cleared across that subject's skills: Science with Astronomy at Level 6 is "Lv. 6". It is not a curve and it is not XP. XP only feeds the overall Knowledge Level.

A subject masters like a skill band: clearing 100 levels in it earns a ★ after its name, and its name and level turn gold. The shown level then starts again from 1 toward the next ★ (the mastering level itself reads 100). This is display only; every level's XP still counts toward the Knowledge Level. `subjectAttribute()` in core computes it.

## 16. Home is the World Map; a skill's map is one step in

Owner decisions, 2026-09-25.

- **Home is the World Map** of the subjects: a grid of subject tiles under "Pick any subject", each showing its landmark and your level in it (a ring filling toward Lv. 100, gold with ★ once mastered). The subject you're playing flies a flag. There is no road between subjects, so nothing looks locked: any subject can be started any time (owner, 2026-09-26: "group them up in smaller icons to make it more clear you can choose whatever"). A Current Quest card (your skill, its level, the next level) continues where you left off.
- **Tapping a subject** opens its skill's map. A subject with more than one playable skill opens its region first, to pick the skill. The skill map's back arrow returns to the region or the World Map.
- **Review lives in the Review tab.** Owner decision, 2026-09-26: "completely move review to the review tab, no more review mentions on the main screen". The World Map and skill maps never mention review; the Review tab shows what's due and starts a session. (Daily Knowledge Complete still offers "Review what I learned" once the day's levels are done.)

## 17. Stand-in art, brand marks and the UX review's design calls

Owner decisions, 2026-09-26 ("just use generic Roman images that work for those"; "Gulf of Mexico is fine"; "can you handle the open items?").

- **Planned images that were never made use existing art.** Every level shows an image from the library; `docs/images-to-make.md` lists each stand-in so a drawn image can replace it later.
- **"Gulf of Mexico"** stays the name used in content.
- **Brand marks:** the launch screen uses Dr. Scroll's drawn mark (`splash-mark.svg`); the Google sign-in button carries Google's standard "G" in its official colours.
- **Design calls delegated to Claude** from the UX review: learning cards share one grammar (label, heading, body, "Key idea" last); on a skill's map the chapter banner is a quiet card and cleared waypoints are muted, so the next level is the only bright one; Level Complete labels its three scopes (this skill with Mastery as the long-term goal, then "Across BrainScroll"). The owner can revisit any of these.
- **Claim verification is deferred.** The owner won't hand-approve every claim. Claims whose automated check is thin (one independent page, only Wikipedia or blogs, or a cited page that couldn't be opened) are tagged `weak` and listed in `docs/verification/weak-claims.md` to revisit later; they stay in the app meanwhile. Work moves to building the app.
- **Unlimited is built to the spec** (owner chose subscriptions as the next build, 2026-09-26): $4.99/month or $39.99/year through RevenueCat, entitlement `unlimited_learning`, offered only at Daily Complete (a quiet card) and from Profile, never mid-lesson. The web build sells nothing; it points to the phone apps. A privacy policy URL is required before store submission.

## 18. Levels mean something: proof at every chapter's end

Owner decisions, 2026-09-26 (substance audit, ideas 5 and 3: "Yes").

- **Proof, not a test.** Clearing a chapter's last level (10, 20 … 100) shows its recap on Level Complete under "10 levels ago, could you have explained this?", each line checked off in turn, then "You know this now." No score sits beside it and nothing new is asked. The lines are the chapter's checkpoint recap (`learned`), so they only ever claim what the chapter taught. That level's player no longer ends on the same recap card, so it isn't shown twice.
- **What a level number means.** Each skill has a `masteryPromise`: what Level 100 makes you able to do (Astronomy: "Follow mainstream astronomy news and understand the big ideas, from the planets to the Big Bang."). Level Complete shows it under the long-term goal ("At Lv. 100: …"). On the skill map, each chapter banner carries one line of what the chapter gives you: "By Level 20: …" until it's cleared, "You know: …" after.
- **Approval by reviewed sample** (owner, 2026-09-26: "yeah i think thats fine"). A tree may publish without claim-by-claim human verification once a sample of its claims (20, two per chapter) has been reviewed against sources and the owner approves it; the tree passes with at most one factual error, which is fixed. The approval is recorded in `content/approvals.json`, and the validator then accepts that tree's unverified claims on published levels. Nothing is marked individually verified. All 16 trees passed (`docs/verification/spot-check/review/`). After the full review of every claim and its corrections (`docs/verification/full-pass/`), the owner published all 1,600 levels (2026-09-26: "After that we can publish"). From now on a correction to a level means a new revision (`revision` + 1), never an edit in place. The ten new trees were approved on the full claim review itself (basis `full-review`, 2026-09-29: "Approve and publish") and all 1,000 of their levels published.
- **Later chapters ask more.** Every tree follows the understanding arc and Dr. Scroll's teaching asides in `docs/writing/chapter-brief.md` (content rules, no new app systems). The 16 existing trees were retrofitted (2026-09-26, owner: "Go ahead"): from Level 61 each regular level's connection question reaches an earlier chapter, and Dr. Scroll has at most one aside per level, always a teaching move. Choose For Me (idea 2) is built: it sits under the World Map's subject grid.

## 19. Learning streaks

Owner decisions, 2026-09-26 ("i want streaks"; any learning counts; visible, no guilt).

- **What counts:** a day, in the learner's time zone, on which they cleared a new level or answered a scheduled review. Replays and practice don't count. The streak is derived from those records (SQL `learning_streak`, core `streakFrom`), never stored as a counter.
- **What it does:** `current` is the run ending today, or yesterday while today isn't counted yet; missing a day resets it quietly; `longest` is kept forever.
- **Where it shows:** a flame and the day count in the World Map header (lit once today counts, dim until then); "Streak started" or "Day N streak" on Level Complete for the day's first learning; current and longest on Profile.
- **What it never does:** guilt-trip, warn about losing it on screen, count down, or sell freezes. Reminders (below) may push it ("Keep your 6-day streak going!") (`docs/specs/SOCIAL_REWARDS.md`). No XP, trophies or unlocks hang on it.
- **Days are dated when they happen (owner, 2026-09-30):** a streak keeps calendar days (learn any time on a day and the day counts), and each learning day is recorded as it happens, in the learner's time zone at that moment. Changing time zone later, or a content correction, never merges, splits or removes a past day, so a streak and its trophies can't be lost that way.
- **Streak trophies (owner, 2026-09-29):** 7, 30, 100, 365, 500 and 1,000 days in a row (One Week, One Month, A Hundred Days, One Year, 500 Days, 1,000 Days). Earned by the longest run ever, so they're permanent: a missed day never takes one away, and no screen warns about losing progress toward one. They're the streak's only reward.
- **Reminders (owner, 2026-10-01; replaces the single daily reminder of 2026-09-29):** "We want people to use the app, we want to notify them. We don't have to spam, but we can throw out a notification saying finish chapter 7!" Reminders are opt-in local notifications. The learner is asked once, on Level Complete after their first level, and can turn them off in Settings; there is no time to choose.
  - **When:** 8 am, noon and 7 pm every day, plus 11 pm when today isn't counted yet and there's a streak to keep. Learning today doesn't silence the rest of the day; it changes the note ("Nice work today! You still have 3 new levels to use."). A day with nothing left to do (today's levels used, no reviews due) gets no more notes.
  - **What they say:** where the learner is, written from their progress: "Finish Chapter 7 of Astronomy! 3 levels to go.", "Astronomy Level 64 is ready for you.", "4 cards ready for review." The 11 pm note pushes the streak: "Keep your 6-day streak going! One level does it."
  - **The line we don't cross:** no guilt, insults, threats or fake deadlines ("you'll lose", "last chance", "we're disappointed"). A test checks the copy (core `reminders.test.ts`).
  - **How:** planned two weeks ahead on the device and re-planned whenever the app opens or a level is cleared. Nothing leaves the device (core `reminders.ts`, `app/src/reminders/`).

## 20. Six subjects and the next ten trees

Owner decisions, 2026-09-27 ("I kind of liked the cleanliness of 6 subjects"; "the game will be mostly US based so US history is a must"; "Yeah lock it in").

- **Six subjects, each of 3 to 5 skills.** Money & Economics is retired as a subject: How Money Works joins How the World Works (same skill ID, so progress carries over). Mind & Reasoning is the new sixth subject. It shows on the World Map once its first skill is published, and on Profile as "coming soon" until then.
- **The catalog** (new trees in bold):

| Subject | Skills |
| --- | --- |
| History | Ancient Egypt, Ancient Greece, Ancient Rome, The Middle Ages, **US History** |
| Science | Astronomy, Chemistry, The Animal Kingdom, The Human Body |
| Geography | World Geography, The Oceans, **Earth, Weather & Climate** |
| Arts & Culture | Art History, Music, Architecture, **Literature**, **Film & TV** |
| How the World Works | How Government Works, Everyday Technology, How Money Works, **Computers & the Internet** |
| Mind & Reasoning | **Logic & Critical Thinking**, **Psychology**, **Probability & Statistics**, **Philosophy**, **World Religions** |

- **Build order, in waves:** (1) US History, Logic & Critical Thinking, Probability & Statistics, Psychology; (2) Literature, Film & TV; (3) Computers & the Internet, Earth, Weather & Climate, Philosophy, World Religions. The 16 existing trees can launch first; new trees ship in updates, each complete to Level 100 and reviewed like the first 16 (sample approval, then a full claim review).
- **Audience is mostly American.** US History runs from the first Americans to about 2000, balanced: where Americans still disagree, it teaches what happened and what each side argued, not a verdict. Existing trees stay world-oriented.
- **Mythology lives in Literature** (its opening chapters: Gilgamesh, Homer, the Norse sagas, the Mahabharata), not a tree of its own. **World Religions** is taught as ideas and history beside Philosophy, never filed with myths.
- **Media trees teach settled history and craft:** no recent box office, rankings or current franchises; no film stills or characters in level art; verbatim quotes only from public-domain works.
- **Level art never repeats back to back** (owner, 2026-09-27: "I'd prefer not reusing back to back. Even checkpoints."). Two consecutive levels in a tree always show different images; reusing an image elsewhere in the tree or across trees is fine. The validator treats a repeat as an error, in syllabi and levels alike.
- **Image requests stay simple** (owner, 2026-09-27): one bold object per image, no patterns or fine detail, no mirrors, no clock or dial faces. Dr. Scroll appears only in each tree's Level 100 image, awarding its gold emblem; the UI mastery badge is that emblem alone.

## 21. Chapter reviews

Owner decisions, 2026-09-29 ("from now on, you can go back and review any chapter you want"; "I'm okay with reviewing being used for xp farms. Just diminish the xp return. Most you get from a review is the minimum from a regular lesson.").

- **Any cleared chapter can be reviewed, any time,** from the Review tab: one question from each of its ten levels, rotating each time. Graded like a level (first attempt recorded, misses corrected with the source cards).
- **XP is capped at 30** (owner, 2026-09-30; it was 15, the least a regular level pays), scaled by first tries. Repeating a chapter pays again; that's allowed.
- **It moves nothing else:** no concept strength or review schedule, no daily allowance, no streak, no skill level.
- **Quests:** when a skill has no new levels left for the learner (mastered, or caught up with the content), each finished chapter review in it counts as one level toward a Weekly Quest, each chapter once per quest. This replaces any separate "refresher round" for mastered skills.

## 22. Social: friends, leagues and a feed, before launch

Owner decisions, 2026-10-01 ("friends and leagues or some social aspect are a must before launch if we want the app to spread"; "keep it pretty simple at first"). These replace the older plan in `SOCIAL_REWARDS.md` where they differ (post-MVP friends only, friend-only leaderboards, no feed).

- **One Social tab:** the league as a banner on top (tap for the standings), this week's XP against your friends, then the feed.
- **Leagues:** weekly, Monday 00:00 UTC to Monday (as quests), **up to 20 learners**, matched by brain (knowledge) level: within 20% of each other, and anyone under Level 100 is fair game. While few people are around, a learner with no match joins any league still under 5 (the safety net) before a new one starts, and a safety-net joiner doesn't set that league's level band. Ranked by XP earned that week (every ledger event except league prizes).
- **League prizes: 1st 1,000 XP, 2nd 500, 3rd 250** (an owner exception to "nothing dwarfs a level"). Place k pays only in a league of more than k learners, and only with XP that week. Paid as a `LEAGUE_FINISH` event the first time anyone in the league opens Social after the week ends; Social then shows "Last week: 1st in your league!".
- **Friends:** by **invite link** (whoever opens it becomes your friend at once: sharing it was the inviter's yes) or **exact username** (a request the other side accepts). Contacts matching can come later. Everyone gets a friendly generated username (curious_otter_4821) and can change it: 3 to 20 letters, numbers or _, with reserved and offensive names refused.
- **Feed:** the last 14 days of moments from you, your friends and your current league mates: trophies, chapters finished (every 10th level, so it stays lively), streak milestones (3, 7, 14, 21, 30, 50 days and on) and league podiums. Derived from what's already recorded; nothing is stored twice.
- **Reactions are Dr. Scroll poses only** (Applause, Celebrate, Nice one, Wow, Genius): one per person per moment, changeable. No comments and no messages.
- **Profiles** (friends and league mates only): the brain overview (brain level, total and weekly XP, streak), the **three rarest trophies** (ranked by what they take: everything mastered, subjects, masteries, then series by how far up they go), and **every subject side by side** with yours: split down the middle, you on the left and them on the right, bars growing out from the centre line: green for whoever leads, coral for whoever trails, violet when tied; a bar is full only at 100 levels
- **Avatars (owner, 2026-10-01):** every tree's avatar is open from the start (26, "variety right off the rip"). Its gold version unlocks when the learner masters that tree (Level 100), and the server checks it (`set_avatar`). There are no letter avatars: every account is given a random tree avatar when it's created (`random_starter_avatar`, assigned as the profile is made), and `set_avatar` refuses null. A learner's avatar sits in the centre of their brain ring on Profile, with the Knowledge Level in a rank pip at its lower right, like each subject icon's, and shows in leagues, the feed, friend lists and profiles. Avatar art is its own circle, so nothing draws a ring around it. **Edit profile** (the pencil at the top right of Profile) is where a learner changes their username, avatar and title. **Legendary avatars**, one per top gold trophy (Master of All as a golden Dr. Scroll, Jack of All Trades, the six subject masteries, and the top tier of each series), unlock with that trophy; the server checks (`legendary_avatar_trophy`).
- **Safety:** block (ends the friendship, hides both sides from each other, and removes their reactions) and report (a reason and an optional note for the team) on every profile. Username search is exact only, never a directory. Everything goes through server functions; no social table is readable directly. Account deletion removes every social row, including other people's rows about the learner.
- **Where it lives:** SQL `20261022000000_social.sql` (`social.test.sql`), core `social.ts`, and in local play a simulated league in `app/src/progress/localSocial.ts`.

