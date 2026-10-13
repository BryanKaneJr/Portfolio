# Illustrated terrain

This replaces the map's low-resolution ground with an illustrated atlas drawn from real geographic data in the game's
own coordinates. It began as a prototype over central and eastern Europe (rounds 1 and 2) and since round 3 covers the
whole known Old World: Europe, North Africa, the Middle East, West Africa and the Atlantic islands (the New World keeps
the Atlas style). It renders inside the real game as the default map style, "Illustrated". Political colours, borders,
selection, labels, units and every game system are unchanged.

| Document | What it is |
| --- | --- |
| [ARCHITECTURE-AUDIT.md](ARCHITECTURE-AUDIT.md) | How the map renders today, the coordinate system, which assets lose resolution, and the engine decision |
| [../../scripts/terrain/README.md](../../scripts/terrain/README.md) | The offline pipeline: setup, steps, coordinates, levels, data sources and licences |
| [WORLD-SCALING-PLAN.md](WORLD-SCALING-PLAN.md) | Taking it from one region to the whole map: sizes, options, order of work (the Old World is done) |
| [verification.json](verification.json) | Measured checks of the tiles: determinism, joins, coastline, detail per level |
| [perf.json](perf.json) | In-game measurements in headless Chromium: re-render time, frame times, tiles, decoded memory, JS heap |
| [screens/](screens/) | Before (Atlas) and after (Illustrated) screenshots of ten views: five zooms, the Adriatic coast, the region's edge, and the tap test |

## How it works

```
 offline (scripts/terrain, Python + GDAL)                                     in the app (src/ui/map)
 ───────────────────────────────────────────                                  ─────────────────────────────────────
 fetch.py    ETOPO 2022 15″ (windowed), WorldCover (1/16 COG overview),
             Natural Earth 10m  → scripts/data/terrain-src (git-ignored)
 prepare.py  warp all onto ONE grid in map units (16 px/unit),
             + the game's own land outline rasterised (authoritative)
 render.py   5 levels × 512 px JPEG tiles (L0 1 px/unit … L4 16 px/unit)  →  terrainTiles.ts (index, require per tile)
             relief, land cover colours, trees                                  terrainLayer.ts: level choice, culling,
             in real forests, marsh, grass, water, coastal ripples                buffer, crossfade
 vectors.py  Natural Earth rivers + lakes, cut to the game's coast        →  terrainVectors.ts: drawn as SVG paths,
                                                                                 filtered by importance per zoom
 verify.py   determinism, joins, coast agreement, detail per level            terrainCache.ts: LRU prefetch/evict
```

- **One coordinate system.** The game's map is spherical Mercator, and its map units are an exact affine transform of
  EPSG:3857 metres. GDAL warps every source straight onto map units: no control points, no estimated alignment.
  `tests/terrain.test.ts` checks pyproj's projection of sample points against the game's own formula.
- **The game's coastline is the authority.** Land and sea in the tiles come from the game's own region outlines,
  rasterised 4×4-supersampled. Elevation only shades the relief and never moves a coast. The terrain is painted to the
  game's map, never the other way round.
- **Nothing political is baked in.** The tiles hold terrain only. Country colours are drawn over them at 50%. Borders,
  names, selection, units and the fog of the unknown are drawn by the existing SVG layers as before.
