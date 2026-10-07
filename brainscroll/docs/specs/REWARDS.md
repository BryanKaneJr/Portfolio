# Map chests, XP boosts and cosmetics (owner, 2026-10-05)

Rewards on the skill maps, decided with the owner on 2026-10-05: "luck of the
draw", XP boosts in minutes ("15, 30, 1 hour the big one"), avatar rings
("our signature plum, gold, flames, a bunch of different ones"), name styles
and titles. Boosted XP counts toward the league.

## Chests

- **Where:** one chest per chapter, on the road between the chapter's 5th and
  6th levels (Levels 5, 15, 25, ...). It opens once the 5th level is cleared,
  once per account, ever. Locked chests show ahead on the road.
- **What:** one roll on the loot table below, made on the server
  (`open_chest`), so it can't be faked. The weights are server settings
  (`app_settings.chest_loot`) and can be tuned without an app update; core's
  `CHEST_LOOT` mirrors the defaults.

| Roll | Weight | Notes |
|---|---|---|
| XP boost, 15 minutes | 25 | |
| XP boost, 30 minutes | 15 | |
| XP boost, 1 hour | 5 | |
| +2 Brainpower | 25 | Only with room for both (balance at most max - 2) and not on Unlimited; otherwise this weight goes to the 15-minute boost |
| Common cosmetic | 15 | Any Knowledge Level |
| Rare cosmetic | 8 | Knowledge Level 15+ |
| Epic cosmetic | 5 | Knowledge Level 30+ |
| Legendary cosmetic | 2 | Knowledge Level 50+ |

- A cosmetic tier is out of the roll while the learner's level is below its
  minimum, or when they already own every item in it; its weight goes to the
  15-minute boost. So a chest is never empty and never a duplicate.
- Within a tier, the item is picked at random from those not yet owned.
- Brainpower never goes over its max (CLAUDE.md): the +2 only rolls when both fit.

## XP boosts

- A boost waits on Profile until the learner starts it (so a 1-hour
  boost isn't wasted when they're out of Brainpower or about to leave).
- One at a time: starting one while another runs is refused (`BOOST_ACTIVE`).
- While it runs, a level's first clear pays **2x** its XP. Together with the
  perfect streak it never passes 2.0x (`XP.PERFECT_STREAK_MAX_PERCENT`): a
  boosted level pays 2x, whatever the streak. One `LEVEL_COMPLETE` event, as
  ever, so boosted XP counts toward the league.
- Only level first clears are boosted (reviews, chapter reviews and quests
  pay as usual). Replays still earn nothing.

## Cosmetics

Glows (owner, 2026-10-05: "instead of rings, we did a back glow", to keep the avatar art as it is): a soft light behind the avatar that spills past its edge. Epic and Legendary glows breathe, and Galaxy and Prism turn. They were rings at first, so their ids stay `ring.*` (and `look_ring` on the server).

Drawn in code, no art. Everything owned lives in **Edit profile** (the
Locker until owner, 2026-10-07: "move everything from locker to edit profile"),
where the learner equips one glow, one name style and one title. Others see
them: the glow behind the avatar and the styled name in leagues, the feed,
friends and profiles; the title under the name on profiles.

| Tier | Glows (ids `ring.*`) | Name styles | Titles |
|---|---|---|---|
| Common | Plum, Silver | Plum, Silver | Curious Mind, Bookworm |
| Rare | Ocean, Gold | Ocean, Gold | Scholar, Night Owl |
| Epic | Flame, Aurora | Ember, Aurora | Sage, Lucky Star |
| Legendary | Galaxy (animated), Prism (animated) | Shimmer (animated), Holo (animated) | Polymath, Living Legend |

**Earned titles** (not in chests, they reward something done):
- A skill's first Mastery star: "<Skill> Master".
- Weekly Quest titles, as before.

No streak titles: the learning streak's only rewards stay its trophies and its
+1 Brainpower, with no cosmetics tied to it (CLAUDE.md).

One title is shown at a time, a chest, earned or quest one.

## In the app

- **The map:** the chest sits beside the road between the 5th and 6th levels: shut and dim until the 5th is cleared, bobbing and lit when ready, open after.
- **Opening:** a screen of its own. Open, then the prize: a boost (Start now, or Save for later), +2 Brainpower, or a cosmetic (Wear it, or Later).
- **XP boosts on Profile** (owner, 2026-10-07: "just a bar that appears if you have xp boosts available"): a bar for the running boost with its time left, and one per saved boost with Start (one runs at a time). Nothing shows without boosts.
- **Edit profile** (the pencil on Profile): you as others see you, your username, then glows, name styles and titles in tabs, worn with a tap. Titles include quest titles; one title shows. Items not found yet show dimmed with their tier.
- **While a boost runs:** a gold "2x" chip with the time left on Home, and "2x XP boost" on Level Complete.

## Out of scope here

App icons (they need icon art and a new phone build), Dr. Scroll outfits.
