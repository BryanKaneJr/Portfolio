# CLAUDE.md — Crowns of Europe

Handoff notes for Claude Code. Read this first, then `README.md`, `AGENTS.md` (Expo SDK rules),
`docs/design-notes.md` (decisions that override the original design doc) and `docs/content-guide.md`.

## What this is
A portrait-only, offline, pay-once grand strategy game (Europe, the Middle East, West Africa and the eastern
Americas, 1444–1750; every one of its 73 nations playable, and 28 greater crowns to proclaim) for iOS and
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
- **Original text only.** No other game's wording, art or mechanic names. Free art under an open licence is fine
  with credit: the emblems are game-icons.net glyphs (CC BY 3.0, Lorc and Delapouite), listed in
  `scripts/build-icons.ts` and credited in the README and Settings > About; add any new one there and run
  `npm run icons:build` (never hand-edit `ui/components/gameIcons.ts`). The towns are rendered from CC0 3D models
  (KayKit) by `npm run models:build` (credits in `assets/units/CREDITS.md`); the troop and ship drawings in
  `art/troops` and `art/ships` and the mountain drawings in `art/mountains` were made for the game by its owner.
  Player-facing text says prosperity, levies, order, renown, leverage, army limit, integrated and exports (alongside Threat, Claim, Era, coalition,
  colonists, war exhaustion, policy and mission); the code keeps the old names (`dev`, `manpower`, `stability`,
  `prestige`...). `scripts/check-terms.ts` (in `npm run validate`) enforces it; the glossary is in
  `docs/content-guide.md` and the in-game one in `ui/game/Help.tsx`.
- **Every number is explainable, but quietly.** If you add a number to the UI, make it tappable for its breakdown
  (`Stat`/`Line` `onPress`: opinion, unrest, income, renown...) or put the why behind a "?" (`help` on `Sheet`,
  `Panel`, `Section` or `Line`; `HelpButton`/`HelpNote` in `components/kit.tsx`). Screens say what things are and
  what you can do, in a few words; never explain a rule inline, and don't restate what a number or button
  already shows. Long-form teaching lives in How to play and the one-time hints.
- **Offline.** No network calls anywhere in `src/`.
- The map is generated: edit `src/content/regions.json` / `seas.json` (seeds, each region's chief `town` and its real
  [lon, lat], rivers, straits, lakes, the names of the lands beyond the map), then `npm run map:build` and
  `npm run relief:build`. Never hand-edit `map.json`,
  `assets/map/`, `assets/units/`, `ui/map/reliefTiles.ts`, `ui/map/terrainSymbols.ts`, `ui/map/unitArt.ts`,
  `ui/map/paintingTiles.ts`, `ui/map/terrainTiles.ts` or `ui/map/terrainVectors.ts`. The builder warns about seeds in the water;
  fix those. It also lists every town it had to nudge inside its region (coastal towns on a coarse coast: a few
  units); a big move means a wrong coordinate or a town in the wrong region.
- **Science gates progress.** Artillery, galleons, colonies (Caravels for the African coast, Ocean Navigation for
  expeditions and the New World) and the troops' age (`nat.era`, raised by the war advances) come from advances
  (`science.ts`, `advances.json`). Gate new unlocks with `hasAdvance`/`unlocked()`, never with the year.
- **Uncolonized land has `owner: null`** (and `controller: null`). Anything that loops over all regions must skip
  it (`if (!r.owner) continue`) or use `ownedRegions()`. Use `isIn(list, r.owner)` from `util.ts` for
  "is this region's owner one of these nations". Before discovery, `charted()` (colonies.ts) closes the New World
  to armies, fleets and colonists, and the map draws it as blank parchment.

