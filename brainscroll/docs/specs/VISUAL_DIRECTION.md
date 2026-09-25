---
title: "BrainScroll Visual Theme & UI Direction"
status: canonical
source_docx: "BrainScroll_Visual_Theme_UI_Direction_Revised(1).docx"
merged_decisions: "CURRENT_PRODUCT_DECISIONS.md (2026-09-23)"
---

**BRAINSCROLL**

**VISUAL THEME & UI DIRECTION**

> A learning app that turns the pull of scrolling into visible knowledge progression - a finite daily scroll that builds a permanent, RPG-like knowledge profile.

| **ADDICTING** | **BRILLIANT** | **LEARNING** | **LIGHT RPG** |
|---------------|---------------|--------------|---------------|

|  |  |
| --- | --- |
|  | Creative North Star<br>BrainScroll should look like knowledge is a video game resource. The learning is the product; levels, XP, mastery, titles and unlocks are the feedback system. |

**Duolingo clarity + premium app restraint + RPG progression feedback**

## 1. Theme: Modern Knowledge RPG

*Premium, energetic and contemporary - never fantasy, cyberpunk, corporate or classroom software.*

Use a deep, calm base with a restrained luminous layer. Think premium reading app crossed with an RPG stat screen: navy/graphite surfaces, electric violet as the signature accent, mint for success and rare gold for true mastery. Glow is a reward effect, not permanent decoration. BrainScroll should feel smart first and game-like second.

|  |  |
| --- | --- |
| Where the RPG lives<br>Levels, ranks, canonical skill progression, XP, mastery stars, titles, milestone nodes, prestige, Weekly Knowledge Quests and unlock animations. | Where the RPG does NOT live<br>No swords, armor, medieval frames, treasure chests, parchment, combat UI or cosplay. The RPG layer is a stat system for real knowledge. |

|  |  |
| --- | --- |
|  | Duolingo-inspired, not Duolingo-copied<br>Borrow the clarity, immediate feedback, friendly touch targets and satisfying progression. Keep BrainScroll more restrained, adult and stat-driven, with its own palette, icon language and voice. |

## 2. Core Color System

*Violet is the brand. Slate gray does the heavy lifting. Blue, mint, coral and gold are semantic colors - not decoration.*

| **SWATCH** | **ROLE**            | **HEX**  | **USE**                                              |
|------------|---------------------|----------|------------------------------------------------------|
|            | **Slate**           | \#131F24 | Primary app background; a blue-gray that lets colour pop (replaced Midnight Navy \#111827). |
|            | **Deep Slate**      | \#202F36 | Cards, panels, elevated dark surfaces.               |
|            | **Electric Violet** | \#7C5CFF | Primary brand, CTA, active level, key highlights.    |
|            | **Bright Blue**     | \#4DA3FF | Information, active connections, secondary progress. |
|            | **Mint**            | \#39D98A | Correct answers, success and recall confirmed.       |
|            | **XP Gold**         | \#FFC857 | Rare mastery, prestige stars and major milestones.   |
|            | **Coral**           | \#FF6B6B | Challenge, warning, incorrect answer feedback.       |
|            | **Soft White**      | \#F7F9FC | Primary text on dark surfaces.                       |
|            | **Cool Gray**       | \#A7B0C0 | Secondary copy, locked states, helper text.          |

**Color rule: gold stays intentionally scarce, and only one bright accent should dominate a screen at a time. Subject colors may appear as small chips, icons or progress accents, but the app should never become a rainbow dashboard.**

## 3. UI Feel & Interaction Principles

*The app should feel alive before it ever feels complicated.*

- **Rounded, not bubbly. Use tactile cards, 14-20 px corner radii, clear touch targets and enough weight to feel game-like without looking childish.**

- **Fast hierarchy.** A user should know what to do within a second: continue, answer, level up, or review.

- **Shallow navigation. Four destinations are enough for V1: Home, Skills, Review and Profile. Learning launches from Home or a skill tree rather than becoming a separate maze of tabs. Weekly Knowledge Quests (post-MVP) surface as a Home card, not a fifth tab.**

- **Motion with purpose. Buttons depress, XP counts up, progress settles, and unlocks glow. Normal navigation stays quiet so reward moments keep their impact.**

- **Reward progress, not screen time.** Scrolling alone should never look like achievement. Completion, recall and mastery create the dopamine hits.

- **Bright on dark, selectively. Luminous accents should signal action, correctness or progress - not cover every surface.**

