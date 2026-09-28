# BrainScroll design system

This is the UI foundation for the consumer app. Tokens live in `app/src/theme/tokens.ts`, haptics and reduce-motion in `app/src/theme/feedback.ts`, and components in `app/src/components/ui/`. Screens compose these primitives and don't restyle raw React Native views. See [`visual-direction.md`](visual-direction.md) for the brand and [`ui/`](ui) for screenshots.

## The principle: learning is calm, progress is powerful

| | Learning mode (levels, review questions) | Progression mode (Level Complete, mastery, daily complete, character sheet) |
|---|---|---|
| Hero | The content: heading, paragraphs, the question | The payoff: outcome, XP, level-up, ★ |
| Colour | Slate gray, soft white text, **one** violet action | Violet glow; **gold only for mastery/prestige** |
| Chrome | Close, a thick progress bar, one quiet utility (⚑ report). No XP, stats, trophies or tabs | Big numerals, emblems, staggered reveals, count-ups |
| Motion | Only feedback (select, grade, progress settle) | Pop, count-up, reveal, reward haptic |
| Background | `bg` | `bgDeep` (a step darker, so glow has headroom) |

If everything glows, nothing feels special. `glow.*`, `Halo`, `Emblem glowing`, the `reward`/`mastery` card variants and the `mastery` button **never appear on lesson screens**.

## Tokens (`theme/tokens.ts`)