## Layout
```
src/sim/       types, content (JSON loaders + movement graph), state (new game), tick (daily/monthly), commands,
               military (paths, convoys, movement, supply), battle, forecast (how a battle would go, for the AI), siege,
               navy, war (war score, peace, ultimatums), diplomacy
               (opinion, actions), ties (everything between a crown and the others, for the Diplomacy tab), crowns
               (greater crowns: who may proclaim, proclaiming, the AI's every January), goals (the next goals strip),
               threat (coalitions), economy, colonies (discovery, colonists, settlers, natives,
               trade goods), science (science a month, advances, costs, research), events (DSL eval), dsl (schema),
               missions, aims (what each AI crown wants: historical aims, mission goals, bonds), rulers, religion
               (Reformation, Papal Favor, HRE), rebels, territory, ai (incl. the war chance, `warOdds`), queries, util,
               log (incl. `moment()`: the triumph cards and banners). A proclaimed crown keeps its nation id and changes
               only how it shows: always read names, adjectives, colours and arms through `nationName`, `nationAdj`,
               `nationFlag`, `displayOf` (content.ts), never `NATION[x].name/.adj/.color/.flag`
src/content/   regions, seas (+straits, rivers, wastelands, lakes), nations, scenario1444, traits, policies, units,
               names (incl. general names by culture and regnal seeds), events-historical, events-generic,
               events-newworld, events-history-{west,iberia-italy,empire-north,east-balkans,levant-africa-americas}
               (the history cards of fun batch 1), formables (the 28 greater crowns), missions, achievements, advances
               (science), aims (historical aims and old friendships/enmities), map.json (generated)
src/app/       _layout, index (title), new-game (nation picker), game, +not-found
src/ui/        map/ (MapView, styles, camera, colors, geometry, tap, MiniMap, reliefTiles, terrain, terrainSymbols,
               terrainLayer + terrainCache + terrainTiles + terrainVectors: the Illustrated style's tiles), game/ (Bars, Outliner, Sheet, RegionSheet,
               ColonySheets, UnitSheets, NationSheet, Cards, Panels, WarScreen, Menu, Science, Help), components/ (kit,
               Glass, Flag, BurningShield, Icon, gameIcons), layout, describe
               (plain-English effects and goals), theme
src/state/     store (game loop, selection, overlays, toasts, moments, play-test hook on window.__coe), speed (1x-8x;
               8x only at peace), storage (saves; one autosave per campaign)
scripts/       build-map, build-relief, build-terrain (both on lib/geo), build-icons, build-models, build-units, validate-content, make-icons, screens + screens-war + screens-newworld + screens-terrain (Playwright), serve,
               dev/ (soak, trace, ottomans, powers, aiwars, colonies, opening, crowns, warchance, playall, pan-layers,
               nation-colors), lib/ (geo, nationColors), terrain/ (the
               Illustrated style's offline tile pipeline, Python)
tests/         battle, movement, siege, war, colonies, aims, science, ottomans, greatpowers, map, terrain, events, pause,
               amounts (effects as shown), soak (Jest, node)
art/           source art the builders read: mountains/ (the owner's ink drawings of ranges), troops/ and ships/
               (the owner's soldiers and ships), painting/ (the owner's painting of the world; the 157 MB original is
               not in git)
assets/        map/ (generated pictures, incl. mountains/), units/ (the troops, ships, towns), fonts, icons
```