- **Adult-friendly playfulness.** Clever and energetic without looking childish or like classroom software.

## 4. Home / Continue Screen

*Opening BrainScroll should feel like loading a save file - your mind has a build, and the next useful action is obvious.*

| BRAINSCROLL<br>Knowledge Lv. 27 |
| --- |
| CONTINUE Roman History - Lv. 18 82% |
| TODAY 3 / 5 new levels completed |
| WEEKLY QUEST The Roman World · 14 / 25 new levels |
| HISTORY Rank 14 · Roman History Lv. 18 |
| SCIENCE Rank 23 · Astronomy Lv. 18 |
| GEOGRAPHY Rank 12 |
| MONEY Rank 8 |

**Design intent: the RPG is visible, but learning stays primary. One dominant Continue card should own the screen; subject stats, daily progress and the active Weekly Quest (post-MVP) are secondary, not a dashboard wall.**

## 5. The Level Scroll: Finite by Design

*Use the familiar physics of a vertical feed, but every level has a beginning, an end and a saved place.*

A level is a 4-7 minute learning encounter: a hook, 3-5 fleshed-out learning cards, then 3 light questions (recall, understanding, connection), each followed by a short explanation, and completion. Reading and discovery are the main experience; the questions reinforce them. Longer checks are reserved for milestones: 5 questions at every 10th-level checkpoint, 7 at the Level 50 milestone, 10 at the Level 100 Mastery Challenge. The user never enters an endless algorithmic feed. Finishing the final card ends the level and awards real progression.

| ROMAN HISTORY - LEVEL 18<br>2-5 minute finite learning encounter |
| --- |
| HOOK “The Roman Empire did not actually disappear in 476.” |
| EXPLAIN Short visual + 2-3 lines of explanation. |
| CONNECT “Remember Constantine from Lv. 12?” |
| 3 QUESTIONS Recall, understanding, connection, e.g. "Which half of the Roman Empire survived?" |
| ANSWER Eastern ✓ |
| IF MISSED Take another look: “After the Western Roman Empire collapsed in the 5th century, the Eastern Roman Empire continued from Constantinople for nearly another thousand years.” Choose again. |
| REWARD +100 XP · Perfect Recall · Level 19 unlocked |

|  |  |
| --- | --- |
|  | Behavioral goal<br>Scratch the same “one more swipe” itch as social media, but make the unit finite and authored. Satisfaction comes from clearing a real level and retaining it later - never from an infinite content stream. |

## 6. Level-Up & Daily Completion

*The addictive part should be canonical level progression and recall, not infinite consumption.*

|  |  |
| --- | --- |
| Level complete moment<br>XP fills quickly, the skill level increments and the next canonical level lights up. A 3 / 3 first try earns Perfect Recall with a slightly bigger moment. Level 100 shows “★ Mastery star earned” in gold whatever the first-try score. XP amounts come from the server’s configured pools, never from the screen. Review works like a level question: a miss shows the source card beneath the question and the choices stay open until the right answer is chosen. Keep the celebration crisp so “one more level” feels tempting without becoming noise. | Daily knowledge complete<br>At 5 / 5 new free levels, celebrate finishing. Review remains unlimited. The subscription offer appears as an optional way to continue - not as a punishment or energy refill. When a Weekly Quest is active, this screen also shows its progress. |

| DAILY KNOWLEDGE COMPLETE<br>5 / 5 new levels |
| --- |
| WEEKLY QUEST The Roman World · 14 / 25 |
| Roman History 5/5 ✓ · European Geography 5/5 ✓ · Art & Architecture 3/5 · Government & Society 1/5 · Mythology & Religion 0/5 |
| 11 levels remaining. Come back tomorrow and keep building. |
| Brain successfully fed. |
| No more doomscrolling. Go touch grass. 🌱 |
| REVIEW Review Knowledge |
| UNLIMITED Keep Leveling · $4.99/month |
| All knowledge can still be unlocked free over time. |

## 7. Skill Trees: 100 Levels Without 100 Tiny Dots

*A hundred levels should feel deep, legible and worth finishing - not like a spreadsheet or a wall of microscopic nodes.*

Show only the active 10-level chapter at full size, with a compact rail for overall 1-100 progress. Completed nodes are violet, the current node is blue/violet, mastery is gold and future nodes are gray. Never render all 100 levels as equal buttons.

