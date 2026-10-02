# Legendary profile avatars: one per top gold trophy

**Status (2026-10-01): made by the owner and in the app** (`app/assets/images/avatars/legendary-<name>.webp`; core `LEGENDARY_AVATARS` maps each to its trophy). Jack of All Trades came out as a gold jack playing card, and the series ones as single gold emblems on a plum backdrop; both work. These are the rarest avatars in BrainScroll, above the gold tree avatars ([`images-avatars-gold.md`](images-avatars-gold.md)). Each one unlocks with one of the **top gold trophies**:

- Master of All and Jack of All Trades;
- the six subject masteries;
- the top tier of each counted series.

Most learners will never see one up close. When one shows up in a league or the feed, it should stop people scrolling.

## The look: a legendary frame

The same idea as the other avatars (a circular frame with the subject breaking out of it in 3D), with a frame that outranks gold:

- **Ring:**
  - a **double gold ring** with small cut gems set around it like a crown band;
  - a short **burst of gold rays** fanning out behind the top of the circle, like a sunrise behind a medal;
  - the ring stays a perfect circle, so the avatar still sits cleanly in lists.
- **Backdrop:** a **deep midnight violet** (the app's brand, darkened), with a soft gold glow behind the subject and a few tiny gold stars. The six subject masteries use their subject's colour instead, deep and rich.
- **The subject:**
  - solid polished gold, matching the existing gold trophies;
  - it pops out of the frame **more** than the regular avatars (about a third to a half), so these feel bigger than the frame can hold.
- **Sparkle:** three or four four-point glints. Still precious, never glittery.
- **The same base rules:** the chunky 3D clay style, light from the top left, no text or numbers, readable at 32 px.
- **Canvas:** transparent background, 1024 × 1024 PNG. The circle is about 70% of the width (a little smaller than the regular set), to leave room for the rays and the bigger pop-out.

## The 14 legendary avatars

### The two greatest

| File name | Trophy | What to draw |
| --- | --- | --- |
| `avatar_master-of-all.png` | **Master of All** (every skill to Level 100: the greatest trophy) | **Golden Dr. Scroll.** Dr. Scroll, cast entirely in polished gold, rising out of the top of the frame from the waist up, arms raised in triumph. He wears a gold laurel crown and holds a glowing gold scroll unfurled in one hand. He has his bow tie, glasses and kind face, but all of him is gold. Light pours from behind him through the rays. This is the one avatar where the frame barely holds its subject. |
| `avatar_jack-of-all-trades.png` | **Jack of All Trades** (Level 50 in every skill) | **A gold juggler's spread:** six small gold objects arcing out of the top of the frame in a fountain, one for each subject: a Colosseum, a ringed planet, a globe, a palette, a gear and a lightbulb. Inside the circle sits a gold jester-style cap with three bells, tipped at a jaunty angle. |

### Masters of a subject (every skill in it to Level 100)

These match the existing subject trophies, upgraded into legendary frames. Each backdrop is its subject's colour.

| File name | Trophy | What to draw |
| --- | --- | --- |
| `avatar_master-history.png` | Master of History | A gold Colosseum, its top arches rising out of the frame, with a gold laurel wreath crowning it. |
| `avatar_master-science.png` | Master of Science | A gold ringed planet with a gold atom orbiting it, the ring bursting out on both sides. |
| `avatar_master-geography.png` | Master of Geography | A gold globe on its stand, a gold compass needle sweeping out of the top of the frame. |
| `avatar_master-arts.png` | Master of Arts & Culture | A gold palette and brush, with a gold music note and a gold quill fanning out of the top with them. |
| `avatar_master-world-systems.png` | Master of How the World Works | Two interlocking gold gears, the larger one rolling up and out of the frame, small gold sparks at the teeth. |
| `avatar_master-mind.png` | Master of Mind & Reasoning | A gold brain with a gold lightbulb glowing above it, the bulb rising out of the top of the frame. |

### The top of each series

These match the gold top-tier trophies (`images-trophies-gold.md`), each turned into a scene.

| File name | Trophy | What to draw |
| --- | --- | --- |
| `avatar_thousand-levels.png` | A Thousand Levels | A gold staircase spiralling up out of the top of the frame, its top step glowing. |
| `avatar_fifty-chapters.png` | Fifty Chapters | A tall stack of gold books, the top book open with gold pages fluttering out of the frame. |
| `avatar_perfect-thousand.png` | 1,000 Perfect Lessons | A gold archery target, a gold arrow dead centre, two more arrows mid-flight streaking out of the frame toward it. |
| `avatar_steel-trap.png` | Steel Trap (500 first-try reviews) | The gold elephant from the trophy, rearing up out of the frame with its trunk raised high. |
| `avatar_quest-legend.png` | Quest Legend (52 weekly quests) | A gold pennant on a tall pole, planted on a small gold summit, the flag streaming out of the top of the frame. |
| `avatar_streak-thousand.png` | 1,000 Days (streak) | A gold flame, cast like a statue, roaring up and out of the top of the frame, with a ring of small gold embers around it. |

## The Dr. Scroll exception

The other avatar sets never include Dr. Scroll: he's the app's mascot, not someone you dress up as. **Master of All is the one exception** (owner, 2026-10-01): becoming a golden Dr. Scroll is the reward for mastering everything. It stays the only avatar he appears in, so it keeps its meaning. Follow the mascot reference (`docs/mascot-reference.webp`) for his shape and face, cast in gold.

## Rules for the set

- **One family:** the same double ring, the same gems, the same rays and the same violet night on all of them (the subject masteries swap the backdrop colour only).
- **Unmistakable at 32 px:** the rays and gems should make a legendary avatar recognisable in a league list before you can even see what's inside.
- **Above gold, not beside it:** put one next to a gold tree avatar. The legendary one should clearly outrank it.

## When they're done

Send the PNGs as they are. They'll be converted to 256 px WebP. Each one unlocks with its trophy (the server checks), and it shows wherever avatars do.
