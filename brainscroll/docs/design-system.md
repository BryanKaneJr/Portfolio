# BrainScroll design system

This is the UI foundation for the consumer app. Tokens live in `app/src/theme/tokens.ts`, haptics and reduce-motion in `app/src/theme/feedback.ts`, and components in `app/src/components/ui/`. Screens compose these primitives and don't restyle raw React Native views. See [`visual-direction.md`](visual-direction.md) for the brand and [`ui/`](ui) for screenshots.

## The principle: learning is calm, progress is powerful

| | Learning mode (levels, review questions) | Progression mode (Level Complete, mastery, daily complete, character sheet) |
|---|---|---|
| Hero | The content: heading, paragraphs, the question | The payoff: outcome, XP, level-up, ★ |
| Colour | Navy/graphite, soft white text, **one** violet action | Violet glow; **gold only for mastery/prestige** |
| Chrome | Close, a thick progress bar, one quiet utility (⚑ report). No XP, stats, trophies or tabs | Big numerals, emblems, staggered reveals, count-ups |
| Motion | Only feedback (select, grade, progress settle) | Pop, count-up, reveal, reward haptic |
| Background | `bg` | `bgDeep` (a step darker, so glow has headroom) |

If everything glows, nothing feels special. `glow.*`, `Halo`, `Emblem glowing`, the `reward`/`mastery` card variants and the `mastery` button **never appear on lesson screens**.

## Tokens (`theme/tokens.ts`)

- **Colour:** `bg`, `bgDeep`, `surface`, `surfaceRaised`, `surfacePressed`, `border(Strong)`; `brand` (+`Pressed`, `Soft`, `Line`); `success`, `danger`, `mastery` (each with `Soft`/`Line` tints); `info`; `text`, `textReading` (paragraphs, a touch softer), `textMuted`, `textFaint`; `scrim`.
- **Type scale:**
  - `hero` 56 / `display` 40 / `h1` 30 / `h2` 24 / `title` 20: progression and structure
  - **`reading` 18/28:** lesson paragraphs
  - `body` 16/23, `bodyStrong`, `caption` 14/20
  - `label` 12 (uppercase eyebrow), `button` 16 (uppercase), `number` (tabular numerals)
- **Space:** 2 · 4 · 8 · 12 · 16 · 24 · 32 · 48. **Radii:** 6 · 10 · 14 · 20 · 28 · pill.
- **Layout:**
  - `gutter` 20
  - `readingWidth` 620: comfortable line length, so tablets and web never stretch
  - `minTouch` 48
  - `buttonHeight` 56
  - `answerMinHeight` 60
  - `topBarHeight` 56
- **Elevation:** `raised`, `overlay` (subtle; dark UIs read depth from borders). **Glow:** `brand`, `success`, `mastery` (reward only).
- **Motion:** `press` 90, `fast` 150, `normal` 220, `slow` 420, `celebrate` 900 ms. Every animation respects reduce-motion via `useReduceMotion()`.
- **Haptics:**
  - `haptic.select()`: selection
  - `correct()` / `incorrect()`: notification feedback
  - `reward()`: level complete
  - All are no-ops on web.

## Components (`components/ui/`)

| Group | Primitives |
|---|---|
| Text | `Eyebrow` (context line, never the message), `Display`, `H1`, `H2`, `Title`, `Reading` (lesson paragraphs), `Body`, `Caption`, `Numeral` |
| Actions | `Button`. Variants: `primary` (violet, **one per screen**), `secondary`, `ghost`, `success` (Continue after a correct answer), `mastery` (gold, mastery moments only). Buttons depress on press (the 3 px base collapses) and are full-width. `IconButton` is for quiet top-bar controls. |
| Surfaces | `Card`. Variants: `plain`, `quiet`, `raised`, `accent` (the one primary card on a tab screen), `reward`, `mastery`. Also `Row`, `Stack`, `Divider`, `Chip`. |
| Progress | `ProgressBar` (animated; `size="lesson"` is the thick lesson bar), `Pips` (discrete, e.g. today's allowance), `ChapterRail` (the current 10-level chapter: done violet, next blue, rest quiet, level 100·k gold) |
| Questions | `AnswerOption`. States: `idle`, `selected`, `correct`, `eliminated`, `locked`. It's a large lettered card, not a radio dot. `FeedbackPanel` (`success` / `reinforce`), `EvidenceBlock` ("Take another look") |
| Shells | `Screen` + `ScreenHeader` (tab screens), `LessonShell` (levels and review), `Field` |
| Reward | `useCountUp`, `Reveal` (staggered rise-in), `Pop` (spring), `Halo`, `Emblem` (level numeral badge; `tone="mastery"` only with a ★), `Stars`, `StatTile` |

## Interaction patterns

- **Lesson shell:**
  - Top: ✕, a thick progress bar, ⚑.
  - Middle: content at reading width.
  - Bottom: **one** action in thumb reach, above the safe area. The first card carries the level context, title and objective above the hook.
- **Questions: select → CHECK.** Tapping an answer only selects it (violet). CHECK grades it. Only a checked answer is an attempt, so a stray tap can't burn the first attempt. The first *checked* answer is the first attempt for XP, exactly as before.
- **Correct:** the card turns mint, the footer tints mint with "Correct" plus the explanation, and a mint CONTINUE. A success haptic plays.
- **Wrong (teaching, not punishment):**
  - The pick is crossed out and the footer tints a restrained coral: "Not quite" plus the rationale.
  - **Take another look** appears directly under the prompt with the question's canonical source cards (compact rendering), and the view scrolls to it.
  - The learner chooses again and checks; the answer is never revealed.
  - After correction the footer reads "Got it: reinforced · We'll bring this back later".
- **Level Complete:** outcome headline (Perfect Recall / Strong recall / Knowledge reinforced / Level cleared) → XP count-up with halo → the skill emblem counting up the level and progress toward the next ★ → one line of detail (first try, Knowledge Level, today) → the next step. Mastery turns the moment gold ("★ Mastery star earned").
- **Home:** one `accent` card owns the screen: skill emblem, next level title and objective, the chapter rail, and one primary button. Today (pips) and Review are secondary. After the daily cap, Review becomes the primary action.

## Deferred until real-device testing

- **Fonts:** the Sora/Manrope-direction font files aren't bundled yet, so the system font is used. Swapping means adding `expo-font` and setting `fontFamily` in `type`.
- **Animation timing:** exact durations and spring constants, the XP count-up curve, the halo's soft edge (a radial gradient needs an SVG or gradient dependency), and screen transitions.
- **Haptic intensity:** tuning on real iOS/Android hardware.
- **Other:** landscape and tablet layouts beyond the centered reading column; Dynamic Type / font scaling limits; one-handed reach tuning; image and diagram cards (assets ship later); the icon set (tab icons are system symbols).
- **Screen readers:** a VoiceOver/TalkBack pass; focus order in the feedback panel.