- **Real detail per level.** Every level is drawn from the data at its own resolution:
  - relief from elevation averaged to the level's pixels
  - trees on a lattice of fixed pixel spacing

  (Mountains are not in the tiles: the app draws the owner's drawings over the famous ranges; see round 3.)

  So a finer level has more and smaller real features. `verify.py` measures this.
- **Runtime.** The tiles are `<Image>` elements in the same SVG and the same viewBox as the political layers, so they
  are aligned by construction.
  - The coarsest level lies under the whole drawn area.
  - The level the zoom and the screen's pixel density need, and the one below it, lie over the screen plus a 15% buffer.
  - The finer one fades in as you zoom.
  - Neighbouring tiles overlap by 0.6 screen points so no hairline shows.
  - An LRU cache of 160 tiles prefetches the ring around the view and the next level.

  Nothing is generated on the phone, and nothing is downloaded: every tile is bundled.

## Results

### What works, and how it was checked

| Claim | Evidence |
| --- | --- |
| The pipeline runs end to end, offline from the app | `fetch → prepare → render → vectors → verify` ran on this machine. `sources.json` records every source tile's URL and SHA-256. The whole Old World: prepare 18.5 min (40 chunks), render 5 min 41 s with four workers (L0 5 s, L1 9 s, L2 25 s, L3 80 s, L4 197 s), vectors 70 s. |
| 1,239 tiles in 5 levels, 59.4 MB, bundled | `assets/map/terrain/L0…L4` (12 / 35 / 102 / 339 / 751 tiles, only where they show known land); `src/ui/map/terrainTiles.ts` (generated index). |
| One coordinate system, no estimated alignment | `tests/terrain.test.ts` projects sample points with pyproj (EPSG:4326 → 3857 → map units) and checks them against the game's own formula: equal to 6 decimal places. |
| The tiles follow the game's coastline | The land/sea painted in the L4 tiles was read back and compared with the game's outline within 3 map units of the coast, over central Europe (the same box every round; 7.5 M pixels). 73 k pixels disagree. Nearly all are either the coast pixel itself (20 k, anti-aliased) or lakes, lagoons and wide rivers deliberately painted on the game's land (53 k). That leaves **172 pixels unexplained (0.002 %)**: 171 are game land painted as water, a median of 1.4 units from the coast, and 1 is game sea painted as land. Symbols are cut to the game's land, so nothing spills over a coast. |
| No seams between tiles | At every tile edge of L0–L1, and at a sample of 24 edges of L2 and 12 each of L3 and L4, the colour step across the edge was compared with the step at the same line in a render that has no edge there. The tiles add **1.0–1.9 grey levels** on average (at most 4.6, out of 255): JPEG noise. Against the steps across 8 px JPEG blocks inside tiles the ratio is 1.03–1.08 for L2–L4 (higher at L0–L1, 1.3–1.7, because the sea inside a tile is now perfectly flat). |
| Deterministic, so rebuilds and neighbours agree | Drawing two level 2 blocks again, as `render.py` draws them, gives byte-identical tiles (32/32). Two overlapping boxes drawn at different offsets place every symbol identically. Their pixels differ on 80 of 262,144 pixels (0.03 %): isolated edge pixels that Skia anti-aliases a little differently on a surface of another size. |
| Each zoom level adds real detail, not magnification | The fine detail (Laplacian energy) of each level against the level above it magnified ×2 over the same ground: **10–58×** more (paper grain alone is under 1 % of that). Real features in a 32 × 32-unit box of the Swiss plateau and Prealps (`alps` in `verification.json`), by level L1–L4: 2 → 51 → 189 → 769 symbols (peaks 2 → 2 → 7 → 26), plus hachures 6 → 20 → 76 → 339. The Carpathians: 2 → 112 → 309 → 1,064. These are round 2's thinner counts; round 1's are in the round 2 section below. |
| No magnification at the closest zoom | L4 is 16 px per map unit; the closest zoom (K_MAX = 5) on a 3× screen needs 15. Level choice allows at most 1/0.85 = 1.18× while a finer level fades in (tested). |
| Political state, borders, labels, units, selection are unchanged | They are drawn by the same SVG layers on top of the tiles. Tapping Bavaria in the illustrated region selects Bavaria (`perf.json`). The main, war and New World walkthroughs pass with no page errors. |
| Tests and checks | `npm run check` passes: typecheck, lint, content validation, and 79 Jest tests in 13 suites, 14 of them for the tile layer. |

### In the game (headless Chromium, 390 × 844 points at 3×; a browser is not a phone)

| View | k | Level drawn | Tiles drawn | Decoded tile memory | Redraw after a camera move, Atlas → Illustrated (unthrottled; CPU 4× slower) |
| --- | --- | --- | --- | --- | --- |
| europe | 0.45 | L1 | 46 | 35.3 MB | 31 → 32 ms; 120 → 159 ms |
| region | 0.9 | L2 | 88 | 84.4 MB | 176 → 108 ms; 340 → 425 ms |
| alps-play | 1.7 | L3 | 99 | 98.5 MB | 41 → 37 ms; 255 → 334 ms |
| carpathians-play | 1.7 | L3 | 89 | 88.5 MB | 39 → 63 ms; 243 → 420 ms |
| danube-play | 1.7 | L3 | 90 | 89.5 MB | 60 → 36 ms; 247 → 360 ms |
| alps-close | 3.2 | L4 | 102 | 102 MB | 66 → 33 ms; 173 → 149 ms |
| alps-max | 5 | L4 | 48 | 48 MB | 27 → 33 ms; 115 → 129 ms |
| adriatic-play | 1.7 | L3 | 93 | 93 MB | 41 → 53 ms; 201 → 333 ms |
| dalmatia-close | 3.2 | L4 | 106 | 106 MB | 23 → 32 ms; 138 → 146 ms |
| region-edge-west (France; no edge since round 3) | 1.7 | L3 | 95 | 94.8 MB | 49 → 46 ms; 147 → 352 ms |

These are round 3's, with the whole Old World covered and the woods not yet reworked.

- **Panning** at play zoom: a two-second drag, twice per style. The camera moved 101 × 67 map units in every run.
  - Unthrottled: both styles had median 16.7 ms, p95 16.7–16.8 ms and worst 16.8 ms, with no long task. The redraw on
    release was under 50 ms every time.
  - CPU 4× slower, Illustrated: median 16.7 ms, worst 83.4 ms (one long task in one drag). The redraw on release took
    240 ms and 185 ms.
  - CPU 4× slower, Atlas: median 16.7 ms, worst 100 ms (one long task in one drag). The redraw on release took 262 ms
    and 189 ms.

  During a drag only a transform moves, so frames hold 60 fps. On the web the moving view is its own compositor layer
  (round 2). When the finger lifts, the map is drawn again. With the tiles, the redraw at 4× slowdown is now often
  100–170 ms slower than Atlas's at play zoom (about 90 tiles drawn, against 59–64 in round 2's central region). That
  redraw is how the game's renderer already works.
