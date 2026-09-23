---
title: "BrainScroll Social + Rewards Expansion Spec"
status: canonical
source_docx: "BrainScroll_Social_Rewards_Expansion_Spec(1).docx"
---

> BRAINSCROLL
> SOCIAL + REWARDS
> EXPANSION SPEC
> A clean post-MVP system for friends, leaderboards, challenges, trophies, titles, earned cosmetics and visible knowledge status - without coins, pay-to-win mechanics, or fear-based engagement.
> Expansion principle: make accumulated knowledge social, collectible and prestigious.

> CORE POSITION
> BrainScroll should not create a fake economy around learning. The reward is the user's increasingly impressive knowledge build: levels, mastery stars, rare trophies, titles, profile presentation, personal records and social status.

This document is designed to be added after the core learning loop is stable. It is intentionally sequenced so social features never become a dependency for learning.

## 01 EXPANSION GOAL

# What this expansion adds

BrainScroll begins as a personal knowledge RPG. This expansion turns that private progression into a social identity without turning the app into social media.

| **Layer**    | **Purpose**                              | **What the user feels**                   |
|--------------|------------------------------------------|-------------------------------------------|
| Rewards      | Make learning visibly accumulate         | "My account is becoming more impressive." |
| Profile      | Show the person's knowledge build        | "This is what I actually know."           |
| Friends      | Connect real people around progress      | "I can see what my friends are learning." |
| Leaderboards | Add lightweight recurring competition    | "I can beat my friends this week."        |
| Challenges   | Create direct skill interaction          | "Prove it."                               |
| Trophies     | Reward rare accomplishments permanently  | "I earned something difficult."           |
| Cosmetics    | Make accomplishments visible at a glance | "That profile treatment means something." |

> NON-NEGOTIABLE
> The social layer must never become an infinite feed. No public posting, no comments, no DMs in the first expansion, no engagement bait, and no mechanic that makes the user afraid to stop learning.

## Success condition

A friend should be able to open someone's BrainScroll profile and understand, within seconds, what they have mastered, what they are unusually good at, and what rare accomplishments they have earned.

## 02 REWARD PHILOSOPHY

# No coins. No gems. No fake store economy.

BrainScroll already has a real progression object: knowledge. Adding coins would create a second, less meaningful economy and push the product toward generic mobile-game behavior.

| **Reward**       | **Role**                                 | **Permanent?**           | **Socially visible?** |
|------------------|------------------------------------------|--------------------------|-----------------------|
| XP               | Moment-to-moment progress between levels | No - accumulative metric | Yes, selectively      |
| Skill Levels     | Canonical topic progression              | Yes                      | Yes                   |
| Ranks            | Medium milestone recognition             | Yes                      | Yes                   |
| Mastery Stars    | Deep skill completion / prestige         | Yes                      | Yes                   |
| Trophies         | Named accomplishments                    | Yes                      | Yes                   |
| Titles           | One chosen identity label                | Yes once earned          | Yes                   |
| Cosmetics        | Visual proof of accomplishments          | Yes once earned          | Yes                   |
| Personal Records | Best-week / best-recall milestones       | Yes                      | Optional              |
| Current Streak   | Low-priority consistency stat            | No                       | Optional              |

> REWARD TEST
> Every reward should answer at least one of these: What did you learn? How deeply did you learn it? How consistently did you show up? What difficult combination did you complete? If it answers none of them, it probably does not belong.

## 03 PLAYER PROFILE

# The profile is the social centerpiece

The profile should read like an RPG character sheet for a real mind. The three rarest trophies are displayed first, then the user's strongest skills, then the full trophy collection and supporting stats.

| JORDAN Knowledge Lv. 57 Title: The Astronomer |
| --- |
| RAREST TROPHIES [ Legendary ] [ Epic ] [ Epic ] 0.4% earned 1.1% earned 1.8% earned |
| TOP SKILLS Astronomy Lv. 137 ★ Roman History Lv. 112 ★ Geography Lv. 84 |
| THIS WEEK +18 levels +2,420 XP 91% recall |
| ALL SKILLS > |
| ALL TROPHIES 67 / 240 > |
| FRIENDS 23 CHALLENGE RECORD 42-18 |

## Profile display rules