## Commands
```
npm install
npx expo start              # Expo Go / simulators;  npx expo start --web for the browser
npm run check               # typecheck + lint + validate + tests. Run before calling anything done
npm run screens             # web export + Playwright walkthroughs → screens/ (look at them after UI changes)
npm run soak -- 40 3        # AI-only game for 40 years, seed 3
npx tsx scripts/dev/trace.ts TUR 10 1   # follow one nation through an AI game
npx tsx scripts/dev/ottomans.ts 260 1 2 # Ottoman wars, size, troops' age vs Europe's, per seed
npx tsx scripts/dev/powers.ts 256 FRA,HAB 1 2  # who takes a crown's land; great powers' size and age
npx tsx scripts/dev/aiwars.ts 256 1 2     # AI wars per decade, battles attackers lost, generals in the field
npx tsx scripts/dev/colonies.ts 306 1 2   # the colonial race: free land left, first colonies, colonists busy, raids
npx tsx scripts/dev/opening.ts 1 24 1450   # does Constantinople fall in the opening war, seed by seed
npx tsx scripts/dev/nation-colors.ts      # the realms' map colours: closest pairs (--write picks new ones)
npm run map:build           # after editing regions.json / seas.json
npm run icons:build         # after adding an emblem to scripts/build-icons.ts (fetches game-icons.net once into
                            # scripts/data/game-icons, git-ignored)
npm run relief:build        # then: relief, land colour, water lines and the known world's shadows
                            # (assets/map/; fetches elevation and Blue Marble tiles once into
                            # scripts/data/terrain-cache, git-ignored)
npm run terrain:build       # then: the drawn terrain (ui/map/terrainSymbols.ts, assets/map/mountains) from the
                            # same cache and art/mountains
npm run painting:build      # the Painted style's ground: art/painting/fullmap.png (not in git) fitted to the coasts
                            # and tiled into assets/map/painting (see art/painting/README.md)
npm run units:build         # the armies' and fleets' figures (assets/units/, ui/map/unitArt.ts) from art/troops
                            # and art/ships
npm run models:build        # the towns (assets/units/town-*.png) from CC0 3D models (fetched once into
                            # scripts/data/models, git-ignored), rendered with three.js in headless Chromium
npm run tiles:build         # the Illustrated style's terrain tiles and river/lake vectors (assets/map/terrain,
                            # ui/map/terrainTiles.ts, terrainVectors.ts) from ETOPO 2022, ESA WorldCover and Natural
                            # Earth; Python + GDAL, see scripts/terrain/README.md
npm run tiles:verify        # determinism, tile joins, coastline agreement, detail per level → docs/terrain/
npm run screens:terrain     # before/after screenshots, a tap test and frame/memory numbers → docs/terrain/
```
Expo 57 is newer than most training data: follow `AGENTS.md` (check versioned docs; `npx expo install` for
native deps). Reanimated 4 shared values use `.get()`/`.set()` (the React Compiler lint rejects `.value =`).

## Map rendering
The map is Mercator, 2575 × 2242 units (17.4 units per degree of longitude; Europe is the top-right corner).
`MapView` keeps a camera `{cx, cy, k}` in React state. During a gesture the last rendered SVG is moved with a
native transform (Reanimated); on release the SVG re-renders at the new camera (crisp at any zoom). The SVG is
rendered 1.6× the screen size so short pans never show an edge. Units are little figures standing in their own shadow
(baked from each drawing by `npm run units:build`) under the realm's banner (its flag, `flagBody`, on a pole), the
count on a badge beside it (gold-rimmed for your own): an army is
one of the owner's drawings (`art/troops`: a lone soldier for a small army, a squad of four or five for bigger ones,
`troopArt`), a fleet one of their ships (`art/ships`: a lone ship, or several from 5 ships, `shipArt`); all drawn in
one SVG on top. Each owned region's chief town stands at its real place (`MAP_REGION[id].town`, from `town` in
`regions.json`, projected by `build-map` and nudged inside the region where the coast is coarse), drawn in the map's
own SVG just under the names (so under the units too): a village, a town or a city by the region's prosperity (below
`TOWN_DEV`, below `CITY_DEV`, then cities), inside walls where it has a fort (`townArt`, `TOWN_ART`; `npm run
models:build`). They show from `REGION_NAMES_K`, in every owned region, even one too small for its name to be
written (Constantinople, Genoa, the Atlantic islands); in a small region the picture is capped to about the region's
size (`townSize`: `TOWN_FIT` times its label radius on screen, at least `TOWN_MIN` points), so an island gets a small
mark rather than being buried. They stand on their point (the middle of the settlement), never move, and are not tap
targets. Taps on a unit are
measured from the middle of its figure (`TOKEN_MIDDLE`), above its point. Only the units the player would know about are drawn, at any zoom, and listed in region sheets
(`seesUnit` in `sim/queries.ts`): their own, their allies', overlord's and subjects', their enemies' in a war, and
anyone's in land they own or hold; rebels risen against them.
Zoomed out (k below `UNITS_K`, where the nation names show) the map is for the realms: no units except a selected
one; from `REGION_NAMES_K` on, region names replace the nation names and each army stands just under its region's
name (`armyAnchor`), its token a little smaller until `PLAY_K` (1.7), the zoom the game opens at and "show on map"
goes to. Taps are
hit-tested in map units (`ui/map/tap.ts`): your own units first, then regions, then seas. Strokes and text sizes
are divided by `k` so they stay constant on screen; past `PLAY_K` names, towns and unit tokens grow partway with the
zoom (`grow`, `ZOOM_GROW`: about 1.6x at the closest), so they stay easy to read and find. A gesture may pull past the edge of the known world or the
zoom limits against growing resistance, then slides back (`ui/map/camera.ts`, `settle` in MapView).