- **Redraw times** run from the camera change to two animation frames later, so they include up to about 33 ms of
  waiting for frames. Each is a single sample, and at 4× slowdown they vary by ±100 ms or more from run to run.
- **JS heap:** 23.5–55.6 MB in both styles. Images are decoded outside the JS heap. Their memory is the "decoded tile
  memory" column, computed from the tiles drawn.
- **Decoded tile memory** is 89–99 MB at play zoom, where two levels cover the screen, and 48–106 MB close up.
- **Raw data:** `perf.json`. Screenshots of every view before and after: `screens/compare-*.jpg`.

### What is incomplete or open

- **Not measured on a phone.** All the performance numbers come from desktop Chromium, with the CPU slowed 4× as a rough
  stand-in for a mid-range phone. Frame rate, memory and image decoding in react-native-svg on iOS and Android are
  still to be measured. That is the next step, and the plan says how.
- **The New World keeps the Atlas style.** The Old World is covered (round 3), so no edge of the terrain shows on land
  there; the Americas lie across the ocean and are drawn as before.
- **Elevation is interpolated at the finest level.** ETOPO 2022 15″ has about 10–14 samples per map unit here, and L4
  draws 16 px per unit. Relief at L4 is therefore 1.2–1.6× interpolated (cubic, then smoothed). Land cover, symbols,
  coasts and rivers are true to L4.
- **Memory is managed loosely on native.** The LRU cache decides which tiles to prefetch, but on iOS and Android
  `Image.prefetch` gives no handle to free, so the platform's image cache decides what stays decoded. The decoded
  memory of the tiles on screen is measured below; the native cache's total is not.
- **Scenery lakes.** Natural Earth lakes (Balaton, Constance, Geneva…) are painted inside game regions, where armies
  march. They are scenery: the game's own geometry has no European lakes.
