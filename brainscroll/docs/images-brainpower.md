# Brainpower images: to make

**Status (2026-10-02): made by the owner and in the app** (`app/assets/images/ui/`, wired in `app/src/components/ui/uiArt.ts`).

**Style for all of them:** the same chunky, rounded 3D clay as the streak flame (`ui/streak-flame`) and the trophies, soft light from the top left. **Transparent background, 1024 × 1024 PNG**, the object filling about 80% of the frame, centered. No text or numbers. **Not gold** (gold means mastery in BrainScroll). The brain is soft pink, the colour of `phil_brain-jar` and the Psychology avatar, so it matches art learners already know.

Name each file exactly as below and send them over (a Dropbox folder link is fine). They go in `app/assets/images/ui/` as WebP.

## 1. The brain (needed)

These sit in the header chip beside the streak flame (shown at about 32 px) and large on the Brainpower screen (about 170 px, with the count drawn over its lower third). They have to read at both sizes.

| File name | Shown when | What to draw |
| --- | --- | --- |
| `ui_brainpower.png` | You have Brainpower to spend | A soft pink clay brain with a faint violet (#7856FF) rim light, as if charged. Bold, simple folds: at 32 px it must still read as a brain, not a blob. Keep the lower third plain, since the count sits there. |
| `ui_brainpower-empty.png` | You're at 0 | The same brain, same pose and size, desaturated grey-pink with no glow. Like `streak-ember` beside `streak-flame`: the same object, resting. |
| `ui_brainpower-unlimited.png` | Unlimited (∞) | **Made (2026-10-02):** a gold brain with small gold sparkles, shown with ∞. The owner chose gold here on purpose, the one exception to gold-for-mastery. |

**Rule for the set:** all three are the same brain in the same pose, so swapping between them looks like the brain changing state, not a different picture.

## 2. The +1 spark (needed for the animation)

When you earn Brainpower, a small spark flies from what earned it (the trophy, the streak chip, the "Lucky Brainpower Drop" line) up to the brain in the header. The brain pulses and the number ticks up by one.

| File name | What to draw |
| --- | --- |
| `ui_brainpower-spark.png` | A small glowing orb, pink at the core and violet at the edge, with a tiny brain silhouette or fold pattern inside it. It is shown at only 24 to 32 px while moving, so keep it very simple: a bright round shape with a soft glow. |

## 3. The ways to earn (nice to have)

The Brainpower screen, Level Complete and the out-of-Brainpower screen list the ways to earn with emoji right now. Three of them already have art in the app (the streak flame, the trophy, the review cards). Only one is new:

| File name | Replaces | What to draw |
| --- | --- | --- |
| `ui_lucky-drop.png` | ✨ "Lucky Brainpower Drop" (the 10% chance after a perfect level) | The pink spark from section 2 falling with a short sparkle trail, like something rare dropping in. It should feel lucky and surprising, but **not like loot**: no chest, coins or gems. |

## Not needed

- **"Brainpower Full":** the words do it; no art.
- **The out-of-Brainpower screen:** keeps Dr. Scroll's existing `go-outside` pose.
- **Chapter reviews and trophies:** use the existing `review` and `trophy` art.