How it is painted comes from a style (`ui/map/styles.ts`: Illustrated, the default; Painted; Atlas; Parchment; Flat),
chosen in Settings or the map-mode menu and saved as a preference. Illustrated is Atlas with an illustrated atlas
under the realms' colours over the whole known Old World (`TERRAIN_REGION`; the New World keeps Atlas): tiles drawn
offline by `scripts/terrain` from real elevation, land cover and rivers onto the game's own coastline, in five levels
(1–16 px per map unit, 512 px tiles, a quadtree from map (0, 0)), made only where they show known land (open sea and
the parchment of the unknown are the style's own; the finest level skips the giant northern regions, West Africa and
the islands, `TERRAIN_FINEST_SKIP`). `ui/map/terrainLayer.ts` picks the level the zoom needs (the coarsest under the
whole drawn area, the next finer ones over the screen plus a buffer, fading in; a coarser tile is hidden only where
its children all exist, `full`), `terrainCache.ts` keeps them warm (LRU). Its mountains are the owner's drawings
(the Atlas style's, `art/mountains`), not part of the tiles, and used sparingly: only over the famous ranges
(`FAMOUS_RANGES`), only their larger drawings, small and steady on screen (`famousMountains`, `MOUNTAIN_PT`: none far
out, the lesser ones give way to region names). Natural Earth
rivers and lakes (plus ESA WorldCover's small lakes) are
drawn as vectors on top: lakes filled over the realms' colours, the great rivers (`GREAT_RIVER`) in a darker ink than the
rest, all capped thinner far out and the minor ones faded. Inside the
region Atlas's own land overlays and drawn terrain are cut away (`tOut`); the tiles' sea fades into the style's sea at
the region's edge (keep `sea` and `relief` in step with `EDGE_MATCH` in `scripts/terrain/config.py`; a test checks).
Its borders between realms carry a faint light casing (`nationBorder.halo`) so they hold against the drawn terrain;
zoomed out they thin a little and the casing fades (`borderEase`, `casingEase`). `terrain.shore` darkens the
water along every coast: the coastline stroked, cut to the water. Its sea is darkened over deep water only
(`TERRAIN_SEA_SHADE`, the same shading the tiles are painted with). On the web the moving map view has its own
compositor layer (`WEB_LAYER`), so a pan never repaints the SVG; `scripts/dev/pan-layers.mjs` measures what each
layer costs.
See `docs/terrain/`. Painted lays the realms' colours (translucent) over the
owner's painting of the world (`art/painting`, fitted to the coasts and tiled by `npm run painting:build` into
`assets/map/painting` + `ui/map/paintingTiles.ts`: three levels, the coarsest always under the finest the zoom
needs); past the edges, the wastes and the uncharted New World are veiled, not covered, and the sea zones are cut to
the water. The rest of this paragraph is the other styles. The known world lies on blank parchment: everything past
the play window, the wastes, the waters no fleet sails plus a ragged band of open sea along the window's edges
(`MAP.unknownWater`), and before discovery the New World (`MAP.uncharted`). Bottom to top: sea, sea depth (baked,
black or white with alpha), baked water lines (Parchment), sea zones, regions (one path per colour), then cut to the
regions' own outline (a clip path, so coasts stay crisp at any zoom; the baked pictures reach a few pixels past the
coast): the land-colour image (Atlas: NASA's Blue Marble evened out, so each country takes on its land's greens,
tans and texture; soft again close up), hill shading, and a grain tile drawn the same size on screen at any zoom;
then the drawn terrain (`ui/map/terrain.ts`, placed from real elevation and land colour by
`scripts/build-terrain.ts`): the mountain ranges as the owner's ink drawings (`art/mountains`, baked so the ink
darkens the land and the country's colour shows through), laid along each range by the way it runs and how wide it
is, then trees, dunes and reeds as vector marks; fading in as you zoom in while the hill shading gives way to it;
then
occupation stripes, the parchment over the unknown, the known world's baked shadow on it, province lines
(fading out as you zoom out), rivers, nation borders, a fade into parchment along the window's edges, every
coastline (known or not, one ink, culled by cell), selection, the towns, then names (nation names curved along `nationArcs` with a drop shadow, region names when zoomed in). Keep each
redraw cheap: whole-map lines are single paths, and anything that would mean stroking every coastline several
times (water lines, shadows) is baked into an image by `scripts/build-relief.ts`. Keep every baked picture under
5.2 megapixels: iPhone and iPad web views decode anything bigger at half size. The drawn outlines (region paths,
borders, coasts) are rounded off by `build-map` from the same arcs, while everything the game reads (neighbours,
coasts on each sea, areas, labels) comes from the unrounded ones. The closest zoom is `K_MAX` (5) in `camera.ts`.