| ASTRONOMY<br>Lv. 63 / 100 · Chapter 7 |
| --- |
| ●─●─◉─○─○─○─○─○─○─○ |
| 61-70 Current chapter |
| 100 Mastery ★ |
| 101-200 Prestige I unlocks |

## 8. Prestige: Depth, Not Reset

*Mastery should open a deeper layer of the skill, not erase anything the user already earned.*

At Level 100, the skill earns its first mastery star and Levels 101-200 unlock. At 200 it earns a second star and 201-300 can unlock later. Prestige content becomes more specific, connected and demanding: deeper people, events, systems, source interpretation and synthesis. A Level 212 skill should visibly mean something.

|  |  |
| --- | --- |
| LEVEL 100 · ★<br>Mastery I. Keep Level 100 permanently; unlock Levels 101-200. No reset, no re-grind. | LEVEL 200 · ★★<br>Mastery II. The second star signals deeper command of the same skill, not repetition of the first hundred levels. |

## 9. Character Sheet: Your Knowledge Build

*This screen should make people proud of the shape of their knowledge, not just total XP.*

| PROFILE<br>Jordan · Knowledge Level 34 · The Astronomer |
| --- |
| RAREST TROPHIES The Roman World · First Star · Perfect Recall |
| HISTORY Rank 42 · Roman History Lv. 112 ★ |
| SCIENCE Rank 61 · Astronomy Lv. 63 |
| GEOGRAPHY Rank 27 · Countries Lv. 41 |
| ECONOMICS Rank 19 |
| ARTS Rank 13 |
| WORLD SYSTEMS Rank 31 |
| TITLES Astronomer · Historian I · Polymath |
| PRESTIGE ★ Roman History |

**The emotional goal: after months of use, this should feel like inspecting a real RPG character sheet. Overall ranks summarize breadth; the meaningful bragging rights are named skills, their exact levels and mastery stars.**

## 10. Weekly Knowledge Quests

*A weekly objective for your knowledge build: a major RPG goal without fantasy trappings.*

| THE ROMAN WORLD<br>Standard Weekly Quest · 14 / 25 new levels |
| --- |
| ◉─◉─◉─◉─◉─◉─◉─◉─◉─◉─◉─◉─◉─◉─○─○─○─○─○─○─○─○─○─○─○ |
| ROMAN HISTORY 5 / 5 ✓ |
| EUROPEAN GEOGRAPHY 5 / 5 ✓ |
| ART & ARCHITECTURE 3 / 5 |
| GOVERNMENT & SOCIETY 1 / 5 |
| MYTHOLOGY & RELIGION 0 / 5 |
| FINAL ENCOUNTER Locked · unlocks at 25 / 25 · 3 synthesis questions |
| REWARDS The Roman World trophy · Citizen of Rome · Marble Laurel profile treatment · +50 XP |

**Design intent: the quest reads like a build objective. One central emblem, five requirements, one total and a visible reward: the user should know in a second which skills still need levels today.**

- **Central emblem.** One central emblem per quest, e.g. a stylized Roman bust with laurel and columns. It starts subdued; each completed requirement illuminates a section, turns accents violet then gold, reveals detail and activates a progress line.

- **Requirements.** Five requirement rows with visible 0 / 5 progress, an overall 0 / 25, and a reward preview (trophy, title, cosmetic, XP).

- **Final Encounter.** At 25 / 25: FINAL ENCOUNTER UNLOCKED. Its 3 synthesis questions end in a larger reward animation, second only to mastery. Keep glow and gold scarce so this moment lands.

- **No fantasy trappings.** Modern knowledge-RPG, not fantasy: no swords, dragons, treasure chests, parchment, bosses or health bars.

- **The Chronicle.** Ended quests live in the Chronicle with the same rewards. A live-week clear shows only a subtle dated mark; never a “missed forever” state.

- **Friends.** Friend progress (once friends ship) is a compact list: Mike 25 / 25 ✓, Sarah 19 / 25, You 14 / 25. No “beating you” copy.

## 11. Brand Voice & Optional Spark

*BrainScroll needs personality; it does not need an owl. Let the writing carry the brand first, with an abstract visual guide only if it genuinely improves the experience.*

|  |  |
| --- | --- |
| The Spark (optional)<br>If used, make it an abstract pulse/orb of light rather than a permanent cartoon character. It can react to mastery, unlocks and daily completion without talking over the lesson. | Voice<br>Clever, concise, slightly irreverent and adult-friendly. It celebrates progress, accepts wrong answers without shame, and is comfortable telling the user to leave the app. |

