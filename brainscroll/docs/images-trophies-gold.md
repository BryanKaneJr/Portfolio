# Gold top-tier trophy images: all 6 made

**Status (2026-09-29): made by the owner and in the app** (`app/assets/images/trophies/*-gold.webp`, wired in `trophyArt.ts`; core `MILESTONE_TROPHIES` points each top tier at its `-gold` art).

Each counted trophy series gets a gold version for its highest tier. The gold image replaces the violet one only for that top trophy (for example, A Thousand Levels shows gold stairs; Warming Up, Century and Five Hundred keep the violet stairs).

## How to make them

- **Make each one as an edit of its existing violet trophy image** (listed below), so the object, shape, angle, size and position stay identical. Only the material changes: from violet clay to **solid polished gold**.
- **Gold style:** match the existing gold trophies (`trophy_master-of-all.png`, `trophy_subject-history.png`): rich yellow gold, warm highlights, soft light from the top left, a gentle shadow. It must clearly read as **metal**, not yellow or orange paint.
- **No numbers, letters or text.** The app draws the count on top.
- **Leave the bottom fifth of the image clear.** The count overlaps the lower edge of the object there.
- One object, centered, slightly angled, nothing else in the frame.
- **Transparent background, 1024 × 1024 PNG**, same framing as the violet version, so the two can be swapped without the object jumping.

## The six images

| File name | Trophy (top tier) | Edit this image | What to draw |
| --- | --- | --- | --- |
| `trophy_levels-gold.png` | A Thousand Levels (1,000) | `trophy_levels.png` | The same short staircase of three rising steps, in solid gold |
| `trophy_chapters-gold.png` | Fifty Chapters (50) | `trophy_chapters.png` | The same closed book with a ribbon bookmark hanging out, in solid gold (the ribbon can stay a deep gold too) |
| `trophy_perfect-lessons-gold.png` | 1,000 Perfect Lessons | `trophy_perfect-lessons.png` | The same archery target on its stand with one arrow dead center, in solid gold |
| `trophy_reviews-gold.png` | Steel Trap (500 first-try reviews) | `trophy_reviews.png` | The same small, friendly sitting elephant, in solid gold |
| `trophy_quest-clears-gold.png` | Quest Legend (52 quests in their week) | `trophy_quest-clears.png` | The same pennant flag on a short pole, waving, in solid gold |
| `trophy_streak-gold.png` | 1,000 Days (streak) | `trophy_streaks.png` | The same flame, cast in **solid polished gold**, like a gold statue of a flame. The violet set's flame is already golden orange, so this one must look clearly metallic (reflections, hard highlights) to stand apart from it |

## When they're done

Send the six PNGs as they are. They'll be converted to 384 px WebP and saved as `app/assets/images/trophies/<name>.webp` (the file name without `trophy_` and `.png`, e.g. `levels-gold.webp`). The app then shows the gold art, a gold edge and a gold outline on the number for those six trophies only.