- **Rivers armies cross.** Inside the region, the gameplay river strokes along borders give way to the real river
  courses, so the Danube shows once. The rule is unchanged, but the border itself is no longer marked as a river line
  there.
- **No landmarks yet.** The visual direction mentions occasional landmarks; none are drawn.
- **Small things the round 2 reviewers saw and left.** None of them stops the owner's three requests:
  - Province lines inside one realm have no casing, so at play zoom they are the weakest lines in the Alps. They are
    still darker than in round 1.
  - Under Switzerland's red, a few small lakes painted in the tiles but too small for the vector lakes show as faint
    lilac traces at the closest zoom.
  - Some of WorldCover's smallest lakes show as specks close up, for example two beside Lake Balaton's west end.
  - The Bernese Oberland, beside the Swiss army's token, keeps only one or two peaks under its snow tint at the
    closest zoom.
  - The Po keeps its tight bends between Piacenza and Cremona. They are real meanders, drawn as Natural Earth has
    them.
- **The Painted style still exists** as an option in Settings, alongside Atlas, Parchment and Flat.

## Round 2: the owner's review

After round 1 the owner asked for three changes:
1. Less small terrain close up: about 25–35% fewer features, most of all in mountain provinces.
2. Political borders with more authority over the textured terrain.
3. Water set further apart from the colours of coastal territories: a little deeper, or a subtle darkening along the
   coasts, without going back to the old navy.

All three were made. Eight independent reviewers then checked the result: an art reviewer and a QA reviewer for each of
density, borders, water and regressions elsewhere. Their findings were fixed, and four more reviewers checked the fixes.
A last pass fixed what that second review still found:
- a faint seam in the North Sea where the tiles' sea met the style's sea;
- rivers too heavy when zoomed out;
- a smudged shoreline along Sweden's fjords when zoomed out;
- minor rivers that looked like province lines;
- small lakes that read as lilac under some realms' colours;
- a coarse Danube.

A final check by four more reviewers confirmed all three requests. It found that the far-zoom river fix had gone too far:
every river had taken the minor rivers' light ink and faded, so the Danube nearly vanished over Europe. Now the great
rivers keep their darker ink at every zoom, at about round 1's weight far out.

Round 1's screenshots are in git history (commit `5cfa1b23`); `screens/` holds round 2's.

### 1. Less terrain close up

Marks in four fixed boxes, round 1 → round 2. The counts come from the renderer's own `symbols()`, run once with each
round's settings.
- **Symbols** are peaks, hills, trees, grass and marsh.
- **Hachures** are the short slope strokes.
- **Peaks** are mountains and hills (part of the symbols).
- **All** is symbols and hachures together.

L3 is the level drawn at play zoom (k = 1.7). L4 is drawn close up (k ≥ 3.2).

| Box | L3 symbols | L3 hachures | L3 peaks | L3 all | L4 symbols | L4 hachures | L4 peaks | L4 all |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Swiss plateau, Lake Constance and Prealps | 314 → 189 (−40%) | 107 → 76 (−29%) | 11 → 7 | −37% | 1,295 → 769 (−41%) | 544 → 339 (−38%) | 43 → 26 | −40% |
| Switzerland and Lombardy | 1,413 → 711 (−50%) | 2,660 → 1,600 (−40%) | 58 → 33 | −43% | 5,439 → 2,619 (−52%) | 11,311 → 6,329 (−44%) | 254 → 136 | −47% |
| Carpathians | 547 → 309 (−44%) | 192 → 127 (−34%) | 18 → 14 | −41% | 2,007 → 1,064 (−47%) | 1,056 → 676 (−36%) | 68 → 50 | −43% |
| Transdanubia (around Lake Balaton) | 242 → 159 (−34%) | 1 → 0 | 5 → 4 | −35% | 940 → 632 (−33%) | 5 → 1 | 10 → 10 | −33% |

The boxes, in map units:
- Swiss plateau, Lake Constance and Prealps: (1888, 832)–(1920, 864), inside the next box
- Switzerland and Lombardy: (1880, 835)–(1945, 900)
- Carpathians: (2160, 832)–(2192, 864)
- Transdanubia: (2048, 864)–(2080, 896)