> **• Three rarest trophies are automatic.** They are sorted by current global earn rate; ties break by higher trophy tier, then earliest earned date.
>
> **• The chosen title is manual.** A user can equip any title they have legitimately earned.
>
> **• Skills are the main proof.** Show the highest/featured skills with exact levels and prestige stars, not vague category scores only.
>
> **• No paid mastery cosmetics.** A purchased theme may look different, but it can never imitate a mastery star, trophy tier, rank frame or earned status treatment.

## 04 TROPHIES + RARITY

# Trophies are permanent proof, not consumables

Trophies should be named, difficult enough to matter, and grouped into understandable collections. Once earned, they can never be lost because of inactivity.

| **Tier**  | **Typical earn rate** | **Visual treatment**    | **Example**          |
|-----------|-----------------------|-------------------------|----------------------|
| Common    | 25%+                  | Simple neutral badge    | First Mastery        |
| Uncommon  | 10-25%                | Blue accent             | 100 Concepts         |
| Rare      | 3-10%                 | Violet accent           | Historian            |
| Epic      | 0.5-3%                | Violet + gold edge      | Renaissance Mind     |
| Legendary | \<0.5%                | Reserved gold treatment | Walking Encyclopedia |

## Trophy families

| **Family**  | **Examples**                               | **Purpose**           |
|-------------|--------------------------------------------|-----------------------|
| Mastery     | First Star, Deep Dive, Triple Prestige     | Depth                 |
| Subject     | Historian, Astronomer, Cartographer        | Identity              |
| Collections | Keeper of Antiquity, World Scholar         | Cross-tree completion |
| Knowledge   | 100 / 1,000 / 5,000 / 10,000 concepts      | Scale                 |
| Recall      | 90% recall month, 1,000 successful recalls | Retention             |
| Consistency | 7 / 30 / 100 / 365 learning days           | Habit without fear    |
| Social      | First Challenge Win, 50 Friend Wins        | Interaction           |
| Oddities    | Wrong Turn, Night Owl, Rabbit Hole         | Personality           |

> RARITY MUST BE REAL
> Rarity is calculated from the percentage of eligible active users who have earned the trophy. Do not assign fake rarity labels just to make something feel special.

## Rarity refresh behavior

> **•** Recalculate global earn percentages on a scheduled backend job rather than on every profile view.
>
> **•** Store the percentage snapshot shown to the user so the UI is fast and consistent.
>
> **•** If a trophy moves between Rare and Epic later, the user keeps the trophy; only the rarity label changes.
>
> **•** The three profile trophies should update when rarity changes, but avoid constant reshuffling by refreshing the showcase at most once per day.

## 05 LEVELS, RANKS, STARS + TITLES

# The reward ladder

| **Milestone** | **Reward**                     | **Example**         |
|---------------|--------------------------------|---------------------|
| Every level   | XP + next authored level       | Astronomy 36 -\> 37 |
| Lv. 10        | Early rank                     | Student             |
| Lv. 25        | Rank + small profile marker    | Scholar             |
| Lv. 50        | Major rank                     | Specialist          |
| Lv. 75        | Major rank                     | Expert              |
| Lv. 100       | Mastery star + prestige unlock | Astronomy ★         |
| Lv. 200       | Second mastery star            | Astronomy ★★        |
| Lv. 300       | Third mastery star             | Astronomy ★★★       |

## Titles

Titles are identity rewards. They are unlocked by specific combinations and one is equipped under the username. The best titles should tell a story about the user's build.

| **Title**            | **Unlock idea**                                    |
|----------------------|----------------------------------------------------|
| The Historian        | Master 3 history branches                          |
| The Astronomer       | Reach Astronomy Lv. 100                            |
| Renaissance Mind     | Master qualifying History + Art + Science branches |
| Polymath             | Earn mastery in 5 distinct skill families          |
| Walking Encyclopedia | Hit an extreme total mastered-concept milestone    |

## 06 CONSISTENCY WITHOUT ANXIETY

# Streaks exist, but knowledge gains get the spotlight

Current and longest streaks can appear as quiet stats. BrainScroll should never use streak-loss fear as a primary retention mechanic.

| **Do**                                               | **Do not**                                       |
|------------------------------------------------------|--------------------------------------------------|
| Celebrate levels gained this week                    | "Your streak is about to die" push notifications |
| Show concepts mastered and recalled                  | Paid streak freezes                              |
| Award permanent 7/30/100/365-day trophies            | Punish missed days by removing earned status     |
| Welcome returning users back to their exact progress | Use shame language after inactivity              |
| Show personal bests                                  | Make streak count the main profile status        |

