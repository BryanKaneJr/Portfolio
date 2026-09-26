# Visual direction

> **Learning should feel calm. Progress should feel powerful.** Lesson screens are quiet and content-first, with one action. Reward screens carry the glow, big numerals and motion, and gold appears only for mastery. The component system and its rules are in [`design-system.md`](design-system.md); screenshots are in [`ui/`](ui).

This summarizes [`specs/VISUAL_DIRECTION.md`](specs/VISUAL_DIRECTION.md) (.docx snapshot in [`source/`](source/Visual_Theme_UI_Direction.docx)). The tokens are implemented in [`app/src/theme/tokens.ts`](../app/src/theme/tokens.ts).

**North star:** make knowledge look like a video-game resource. Think Duolingo clarity, plus premium-app restraint, plus RPG progression feedback. It should feel smart first and game-like second.

## Colour

| Token | Hex | Role |
| --- | --- | --- |
| Slate | `#131F24` | App background: a blue-gray that makes colours pop (owner decision, replacing Midnight Navy `#111827`) |
| Deep Slate | `#202F36` | Cards, panels |
| **Electric Violet** | `#7C5CFF` | Brand, primary CTA, active level |
| Bright Blue | `#4DA3FF` | Information, secondary progress, current node |
| Mint | `#39D98A` | Correct, recall confirmed |
| XP Gold | `#FFC857` | **Mastery and prestige only.** Keep it scarce |
| Coral | `#FF6B6B` | Incorrect, warning |
| Soft White | `#F7F9FC` | Primary text |
| Cool Gray | `#A7B0C0` | Secondary text, locked |
| Bow Tie Plum | `#C07BE8` (deep `#9B4FCB`) | Dr. Scroll's colour: his speech, tips, "Did you know". Deep plum is the launch screen |

**Launch screen:** deep plum `#9B4FCB`, Dr. Scroll's minimalist mark (bald crown, white hair tufts, round glasses) in the middle and the white `brainscroll` wordmark at the bottom. The art is `app/assets/images/splash-mark.png`, rendered from `splash-mark.svg` beside it (peach crown, off-white tufts and dark brown glasses, matching his reference art); the native splash and the in-app `BrandSplash` share it.

Only one bright accent should dominate a screen. Glow is a reward effect, not decoration. Subject colours are small accents only, never a rainbow dashboard.

## Feel

- Rounded but not bubbly: 14–20 px radii and large touch targets.
- **Four tabs: Home, Skills, Review, Profile.** Learning launches from Home or a skill tree.
- Motion has a purpose. Feedback takes 150–250 ms, while mastery moments can breathe longer. Respect reduce-motion.
- Reward progress, not screen time. Scrolling alone never looks like achievement.
- The RPG layer is a stat system: **no swords, parchment, treasure chests or fantasy cosplay.**

## Key screens