How the marks were cut, all in `scripts/terrain/render.py` (one number per level):
- **Spacing.** Trees and hachures stand farther apart at L3 and L4 (`SPREAD`). Higher up a mountain they are thinned
  further (`HIGH_THIN`, `HIGH_THIN_HACH`), because that is where they piled up.
- **Peaks.** Summits are looked for in a wider window and kept a minimum distance apart (`PEAK_WIN`, `PEAK_GAP`), so a
  crest reads as a few clear peaks instead of a crowd.
- **No trees on peaks.** No tree is drawn inside a peak's drawing.
- **Farmland.** A lone tree needs a little more forest under it close up (`TREE_FROM`), which thins the trees
  scattered over farmland.
- **Shading.** Above 1,000 m the relief shading is calmer close up (`CALM_HIGH`), so the shaded slopes don't compete
  with the peaks.
- **Rivers** (`scripts/terrain/vectors.py`, `MapView`):
  - Minor rivers shorter than 30 units are dropped, unless they run into a lake. So the Swiss lakes keep their rivers.
  - When zoomed out, the great rivers are capped thinner but keep their darker ink, and the minor rivers fade.
  - The great rivers are smoothed.

Transdanubia's open farmland lost 33–35% of its marks, and the Swiss plateau with its Prealps 37–40%. The mountains lost more than asked: 41–47% of all marks in the Swiss and Lombard Alps and the Carpathians. At about 35% the
reviewers still found the Swiss crest and the Savoy ridge running together. Giving the mountains some detail back is a
change to those numbers and a re-render of the tiles (about ten minutes).

### 2. Borders with more authority

| Line | Round 1 | Round 2 |
| --- | --- | --- |
| Between provinces | brown at 20%, 0.55 pt | dark sepia at 55%, 0.72 pt |
| Between realms | near-black at 62%, 0.95 pt, a faint dark halo | near-black at 82%, 1.1 pt, on a light parchment casing (3.2 pt at 38%) |
| Coast | 62%, 0.75 pt | 70%, 0.8 pt |

- **Casing.** The light casing is the subtle contrasting outline the owner suggested. It keeps a realm's border visible
  over dark forest and mountain ink.
- **Zoomed out.** The border and its casing ease off (`borderEase`, `casingEase` in `MapView`), so the whole of Europe
  doesn't turn into a net of black lines.
- **Rivers.** Rivers below the great ones (the Danube, Rhine, Po, Vistula...) are drawn in a lighter blue, so they
  don't read as province lines.

### 3. Water set apart

- **Colour.** The sea is `#87a6ba`. That is deeper and bluer than round 1's `#a1b5b5`, and well short of the older
  styles' dark seas: Painted's navy `#2b5a6b` and Atlas's slate `#3e5a6a`.
- **Deep water.** It is darkened a little more, by the same shading inside the tiles and outside them. So the
  region's edge doesn't show at sea.
  - The shading is `TERRAIN_SEA_SHADE`: `assets/map/terrain/sea-shade*.png`, written by `render.py`.
  - It is the game's baked sea depth (`relief-sea.png`) with only its darkening kept.
- **Coasts.** Every coast has a soft dark band in the water (`terrain.shore`): two strokes of the coastline, cut to the
  water. It outlines pale coastal realms.
  - The band is narrower when zoomed out.
  - Its wide outer stroke comes in only from k ≈ 0.8, so it doesn't smudge the fjords of Norway and Sweden.
- **Sea names** are darker: about 3:1 contrast over the deepest water and 4:1 on the shallows (round 1: about 2.3:1).
- **Lakes** read as water under any realm's colour:
  - a blue lake fill is drawn over the realms' colours;
  - small lakes mapped by ESA WorldCover are added to Natural Earth's, 506 lakes in all.