> RETURNING USER MESSAGE
> "Welcome back. Your levels are right where you left them." Then surface concepts ready for refresh. The product should make returning easy, not emotionally expensive.

## Weekly personal recap

The weekly recap is itself a reward: levels gained, concepts learned, recall success, skill movement, new trophies, personal bests and friend leaderboard position. It should feel like a character-progress report, not a guilt report.

## 07 FRIENDS

# Connect people without building social media

The first social release should use a simple mutual friend model. A friend relationship unlocks profile visibility, weekly friend leaderboards and challenges. It does not create a feed or messaging surface.

## Friend flow

| **Step** | **User action**                           | **System behavior**                      |
|----------|-------------------------------------------|------------------------------------------|
| 1        | Search exact username / share invite link | Return minimal profile preview           |
| 2        | Send friend request                       | Pending relationship stored              |
| 3        | Recipient accepts                         | Mutual friendship becomes active         |
| 4        | Open friend profile                       | Show allowed profile fields and trophies |
| 5        | Challenge / compare                       | Use shared progress data only            |

## Privacy defaults

> **• Friend-only by default.** Exact skill levels, weekly stats and challenge record are visible to accepted friends.
>
> **• Public discoverability is optional.** A user can allow exact-username search without exposing their full profile publicly.
>
> **• Block and report ship with friends.** Do not postpone them.
>
> **• No direct messages in Expansion 1.** This dramatically lowers moderation complexity and keeps the product focused.

## 08 LEADERBOARDS

# Weekly friend competition, not permanent hopelessness

The main leaderboard resets every week. Lifetime accomplishments remain on profiles. This lets a new user compete with long-time users without erasing the value of long-term mastery.

| **Rank** | **Friend** | **This Week** | **Signal** |
|----------|------------|---------------|------------|
| 1        | Sarah      | 3,140 XP      | +24 levels |
| 2        | Mike       | 2,810 XP      | +21 levels |
| 3        | YOU        | 2,420 XP      | +18 levels |
| 4        | Chris      | 1,980 XP      | +15 levels |

## Leaderboard scoring rules

> **• Count verified Knowledge XP only.** Award from canonical level completions, mastery checks, unique recall successes and approved challenge outcomes.
>
> **• No infinite review farming.** Repeating the same mastered material should not generate unlimited leaderboard points.
>
> **• No purchase multiplier.** Premium never increases leaderboard XP.
>
> **• Reset weekly.** Archive personal best placement and wins, but do not carry points forward.
>
> **• Friends first.** Global leaderboards are a later experiment and should not be needed for the social system to work.

> ANTI-CHEAT PRINCIPLE
> Leaderboard points must be derived server-side from idempotent reward events. The mobile client requests an action; it never tells the server how much XP to award.

## 09 FRIEND CHALLENGES

# Direct competition should test shared knowledge

A challenge is a short, asynchronous five-question duel. Both players receive the same question set, but only from concepts they are both eligible to be tested on.

| **Challenge stage** | **Behavior**                                                           |
|---------------------|------------------------------------------------------------------------|
| Create              | Challenger selects a shared skill or "Surprise Me"                     |
| Eligibility         | Server computes shared unlocked/mastered concept pool                  |
| Question set        | Server creates/chooses one fixed 5-question set and stores its version |
| Challenger attempt  | Answers once; score is sealed                                          |
| Recipient attempt   | Answers the same set once before expiry                                |
| Result              | Show score, accuracy, tiebreak time if needed, and a rematch button    |
| Reward              | Small verified XP bonus + challenge record; never enough to farm       |

> NO GOTCHA CHALLENGES
> Do not let a Level 150 Astronomy user challenge a friend on concepts the friend has never unlocked. Competitive fairness is more important than letting users weaponize expertise.

## 10 EARNED COSMETICS

# Visual rewards without a currency

Cosmetics give the profile more personality while preserving the meaning of mastery. Most meaningful cosmetics should unlock automatically from accomplishments rather than being purchased with coins.

