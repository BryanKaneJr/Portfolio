# Trophy images: 21 to make, plus the streak flame

**Status (2026-09-29): all 21 made by the owner and in the app** (`app/assets/images/trophies/`, 384 px WebP, wired in `trophyArt.ts`). The streak trophies use the owner's flame (`trophy_streaks.png` → `streak.webp`). To replace one, overwrite its file. Skill mastery trophies already have art (each skill's golden mastery image) and quest trophies use their quest's art, so neither is listed here.

**How counted trophies work.** Levels, chapters, perfect lessons, reviews and quests each have **one image**, and the app draws the count on top (the perfect-lesson trophy with "100" in front for 100 perfect lessons). So those images carry **no numbers**, and should leave the **bottom fifth clear** for the count.

**Style for every image:** one object, glossy 3D clay, soft light from the top left, gentle shadow, centered, slightly angled, nothing else in the frame. Transparent background, 1024 × 1024 PNG, no text, letters or numbers (the playing card's own J and spade marks are the only exception).

**Colour rule:** gold means mastery in BrainScroll, so only the mastery trophies below are **solid gold** (like the mastery badges). Everything else is **BrainScroll violet clay (#7856FF) with soft silver accents**.

Files live at `app/assets/images/trophies/<key>.webp` (the key is the file name without `trophy_` and `.png`), listed in `app/src/components/ui/trophyArt.ts`.

## Gold (mastery)

| File name | Trophy | What to draw |
| --- | --- | --- |
| `trophy_master-of-all.png` | **Master of All** (every skill to Level 100, the greatest trophy) | **Dr. Scroll's head as a solid gold bust** on a small round gold plinth. Make it as an **edit of `docs/mascot-reference.webp`** so it's unmistakably him: his face, glasses, tufts of hair and bow tie, head and shoulders only, all in polished gold. The most special image of the set: richest gold, the strongest shine. |
| `trophy_jack-of-all-trades.png` | **Jack of All Trades** (Level 50 in every skill) | A **solid gold jack of spades** playing card, standing slightly angled, with an embossed jack figure, the J and spade marks raised in the gold (owner's choice of gold, though it isn't strictly mastery) |
| `trophy_first-mastery.png` | **First Mastery** (a first skill to Level 100) | A gold star medal hanging from a short gold ribbon |
| `trophy_subject-history.png` | **Master of History** | A gold Colosseum |
| `trophy_subject-science.png` | **Master of Science** | A gold ringed planet |
| `trophy_subject-geography.png` | **Master of Geography** | A gold globe on its stand |
| `trophy_subject-arts.png` | **Master of Arts & Culture** | A gold painter's palette with a gold brush |
| `trophy_subject-world-systems.png` | **Master of How the World Works** | Two interlocking gold gears |
| `trophy_subject-mind.png` | **Master of Mind & Reasoning** | A gold lightbulb |

## Violet (everything else)

Counted series first; leave the bottom fifth clear for the number.

| File name | Trophies (counts drawn by the app) | What to draw |
| --- | --- | --- |
| `trophy_perfect-lessons.png` | 10, 25, 50, 75, 100, 200, 300 … 1,000 Perfect Lessons | An archery target with one arrow dead center |
| `trophy_levels.png` | Warming Up (25), Century (100), Five Hundred, A Thousand Levels | A short staircase of three rising steps |
| `trophy_chapters.png` | Chapter One, Ten Chapters, Fifty Chapters (Chapter One shows no number) | A closed book with a ribbon bookmark hanging out |
| `trophy_reviews.png` | Long Memory (100), Steel Trap (500 first-try reviews) | A small, friendly elephant, sitting |
| `trophy_streak.png` | One Week (7), One Month (30), A Hundred Days, One Year (365), 500 Days, 1,000 Days | A single flame. **Or reuse the owner's streak flame** (below): save it once and point the `streak` line in `trophyArt.ts` at it |
| `trophy_quest-clears.png` | First Quest (1), Quest Regular (4), Quest Veteran (10), Quest Champion (25 quests in their week) | A pennant flag on a short pole, waving |
| `trophy_first-level.png` | First Level | An open book with a single page turning |
| `trophy_halfway.png` | Halfway There (Level 50 in a skill) | A mountain with a small flag planted halfway up |
| `trophy_curious.png` | Curious (a level in 10 skills) | A magnifying glass |
| `trophy_explorer.png` | Explorer (a level in every skill) | A compass, lid open |
| `trophy_well-rounded.png` | Well Rounded (Level 10 in five skills) | A sphere wrapped by five thin rings in different colours |
| `trophy_polymath.png` | Polymath (a level in every subject) | Six small gems in a ring, one in each subject colour: terracotta, blue, teal, pink, lavender, green |

## The streak flame (header)

The World Map header shows the owner's `ui_streak-flame` once today counts and `ui_streak-ember` (a glowing coal) while the run is still yesterday's (`app/src/components/ui/uiArt.ts`).