- **Home (the World Map):** an overworld of the subjects, joined by a dotted road. Each subject is an island (a soft organic shape in its own colour, with a darker underside for depth) holding its landmark (a colosseum for History, Saturn for Science, a globe, a piggy bank, a palette, gears) floating inside a ring that fills toward Lv. 100, over a plate with its icon, name and "Lv. N" (gold with ★ once mastered). Smaller scenery drifts in the open space beside each island; the subject you're playing flies a flag, says "You are here", and has Dr. Scroll (with his map) standing beside it. Above the map: the pinned Knowledge Level bar, the review strip when concepts are due, and a Current Quest card whose Continue opens your skill's map. Tapping an island opens its skill's map, or its region first when the subject has several skills.
- **A skill's map:** "loading a save file". It is the active skill's whole **adventure map**, BrainScroll's own take rather than a copy of anyone's path. A slim bar stays pinned at the top so you always know where you are: a back arrow to the World Map (or the subject's region), the skill's level emblem, "Astronomy · Lv. 65", and today's count. Nothing else sits above the map: due reviews are offered on the World Map. Below, every chapter scrolls by in order, its banner (map icon, chapter number, levels, title) sitting where that chapter begins: a quiet surface card with violet text, so it frames the map without outshining the next level. Waypoints are hexagons (the RPG skill-tree shape) showing their level numbers, joined by a dotted road walked in violet up to where you are and faint beyond. Cleared waypoints go quiet (a muted violet face with violet numbers) and carry a mint check; the next is the only bright violet waypoint, ringed, with a bouncing "Start" callout naming the level; locked ones sit in a fog of war that deepens the further ahead they are. Each chapter's 10th level is the boss: a bigger shield waypoint labeled Checkpoint (gold on a mastery level). Scenery floats in the open pockets across from the road's two bulges (beside the 3rd and 7th waypoints): the illustration of the level beside it, drifting gently (still with reduce motion) and dimmed while that level is locked. Dr. Scroll reads by the roadside in your current chapter, taking its right pocket (by the 7th waypoint), and it opens scrolled to the next level.
- **Skills tab:** a list of every skill with its level and chapter; tapping one makes it active and opens its map.
- **Profile (character sheet):** an RPG stat screen, lightly. A ring circles the Knowledge Level badge on a framed disc, with one arc per subject in that subject's own colour (`subjectColor`; never violet or gold), filling toward its first 100 levels and marked with its icon and level. Below the stat tiles and showcase, an **Attributes** panel lists every subject like an RPG stat: icon, name, "Lv. N" (the levels cleared across its skills, never XP), and a solid bar that grows one step per level from 1 to 100. Clearing 100 masters the subject: its name and level turn gold with a ★ after the name (also on the Skills tab), and the level starts again from 1. History uses terracotta, not orange, so gold only ever means mastery. Subjects with nothing shipped yet follow as compact dimmed "Soon" rows.
- **Checkpoints:** clearing a chapter's 10th level pops a big trophy badge at the top of Level Complete (violet; gold on a mastery level).
- **Level scroll:** learning first. Hook → 2–5 focused learning cards → 3 light questions (recall, understanding, connection) → Level Complete. It's finite with a saved place and ends on a reward like "+100 XP · Perfect Recall · Level 19 unlocked", with the next level offered immediately.
- **Questions:** large lettered answer cards. Tapping one selects it; **CHECK** grades it, so only checked answers count as attempts. Feedback appears in context, in the tinted footer, and is never a separate screen.
- **A wrong answer:** a restrained coral note ("Not quite: That's Jupiter.") under the still-visible question, then **Take another look** with the question's source card inline, then the options again with the wrong pick crossed out. Choose until right, then "Reinforced · We'll bring this back later". There's no failure screen, no lives and no restart.
- **Level Complete:** "+XP" counts up. "First try: 2 / 3" is shown plainly. Perfect Recall (3/3) gets a small scale pop and a callout card. Reinforced concepts are listed as "We'll bring these back sooner in Review." Reduce-motion skips the animation. Checkpoints (every 10th level), the Level 50 milestone and the Level 100 Mastery Challenge are the only longer checks, and the player's header labels them. Their XP comes from each type's own pool and is shown as returned, never computed on screen. Level 100 shows "★ Mastery star earned" in XP Gold with "Levels 1–100 completed and resolved. Levels 101–200 are open." whatever the first-try score.
- **Review:** works like a level question. A miss shows "Take another look" with the source card beneath the question, and the choices stay open until the right one is chosen. Never reveal the answer and move on. The summary shows "x / n right first time" and +10 XP for each.
- **Skill tree:** show the active 10-level chapter full-size plus a compact 1–100 rail. Completed nodes are violet, the current node is blue, mastery is gold and future nodes are gray. **Never render 100 equal dots.**
- **Daily Knowledge Complete:** 5 / 5, "Brain successfully fed. No more doomscrolling. Go touch grass. 🌱" Primary action: Review Knowledge. Then Come back tomorrow. Unlimited ("Keep Leveling") is an optional card. Post-MVP, when a Weekly Quest is active, it also shows the quest's progress (14 / 25, x / 5 per skill, levels remaining, "Come back tomorrow and keep building").
- **Weekly Knowledge Quest** (post-MVP): one central theme emblem that starts subdued and illuminates section by section as requirements complete (accents go violet, then gold), five requirement rows at x / 5, overall x / 25, a reward preview, and a locked Final Encounter that unlocks at 25 / 25 with a larger reward animation, second only to mastery. It surfaces as a Home card, not a fifth tab. No swords, dragons, chests, parchment, bosses or health bars. Past quests live in the Chronicle, never shown as "missed."
- **Character sheet:** Knowledge Level, subject ranks, named skills with exact levels and ★, and titles.

## Voice

Clever, concise, slightly irreverent, adult. It accepts wrong answers without shame ("Bold answer. Wrong, but bold.") and is comfortable telling people to leave ("We're done here. Go outside."). **Keep jokes sparse:** use them at feedback moments and milestones only.

## Type and brand mark

Use Nunito, a rounded sans that matches Dr. Scroll's warmth and stays legible for long reading, with big, crisp numerals for levels and XP. The app icon is a dark rounded square with a violet/white "B" built from stacked feed cards or a swipe trail. Avoid literal brains, graduation caps, shields and generic education-blue. The mascot, Dr. Scroll, an original cute old professor with a violet bow tie, is defined in [`mascot.md`](mascot.md).