- “Okay Einstein, calm down.” - after an unusually strong run.

- “Bold answer. Wrong, but bold.” - occasional incorrect-answer personality.

- “We’re done here. Go outside.” - after the day’s five new levels are done.

- Keep the jokes sparse. Personality belongs at feedback moments and milestones, not on every card.

## 12. Typography, Icons & Brand Mark

*Clean enough to disappear when learning starts; distinctive enough to feel like a modern game system in the App Store.*

- **Typography. Use a geometric modern sans direction (Sora / Manrope territory): strong display numerals, readable body text and slightly rounded forms without bubble-kid styling.**

- **Numbers matter.** Level numbers, XP and percentages should be large, crisp and visually satisfying.

- **Icons.** Use simple filled or semi-filled icons with consistent stroke weight. Avoid overly detailed academic symbols.

- **App icon. Dark rounded square with a violet/white BrainScroll mark - ideally a stylized “B” built from stacked feed cards or a swipe trail. It should read at tiny size before it tries to explain the concept.**

- **Avoid. Literal anatomical brains, graduation caps, fantasy shields, parchment, generic education-blue branding and overly cute mascot-first iconography.**

## 13. Microinteractions That Make It Feel Addictive

*Important actions should have a satisfying consequence; ordinary navigation should stay calm.*

- **Correct answer. Card snaps into a success state; restrained mint pulse; subtle haptic.**

- **Wrong answer. Short, restrained coral note; the question stays put, its source card slides in beneath it (“Take another look”) and the options reopen until the right one is chosen. No punitive hearts, lives, restarts or shame state.**

- **Level completion.** Progress ring fills, subject level increments and the next node lights up.

- **Mastery / prestige. Gold star appears with the richest animation and sound in the app. This should feel materially different from a normal level-up.**

- **Locked → unlocked.** Node transitions from gray to luminous violet/blue.

- **Daily complete.** Strong celebratory moment followed by a clean exit path rather than another engagement trap.

- **Weekly Quest progress.** Each quest level lights a segment of the quest emblem; the Final Encounter unlock and quest completion are the only moments besides mastery that earn a big celebration.

- **Motion scale. Normal feedback should feel fast (roughly 150-250 ms); mastery moments can breathe longer. Respect reduced-motion settings and never make animation block learning.**

## 14. Monetization UI: Limit Friction, Not Knowledge

*The free cap should feel like completing the day, not running out of energy in a mobile game.*

- Free: 5 new canonical levels per day. Review, character sheet, skill trees and already-learned material remain available.

- Unlimited: \$4.99/month, with an annual option such as \$39.99/year. No ads and no exclusive knowledge tier.

- The upgrade offer appears after 5 / 5 or when the user explicitly attempts a sixth new level. Never interrupt a lesson with a paywall.

- Always state the fairness rule plainly: “All knowledge can be unlocked free over time.”

- Weekly Quests are fully completable free: a standard quest is about five learning days. The 5 / 5 screen shows quest progress, and Unlimited appears only as an optional way to keep going. Pay for freedom, not knowledge.

## 15. Design Rules to Protect the Concept

*The fastest way to lose BrainScroll is to drift into generic education, generic mobile gaming or another infinite attention feed.*

- Learning cards stay concise and visually breathable.

- The primary CTA on every screen is obvious.

- XP, levels and mastery must represent real completion or recall.

- No fake urgency, energy meters, loot boxes, gems, punitive lives or pay-to-win progression.

- Do not make every screen glow. One strong accent is usually enough; reward states need visual headroom to feel special.

- Use subject colors as restrained accents, while the BrainScroll violet/navy system remains the visual identity.

- Keep the app contemporary. The game layer is a stat system for real knowledge, not fantasy cosplay.

- No infinite feed. Every new-learning session is an authored level with a visible endpoint.

- The 5-level free cap gates only new progression. Review and the user’s earned knowledge remain accessible.

- Prestige adds depth; it never deletes, resets or devalues previous levels.

- Do not celebrate time spent. Celebrate levels cleared, concepts recalled and mastery earned.

- Weekly Quests are objectives, not combat or countdowns. Ended quests move to the Chronicle; nothing is ever “missed forever.”

**BRAINSCROLL DESIGN MANTRA**

> **Make scrolling feel like leveling up a real part of yourself.**

**Stop scrolling. Start leveling.**