- **Separation**, measured by `scripts/terrain/coast_contrast.py` on the screenshots.
  - **Method.** The game's own coastline is rasterised into each shot. In 30 × 30 pt blocks along the coast, the
    median colour of the sea just off the coast is compared with the median colour of the land just inside it.
  - **Units.** CIELAB ΔE. Under about 10, the two read as close.

  | View | Round 1: median ΔE | Round 1: closest 10% | Round 1: blocks under 10 | Round 2: median ΔE | Round 2: closest 10% | Round 2: blocks under 10 |
  | --- | --- | --- | --- | --- | --- | --- |
  | alps-play (Venice, Romagna, Istria) | 21.3 | 9.1 | 14% | 23.7 | 16.9 | 0 |
  | danube-play (Dalmatia, Croatia) | 27.9 | 13.7 | 7% | 36.1 | 19.7 | 0 |
  | region (k 0.9: Adriatic, Baltic, Black Sea) | 23.1 | 10.1 | 10% | 31.4 | 18.7 | 0 |

  On the new Adriatic views the closest 10% sit at ΔE 17–19. The Atlas style's slate sea measures a median of 52 there,
  against the Illustrated style's 41.

### Performance after round 2

Panning a two-second drag at play zoom costs the same in both styles. In round 2 the first measurement with the new
casing and shore band showed 21% slow frames while dragging. On the web the moving map view now has its own compositor
layer (`WEB_LAYER` in `MapView`). A drag moves the map as it was already painted, instead of painting it again, and has
had no slow frames since. `scripts/dev/pan-layers.mjs` measures each layer's cost with and without it. The table above
and `perf.json` are round 2's.


## Round 3: features, not fill; the whole Old World

The owner, after round 2: "What's up with France being half filled with stuff? And I think you're in a loop of going
too crazy with the mountains. There's a ton that are too huge. And there's just way too many. It's a feature, not a
fill the map mentality."

### France: the terrain now covers the whole known Old World

France looked half filled because the prototype's tiles ended on a straight line at 2°E. East of it was the
illustrated terrain, west of it the plain Atlas style. The other edges cut Sweden, Livonia, Russia, Anatolia and Sicily
the same way. The terrain now covers every region of the Old World. A tile is made only where it shows the game's known
land, or the sea within reach of it. Open sea and the parchment over the wastes are the style's own, so every remaining
boundary lies at sea, under parchment or at the map's own edge.

- **Tiles:** 1,239 in all (12 / 35 / 102 / 339 / 751 per level).
  - The finest level skips 23 regions where nobody zooms right in: the giant northern and eastern regions, West Africa
    and the Atlantic islands (`TERRAIN_FINEST_SKIP`). Level 3 stands in there, up to 1.9× enlarged at the closest zoom.
  - The app hides a coarser tile only where all four of its children exist (`full`).
- **Size:** 59.4 MB of tiles with the trees as they are now (the woods are being reworked next; symbols are about 40%
  of a land tile's bytes). Rivers and lakes for the whole Old World: 954 KB of vectors, against 798 KB for central
  Europe before. Paths are now written as relative steps at 0.1-unit precision.
- **Sea:** painted without paper grain, exactly the app's own sea, so a tile left out over open sea shows no seam.
  What the parchment covers is painted plain, to keep bytes down.
- **Pipeline:**
  - Sources are fetched one file per source tile: 31 ETOPO and 451 WorldCover tiles.
  - `prepare.py` works in 256-unit chunks: 40 chunks in 18.5 minutes, writing coarser copies for the coarser levels.
    On the old region it reproduces the old grid exactly.
  - `render.py` draws in 2048-px blocks with four workers: the whole Old World in 5 minutes 41.
- **Memory:** a screen at play zoom now has tiles across its whole drawn area, which the old region's edges used to
  leave empty. Decoded tile memory there is 89–99 MB, against 53–65 MB before; at the closest zooms it is about the same
  (48–106 MB, against 47–101 MB). Easing the level switch (`SHARPNESS`) so play zoom draws one level instead of two would roughly halve
  it, at the cost of slightly softer terrain at k 1.6–1.8.

### Mountains: the owner's drawings, small, over the famous ranges only

A first pass replaced the dense glyphs with a ranked list of summits drawn as sprites. The owner then asked to go back
to their own shaded mountain drawings (`art/mountains`, the ones the Atlas style uses), smaller, and only in the famous
mountain areas. That is what the Illustrated style now draws:

- **The owner's drawings, placed as the Atlas style places them** (`MOUNTAINS` in `terrainSymbols.ts`, laid along each
  real range by `scripts/build-terrain.ts`). Nothing new is invented and nothing is baked into the tiles.