- **Colour:** `bg`, `bgDeep`, `surface`, `surfaceRaised`, `surfacePressed`, `border(Strong)`; `brand` (+`Pressed`, `Soft`, `Line`) for fills, borders and buttons, and `brandText` (`#AE9DFF`) for violet **text** on dark surfaces, since `brand` itself is only 3.87:1 on `bg`, below WCAG AA for normal text; `success`, `danger`, `mastery` (each with `Soft`/`Line` tints); `info`; `plum` (+`Deep`, `Soft`, `Line`); `text`, `textReading` (paragraphs, a touch softer), `textMuted`, `textFaint`; `scrim`.
- **Flame orange (`streak`) is the learning streak's colour only:** the flame and count in the World Map header, the streak chip on Level Complete, the Profile tile. Never gold (mastery) or coral (a miss). The flame is dim (`textFaint`) until today counts.
- **Bow Tie Plum (`plum`) is Dr. Scroll's colour**, taken from his bow tie. Anything he says wears it: speech-bubble borders, tip actions ("Got it"), and the "Did you know" label on fact cards (fun facts are his territory). It never marks an action or progress: those stay brand violet, and gold stays mastery-only. `plum` text passes contrast on `surface` (5.3:1); use `plumDeep` for fills.
- **Type scale:**
  - `hero` 56 / `display` 40 / `h1` 30 / `h2` 24 / `title` 20: progression and structure
  - **`reading` 18/28:** lesson paragraphs
  - `lead` 18/25 bold (the key idea, a comparison's label), `choice` 17/24 (answer options, onboarding skills)
  - `body` 16/23, `bodyStrong`, `caption` 14/20, `meta` 13 (tiny metadata: map-tile levels, answer letters)
  - `label` 12 (uppercase eyebrow), `button` 16 (uppercase), `number` 28 and `numberSm` 22 (tabular numerals)
- **Space:** 2 · 4 · 8 · 12 · 16 · 24 · 32 · 48. **Radii:** 6 · 10 · 14 · 20 · 28 · pill.
- **Borders (`depth`):** `border` 2 on every surface, `edge` 4 under tappable ones, `line` 1 only for separators and quiet inner frames (footer rules, inputs at rest, evidence and comparison boxes).
- **Icons (`iconSize`):** `xs` 12 (tiny badges), `sm` 16 (beside captions), `md` 20 (beside body text), `lg` 24 (controls, headers, tabs), `xl` 32 (placeholders).
- **Ink on fills:** `onBrand`, `onSuccess`, `onMastery`; `successTint` / `dangerTint` are the lesson footer's opaque verdict tints.
- A one-off number is allowed only for a fixed-size badge or geometry (emblems, ring pips, the splash), and it carries a comment saying why.
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
| Actions | `Button`. Variants: `primary` (violet, **one per screen**), `secondary`, `ghost`, `success` (Continue after a correct answer), `mastery` (gold, mastery moments only). Buttons depress on press (the 4 px edge collapses) and are full-width. States: default, pressed, `disabled` (grey and flat), `loading` (keeps its colour, ignores taps, and shows three breathing dots after a label that says what's happening: "Checking", "Saving"). `IconButton` is for quiet top-bar controls. |
| Surfaces | `Card`. Variants: `plain`, `quiet`, `raised`, `accent` (the one primary card on a tab screen), `reward`, `mastery`. States: pressed (tappable cards), `selected` (violet outline and tint; use `role="radio"` for a set of choices), `completed` (mint outline, check badge), `locked` (flat, dimmed, lock badge, ignores taps). Also `Row`, `Stack`, `Divider`, `Chip`. |
| Progress | `ProgressBar` (animated; `size="lesson"` is the thick lesson bar), `Pips` (discrete, e.g. today's allowance), `ChapterRail` (the current 10-level chapter: done violet, next blue, rest quiet, level 100·k gold) |
| Questions | `AnswerOption`. States: `idle` (unanswered), `selected`, `checking` (the pick while CHECK is in flight: it stays violet and its letter breathes; the others lock), `correct`, `eliminated` (a wrong pick, crossed out; the rest reopen for the retry), `locked`. It's a large lettered card, not a radio dot. `FeedbackPanel` (`success` / `reinforce`), `EvidenceBlock` ("Take another look") |
| Shells | `Screen` + `ScreenHeader` (tab screens), `LessonShell` (levels and review), `Field` |
| Loading | `Skeleton`, `SkeletonLines`, `SkeletonCard` (placeholders shaped like the content, breathing slowly, still with reduce motion), `Loading` (wraps them so screen readers hear one "Loading"), `LessonSkeleton` (a level or review on its way; Dr. Scroll's `loading` spot appears under it only if the wait runs long). No platform spinners. |
| Dead states | `StateBlock`: Dr. Scroll in a spot, a title, one line, at most two actions, as a `card` (tab screens), a `screen` (stack screens) or an `inline` notice. `LoadError` is the network failure ("Couldn't load this one. Your progress is safe. Try again.") with a retry; `OfflineNotice` is Home's. Review empty reads "You're caught up. Nothing needs review right now. Go learn something new."; Home before any level points to a first subject or Choose for me (`home.start`). A failed load is never shown as empty. |
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
  - **Take another look** appears directly under the answer choices with the question's canonical source cards (compact rendering). The view doesn't jump, so the choices stay where the learner's thumb is.
  - The learner chooses again and checks; the answer is never revealed.
  - After correction the footer reads "Got it: reinforced · We'll bring this back later".
- **Level Complete:** outcome headline (Perfect Recall / Strong recall / Knowledge reinforced / Level cleared) → XP count-up with halo (and, on the day's first learning, a flame chip: "Streak started" / "Day N streak") → the skill emblem counting up the level, then, under a divider labelled "Long-term goal", progress toward the next ★ and the skill's promise ("At Lv. 100: …") → Dr. Scroll's line (at a chapter's last level, the proof card instead: "10 levels ago, could you have explained this?", the chapter's recap lines checked off one by one, then "You know this now.", with no score) → "Across BrainScroll": Knowledge Level and today's new levels → the next step. Each number sits under the scope it belongs to (this level, this skill, everything), revealed in that order. Mastery turns the moment gold ("★ Mastery star earned").
- **Learning cards share one grammar:** an optional small label ("Did you know" in plum on fact cards, "What you learned" on recaps), the heading, the body, then an optional "Key idea" box (violet tint, left rule, always labelled and always last). The hook keeps its larger opening heading. Timelines and comparisons put their rows where the body goes.
- **Home (the World Map):** the header carries the Knowledge Level and the streak flame; the Current Quest card owns the screen, with Choose for me under it. Review never appears here: it lives in the Review tab (owner decision).

## Deferred until real-device testing

- **Depth:** tappable and important surfaces (buttons, cards, answer tiles, badges, stat tiles) stand on a 4 px bottom edge in a darker shade (`depth.edge`, `brandEdge`, `successEdge`, `masteryEdge`), with 2 px borders, never hairlines. Buttons collapse their edge when pressed. Level and skill badges are solid violet (gold for mastery) with white numerals. Numbers and statuses carry an icon (`Icon`: xp, knowledge, star, skills, today). The active tab sits in a violet-outlined box.
- **Motion:** `SlideIn` and `usePop` (`components/ui/motion.tsx`) keep motion small and quick, and snap into place with reduce motion. Each new lesson step slides in from the right; the answer verdict rises from below with its badge popping; a picked answer springs; the level just cleared pops on Home's path; path nodes give a haptic tick.
- **Font:** Nunito (`@expo-google-fonts/nunito`), loaded at startup; the launch screen waits for it. It is rounded and friendly like Dr. Scroll and stays very legible at reading sizes. Custom fonts pick their weight by family, so styles take weight from `fw('700')` in `theme/tokens.ts`, never `fontWeight`.
- **Icons:** icon-only buttons use `IconButton` with a named icon (`expo-symbols`: SF Symbols on iOS, Material on Android and web), never a text character.
- **Animation timing:** exact durations and spring constants, the XP count-up curve, the halo's soft edge (a radial gradient needs an SVG or gradient dependency), and screen transitions.
- **Haptic intensity:** tuning on real iOS/Android hardware.
- **Other:** landscape and tablet layouts beyond the centered reading column; Dynamic Type / font scaling limits; one-handed reach tuning; image and diagram cards (assets ship later); the icon set (tab icons are system symbols).
- **Screen readers:** a VoiceOver/TalkBack pass; focus order in the feedback panel.

## Copy: say it once

Screens don't explain themselves. A line earns its place only if the learner would be lost or misled without it.
- Don't restate what a button or heading already says (no "Up next: X" above "Next: Level 2").
- State a rule where it matters, once: the free-forever promise lives on the deal screen and the Unlimited screen, not on every card.
- No reassurance footers ("your progress is saved…") on screens where nothing is at risk.
- Keep what protects the learner: destructive-action warnings, subscription terms, error messages.
