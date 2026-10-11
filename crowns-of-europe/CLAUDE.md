# CLAUDE.md — Crowns of Europe

Handoff notes for Claude Code. Read this first, then `README.md`, `AGENTS.md` (Expo SDK rules),
`docs/design-notes.md` (decisions that override the original design doc) and `docs/content-guide.md`.

## What this is
A portrait-only, offline, pay-once grand strategy game (Europe, the Middle East, West Africa and the eastern
Americas, 1444–1750) for iOS and
Android: Expo SDK 57, React Native 0.86, TypeScript, Expo Router. The original design doc is the spec except where
`docs/design-notes.md` says otherwise (Expo instead of Godot, 211 regions including the New World and colonization,
a Mercator map, light tutorial, no audio yet).

## Hard rules
- **The simulation owns the rules.** `src/sim/` is plain TypeScript with no React or platform imports. The UI
  reads `GameState` and calls `src/sim/commands.ts`; it never changes state on its own (the one exception is
  `store.markReportSeen`). New mechanics go in `src/sim/` with a test in `tests/`.
- **Deterministic.** All randomness goes through `rand(s)` in `src/sim/util.ts` (state kept in `s.rng`). Never
  `Math.random()` in `src/sim/` (only the new-game seed). `tests/soak.test.ts` checks a seed replays exactly and
  survives a JSON save/load.
- **Content is data.** Events, missions and achievements are JSON in `src/content/`, written in the
  condition/effect language. A new condition or effect goes in `src/sim/dsl.ts` (schema), `src/sim/events.ts`
  (implementation), `docs/content-guide.md` and `tests/events.test.ts` (sample). `npm run validate` must pass.
- **Original text only.** No other game's wording, art or mechanic names. Player-facing text says prosperity,
  levies, order, renown, leverage, army limit, integrated and exports (alongside Threat, Claim, Era, coalition,
  colonists, war exhaustion, policy and mission); the code keeps the old names (`dev`, `manpower`, `stability`,
  `prestige`...). `scripts/check-terms.ts` (in `npm run validate`) enforces it; the glossary is in
  `docs/content-guide.md` and the in-game one in `ui/game/Help.tsx`.
- **Every number is explainable.** If you add a number to the UI, make it tappable or give it a line that says
  why (see the opinion, unrest, income and war score breakdowns).
- **Offline.** No network calls anywhere in `src/`.
- The map is generated: edit `src/content/regions.json` / `seas.json` (seeds, rivers, straits, lakes), then
  `npm run map:build`. Never hand-edit `map.json`. The builder warns about seeds in the water; fix those.
- **Uncolonized land has `owner: null`** (and `controller: null`). Anything that loops over all regions must skip
  it (`if (!r.owner) continue`) or use `ownedRegions()`. Use `isIn(list, r.owner)` from `util.ts` for
  "is this region's owner one of these nations". Before discovery, `charted()` (colonies.ts) closes the New World
  to armies, fleets and colonists, and the map draws it as blank parchment.

## Layout
```
src/sim/       types, content (JSON loaders + movement graph), state (new game), tick (daily/monthly), commands,
               military (paths, convoys, movement, supply), battle, siege, navy, war (war score, peace), diplomacy
               (opinion, actions), threat (coalitions), economy, colonies (discovery, colonists, settlers, natives,
               trade goods), events (DSL eval), dsl (schema), missions, aims (what each AI crown wants: historical
               aims, mission goals, bonds), rulers, religion (Reformation, Papal Favor, HRE), rebels, territory,
               ai, queries, util, log
src/content/   regions, seas (+straits, rivers, wastelands, lakes), nations, scenario1444, traits, policies, units,
               names, events-historical, events-generic, events-newworld, missions, achievements, aims (historical
               aims and old friendships/enmities), map.json (generated)
src/app/       _layout, index (title), new-game (nation picker), game, +not-found
src/ui/        map/ (MapView, colors, geometry, tap, MiniMap), game/ (Bars, Sheet, RegionSheet, ColonySheets,
               UnitSheets, NationSheet, Cards, Panels, Menu, Help), components/ (kit, Flag, Icon), describe
               (plain-English effects and goals), theme
src/state/     store (game loop, selection, overlays, toasts, play-test hook on window.__coe), storage (saves)
scripts/       build-map, validate-content, make-icons, screens + screens-war + screens-newworld (Playwright), serve,
               dev/ (soak, trace)
tests/         battle, movement, siege, war, colonies, aims, events, soak (Jest, node)
```

## Commands
```
npm install
npx expo start              # Expo Go / simulators;  npx expo start --web for the browser
npm run check               # typecheck + lint + validate + tests. Run before calling anything done
npm run screens             # web export + Playwright walkthroughs → screens/ (look at them after UI changes)
npm run soak -- 40 3        # AI-only game for 40 years, seed 3
npx tsx scripts/dev/trace.ts TUR 10 1   # follow one nation through an AI game
npm run map:build           # after editing regions.json / seas.json
```
Expo 57 is newer than most training data: follow `AGENTS.md` (check versioned docs; `npx expo install` for
native deps). Reanimated 4 shared values use `.get()`/`.set()` (the React Compiler lint rejects `.value =`).

## Map rendering
The map is Mercator, 2575 × 2242 units (17.4 units per degree of longitude; Europe is the top-right corner).
`MapView` keeps a camera `{cx, cy, k}` in React state. During a gesture the last rendered SVG is moved with a
native transform (Reanimated); on release the SVG re-renders at the new camera (crisp at any zoom). The SVG is
rendered 1.6× the screen size so short pans never show an edge. Units are plain RN views on top. Taps are
hit-tested in map units (`ui/map/tap.ts`): your own units first, then regions, then seas. Strokes and text sizes
are divided by `k` so they stay constant on screen.

## Current status
- Feature-complete against the design doc's three milestones except audio and a scripted tutorial
  (see `docs/design-notes.md`). Verified in Jest and in a browser via Playwright at iPhone size;
  **never yet run on a physical phone**: do that first (gestures, SVG performance on a small phone).
- Bundle ID `com.crownsofeurope.app` is a placeholder. No EAS config yet.

## Next tasks
1. Device test (iPhone SE size and a mid-range Android): pinch focal point, pan inertia, tap accuracy on small
   regions (Calais, Constantinople, Zealand), frame rate at 4× with many armies.
2. Balance over full campaigns with `npm run soak -- 300 <seed>` (prints the New World too): AI expansion pace,
   coalition frequency, late-game gold (development costs), Ottoman and French strength, and the colonial race
   (colonist sources in `colonies.ts`, settler numbers in `settlerGrowth`). The AI rarely builds transports, so it
   fights overseas with troops raised in its colonies (`musterRegion` in ai.ts).
3. Audio: a few period tracks and battle/UI sounds (expo-audio), with a mute switch in Settings.
4. Store prep: icon review, screenshots (`SHOT_W=430 SHOT_H=932 npm run screens`), EAS build profiles.