| **Cosmetic**           | **Earned from**              | **What it communicates** |
|------------------------|------------------------------|--------------------------|
| Profile frame          | Subject / mastery trophy     | Deep expertise           |
| Profile background     | Major skill mastery          | Subject identity         |
| Nameplate              | Global knowledge milestone   | Overall progression      |
| Skill emblem variant   | Prestige star                | Depth in one tree        |
| XP bar treatment       | Personal record / trophy set | Achievement              |
| Challenge badge accent | Challenge milestone          | Social participation     |

## Premium boundary

Premium may eventually offer neutral visual themes or extra customization slots, but paid items must never look like earned mastery, trophy rarity or prestige. Status visuals need to remain trustworthy.

## 11 BACKEND FOUNDATION

# Build one reward ledger, then let every feature read from it

The social expansion should not calculate XP, trophies or leaderboard points separately in each feature. The core is a server-owned event ledger that records verified learning outcomes once and derives rewards from those events.

| **Entity / table**     | **Purpose**                                                    |
|------------------------|----------------------------------------------------------------|
| reward_events          | Immutable/idempotent record of verified learning reward events |
| user_skill_progress    | Current canonical level, XP and mastery state per skill        |
| achievements           | Definition catalog for trophies, titles and unlock criteria    |
| user_achievements      | Earned trophy/title records + earned date                      |
| trophy_rarity_snapshot | Current earn rate and rarity tier                              |
| friendships            | Pending / accepted / blocked relationship state                |
| leaderboard_weekly     | Derived weekly score snapshots by user                         |
| challenges             | Participants, question-set version, attempts and result        |
| cosmetics              | Definition catalog and unlock source                           |
| user_cosmetics         | Owned/equipped visual rewards                                  |

## Core reward event examples

> **•** LEVEL_COMPLETED
>
> **•** MASTERY_CHECK_PASSED
>
> **•** CONCEPT_RECALLED
>
> **•** SKILL_MASTERED
>
> **•** PRESTIGE_REACHED
>
> **•** CHALLENGE_WON
>
> **•** WEEKLY_PERSONAL_BEST

> IDEMPOTENCY
> Every awardable action must have a unique event key. If the app retries the same completion because of a bad connection, the server returns the existing result rather than awarding XP twice.

## 12 EXACT BUILD ORDER

# What to build, in order

This expansion should begin only after the core loop - authored level completion, skill progression, review, daily free cap and subscription entitlement - is stable enough that reward events are trustworthy.

| **Phase** | **Build**                  | **Why now / exit gate**                                                                    |
|-----------|----------------------------|--------------------------------------------------------------------------------------------|
| 0         | Prerequisite audit         | Core progress events are server-validated; account identity and analytics are stable.      |
| 1         | Reward event ledger        | One source of truth for XP, mastery, achievements and future leaderboard scoring.          |
| 2         | Achievement engine         | Trophy/title definitions, criteria evaluation, rarity snapshots, permanent unlock storage. |
| 3         | Profile v2                 | Three rarest trophies, title, skills, stars, trophy collection, privacy settings.          |
| 4         | Friend graph               | Requests, accept/remove/block/report, exact-username search/invites.                       |
| 5         | Friend profiles            | Read-only social viewing with privacy enforcement and compare surfaces.                    |
| 6         | Weekly friend leaderboard  | Server-derived score, weekly reset, personal best records.                                 |
| 7         | Friend challenges          | Shared concept eligibility, fixed question-set versions, sealed results.                   |
| 8         | Earned cosmetics           | Unlock catalog, inventory, equipped state, profile rendering.                              |
| 9         | Weekly social recap        | Personal gains + trophy unlocks + friend leaderboard position.                             |
| 10        | Optimization + experiments | Tune XP weights, trophy thresholds, leaderboard presentation and notification frequency.   |

## Build rule

Do not start leaderboards until Phases 1-4 are working end to end. Do not start challenges until friend relationships and canonical progress are trustworthy. Do not build cosmetics until trophies and titles already make the profile worth visiting.

## 13 PHASE ACCEPTANCE GATES

# Definition of done by phase