- **Only over six famous ranges** (`FAMOUS_RANGES` in `terrainLayer.ts`): the Alps, the Pyrenees, the Carpathians,
  the Apennines, the Scandinavian mountains and the Atlas. Elsewhere, high ground shows through the relief shading only.
- **Only the larger drawings** (`FAMOUS_MIN_W`, 18 units wide or more). No drawing sits on a bigger one, and the
  lesser ones give way to region names.
- **Small and steady on screen** (`famousMountains`, `MOUNTAIN_PT`): the widest is 32 pt at play zoom and grows only
  slowly as you zoom in (49 pt at the closest zoom). They fade in from k 0.6, so none show at the Europe zoom.
- The tiles still keep their trees off the main summits (`render.py` features()), so the drawings sit on open ground.
- The summit sprites and their generator are gone (`terrainPeaks.ts`, `assets/map/terrain/peaks`).

Size, ranges and how many to draw are three constants (`MOUNTAIN_PT`, `FAMOUS_RANGES`, `FAMOUS_MIN_W`); changing them
needs no rebuild of any tile.

Drawings on a phone screen (390 × 844 points):

| View | Drawings on screen | Width on screen | Summit sprites (first pass) | Round 2 |
| --- | --- | --- | --- | --- |
| Europe (k 0.45) | 0 | – | 0 | – |
| Region zoom (k 0.9) | 29 (at 75% opacity) | 12–25 pt | 25 | 69, plus 268 fainter |
| Alps, play zoom (alps-play) | 13 | 15–32 pt | 25 | 113, plus 255 fainter |
| Alps, close (alps-close) | 9 | 19–41 pt | 26 | 116, plus 394 fainter |
| Switzerland, closest zoom (alps-max) | 6 | 23–49 pt | 23 | 214 |
| Danube and Carpathians, play zoom | 9–13 | 15–32 pt | 39–41 | 159–174, plus 351–391 fainter |
| Pyrenees / Norway / Atlas, play zoom | 14 / 11 / 12 | 15–32 pt | – | (not covered) |
| France, play zoom | 7, all of them the western Alps' at the screen's east edge | 15–32 pt | 17 | (not covered) |

### Checks

- `npm run check` passes. New tests cover the sparse tiles (grid, no overlap, every region's land covered, the `full`
  flags), the finest level's skipped regions, and the mountains (famous ranges only, none far out, small and steady on
  screen, never on a bigger drawing, giving way to names).
- The main, war and New World walkthroughs pass with no page errors. Tapping Bavaria still selects Bavaria.

## Data sources and licences

| Data | Use | Licence | Attribution |
| --- | --- | --- | --- |
| NOAA ETOPO 2022 Global Relief Model, 15″, surface elevation | Relief, snow line, sea depth | Public domain (U.S. Government work) | NOAA National Centers for Environmental Information. 2022: ETOPO 2022 15 Arc-Second Global Relief Model. https://doi.org/10.25921/fd45-gt74 |
| ESA WorldCover 10 m 2021 v200 | Forest, grass, farmland, scrub, bare ground, snow and ice, wetland, inland water | CC BY 4.0 | © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium |
| Natural Earth 1:10m physical v5.1.2 | Rivers, lakes | Public domain | Made with Natural Earth |
| Natural Earth 1:50m land (via `world-atlas`, as before) | The game's coastline, unchanged | Public domain | Made with Natural Earth |

Notes on the licences:
- WorldCover is CC BY 4.0, so its attribution is in the app (Settings > About) and in the README.
- The exact files, their SHA-256 and the retrieval date are in `assets/map/terrain/sources.json`.
- The symbol library (`scripts/terrain/symbols.py`, exported to `art/terrain-symbols/`) is original, drawn in code for
  this game.