## Interface
"Gilded glass" (`ui/theme.ts`): a dark interface with gilt accents and heraldry, built like a phone app. Use the `G`
tokens (the old `C` names still work and map onto them); gold is the one tint and marks what you can act on, green
and red only mean good and bad. `display` (Cinzel, bundled) is for titles and section heads: never add a
`fontWeight` to it (the file is already the bold cut; the web would fake a heavier one); body text is the system
face; event stories use `book` (IM Fell). Anything floating over the map is `Glass` (blur + dark tint + hairline,
`gilt` for a gilded rim); nations show as `Shield` (their arms on a heraldic shield) in headers and the top bar.
`Icon` draws the game's emblems (resources, war, the realm, event pictures) from game-icons.net and the plain
controls (play, close, menu...) as simple line icons.
The game screen: the map fills the screen; the top bar (arms, resources, messages), the side rail (outliner, map
lens; their panels open beside it), the war rail on the left (each enemy's arms on fire, `BurningShield`; tap for
the war screen, `game/WarScreen.tsx`), the dock (time, and the realm's pages as a tab bar) float over it; sheets
(`game/Sheet.tsx`: inset glass, grab handle, drag to resize or dismiss) rest just above the dock so time stays in
reach (armies and fleets open compact so the land around a selected army stays tappable; selecting never moves the
map, at the owner's request: only a drag, a pinch, "Show on map" or the outliner does; `ui/layout.ts` holds the
shared sizes); full-screen pages use `Panel` (close button, title in capitals, a gilt rule) and hide the floating
controls; cards (events, offers, battles, moments) sit on glass over the dimmed map. Event cards come up on their own
(and block time until answered), and so do triumph cards for what the player caused or leads (a peace, a mission
claimed, an achievement, a crown proclaimed, a union), grouped into one card per batch (`MomentCard`); every other
moment is a non-pausing banner; the clock stops for what `settings.autoPause` asks (by default events, a war on you,
an ally under attack calling you to arms, an ultimatum, the end: `DEFAULT_AUTOPAUSE`; `offerPause` sorts the offers).
An offer the player pauses for opens its card (more than one at a time wait their turn, `queuedOffers`); other offers
and battle results drop in as notices (a toast with an `action`, `store.notify`; a notice goes when its offer does,
and one tapped too late only says so) and wait under the bell (Messages: offers at the top, with what letting one lapse
means: an unanswered call to arms is a refusal). Their cards open as overlays (`offer`, `report`, with `back` to the
page they came from) and close themselves when what they show is gone. Offers wait while time runs, so a crown that
goes to war with the player withdraws its other offers (`withdrawEnemyOffers`) and `answerOffer` re-checks them.
Event cards and mission rewards show each amount after the effects before it (`walkEffects` applies them in order to
a copy). Keep the walkthroughs' test IDs.

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