| **Phase**           | **Must be true before moving on**                                                                  |
|---------------------|----------------------------------------------------------------------------------------------------|
| 1 - Ledger          | Retrying a level-complete request cannot double-award XP. All core reward events can be audited.   |
| 2 - Achievements    | A trophy can unlock from real criteria; unlock is permanent; rarity job runs deterministically.    |
| 3 - Profile         | Profile renders correctly with 0, 1 and hundreds of trophies; rarest-three logic is deterministic. |
| 4 - Friends         | Request/accept/remove/block/report all work; privacy rules cannot be bypassed client-side.         |
| 5 - Friend Profiles | A friend can inspect another build quickly without exposing hidden account data.                   |
| 6 - Leaderboard     | Weekly reset is timezone-safe; score cannot be farmed through repeated reviews or purchases.       |
| 7 - Challenges      | Both users get identical versioned questions; eligibility prevents unfair unseen-content duels.    |
| 8 - Cosmetics       | Earned cosmetics cannot be equipped without ownership; paid themes cannot impersonate mastery.     |

## 14 UI / UX SCREENS

# What this expansion needs to look like

| **Screen**         | **Primary visual priority**                   | **Primary action**  |
|--------------------|-----------------------------------------------|---------------------|
| My Profile         | Three rarest trophies + top skills            | Inspect / customize |
| Friend Profile     | Their build, rare trophies, skill comparison  | Challenge           |
| Trophy Room        | Collection grid + rarity + locked silhouettes | Inspect criteria    |
| Friends            | People + pending requests + search            | Add / open friend   |
| Weekly Leaderboard | Compact friend ranking + your row emphasized  | Compare             |
| Challenge Setup    | Shared eligible skills only                   | Send challenge      |
| Challenge Result   | Scores + per-question result summary          | Rematch             |
| Cosmetics          | Owned items grouped by source                 | Equip               |
| Weekly Recap       | Knowledge gains first, social rank second     | Share / close       |

## Visual language

> **• Keep BrainScroll dark and premium.** Navy/slate base, violet interaction, mint success, gold reserved for mastery and rare rewards.
>
> **• Rarity is restrained.** Legendary can feel special without turning the entire screen gold.
>
> **• No casino visuals.** No spinning wheels, chests, shards, coin showers or randomized rewards.
>
> **• Profiles should feel like stat sheets.** Dense enough to be interesting, clean enough to scan in seconds.
>
> **• Leaderboards are small.** Friends-first lists should feel like a scoreboard, not a social-media timeline.

## 15 NOTIFICATIONS + SOCIAL ACTIVITY

# Notify about outcomes, not anxiety

| **Good notification**                   | **Avoid**                                 |
|-----------------------------------------|-------------------------------------------|
| "Mike challenged you in Roman History." | "Your friends are passing you! Open now." |
| "You unlocked Historian I."             | "Don't lose your streak."                 |
| "Your weekly knowledge recap is ready." | Generic daily "Come back" spam            |
| "Sarah accepted your friend request."   | Artificial countdowns / expiring XP       |
| "You set a new weekly personal best."   | Loss-framed reminders                     |

## Activity without a feed

A small Friends activity module may eventually show high-signal milestones - for example, "Chris mastered World War II ★" - but there should be no endless chronological activity feed in Expansion 1. If added later, cap it to a few meaningful items.

## 16 SAFETY, PRIVACY + MODERATION

# Keep the social surface intentionally low-risk

| **Risk**          | **Design response**                                                       |
|-------------------|---------------------------------------------------------------------------|
| Harassment        | No DMs/comments; block/report available from every friend profile         |
| Spam requests     | Rate limits, pending-request caps, exact-username search                  |
| Privacy           | Friend-only progress by default; granular visibility settings             |
| Leaderboard abuse | Server-derived scores + audit trail + anomaly detection                   |
| Impersonation     | Unique usernames / account IDs; optional verified email ownership         |
| Underage users    | Age-appropriate defaults and policy review before public social discovery |

> KEEP SOCIAL SMALL ON PURPOSE
> The absence of public posting, DMs, comments, follower counts and an infinite activity feed is a feature. BrainScroll is adding social proof and friendly competition, not rebuilding a social network.

## 17 WHAT TO MEASURE

# Metrics that tell us whether this expansion helps

| **Metric**                             | **Why it matters**                                                        |
|----------------------------------------|---------------------------------------------------------------------------|
| Profile view rate                      | Are accomplishments interesting enough to inspect?                        |
| Friend request acceptance              | Is connecting useful / trustworthy?                                       |
| Weekly leaderboard participation       | Does light competition create repeat learning?                            |
| Challenge send + completion rate       | Are duels compelling without being annoying?                              |
| Trophy-detail opens                    | Do trophies create intentional goals?                                     |
| Skill completion after trophy browsing | Do accomplishments motivate real learning?                                |
| Return after missed week               | Does the no-guilt model make re-entry easier?                             |
| Premium conversion correlation         | Does social visibility increase perceived value without gating knowledge? |

## Metrics not to optimize blindly

> **•** Total time in app
>
> **•** Notification opens
>
> **•** Raw friend count
>
> **•** Number of challenge rematches
>
> **•** Daily sessions at the expense of meaningful learning

## 18 EXPLICITLY DEFERRED

# Do not build these in the first social expansion

| **Deferred feature**      | **Reason**                                                                           |
|---------------------------|--------------------------------------------------------------------------------------|
| Global public leaderboard | Adds pressure, moderation and old-user advantage before friend competition is proven |
| Direct messages           | High moderation cost and weak connection to learning                                 |
| Public posts / comments   | Turns BrainScroll toward social-media behavior                                       |
| Clans / guilds            | Useful later, but unnecessary before 1:1 social works                                |
| Coin / gem economy        | Dilutes the knowledge-as-reward concept                                              |
| Gifting / trading         | Creates fraud/economy complexity with no learning benefit                            |
| Random loot / crates      | Conflicts with transparent, earned progression                                       |
| Paid XP boosts            | Destroys leaderboard and profile credibility                                         |

> LATER EXPANSION CANDIDATE
> If groups are added later, the cleanest next step is private Parties: families, friend groups, classrooms or teams with their own weekly leaderboard and shared challenge set. Build this only after the friend system is healthy.

## 19 STARTER TROPHY CATALOG

# A first set worth building toward

| **Trophy**          | **Tier**  | **Unlock**                                                      |
|---------------------|-----------|-----------------------------------------------------------------|
| First Star          | Common    | Master any skill to Lv. 100                                     |
| Deep Dive           | Uncommon  | Reach Lv. 200 in any skill                                      |
| Triple Prestige     | Rare      | Reach Lv. 300 in any skill                                      |
| Historian           | Rare      | Master 3 history branches                                       |
| Polymath            | Epic      | Master 5 distinct skill families                                |
| Renaissance Mind    | Epic      | Complete qualifying Art + History + Science masteries           |
| Keeper of Antiquity | Epic      | Complete the Ancient World trophy set                           |
| World Scholar       | Epic      | Complete major Geography + History + Economics mastery set      |
| Thousand Strong     | Uncommon  | Master 1,000 concepts                                           |
| Ten Thousand        | Legendary | Master 10,000 concepts                                          |
| Perfect Recall      | Rare      | Achieve a defined high recall milestone over a qualified window |
| 30-Day Learner      | Uncommon  | Learn on 30 consecutive days; trophy remains permanently        |
| Challenge Accepted  | Common    | Complete first friend challenge                                 |
| Friendly Rival      | Uncommon  | Win 25 qualified friend challenges                              |
| Wrong Turn          | Common    | Miss the same concept repeatedly, then master it                |

## 20 EXPANSION BLUEPRINT

# The whole system in one page

| **System**  | **Rule**                                                                                                 |
|-------------|----------------------------------------------------------------------------------------------------------|
| Currency    | None. XP is progression; knowledge is the asset.                                                         |
| Profile     | Three rarest trophies -\> top skills -\> stats -\> full trophy room.                                     |
| Status      | Skill levels, ranks, mastery stars, titles, trophy rarity and earned cosmetics.                          |
| Friends     | Mutual, controlled, no messaging in first expansion.                                                     |
| Leaderboard | Friends-only, weekly reset, server-derived verified Knowledge XP.                                        |
| Challenges  | Five questions, asynchronous, same versioned set, shared eligible knowledge only.                        |
| Streaks     | Quiet stat; permanent consistency trophies; no fear-based messaging.                                     |
| Cosmetics   | Earned from accomplishments; paid themes may not imitate mastery.                                        |
| Build order | Ledger -\> achievements -\> profile -\> friends -\> leaderboard -\> challenges -\> cosmetics -\> recaps. |
| North star  | Make learning itself increasingly visible, collectible and prestigious.                                  |

> BRAINSCROLL SOCIAL MANTRA
> Do not reward people for staying. Reward them for becoming more knowledgeable - then give them a clean, credible way to show what they built.
