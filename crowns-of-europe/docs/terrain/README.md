# Illustrated terrain: the central and eastern Europe prototype

This replaces the map's low-resolution ground with an illustrated atlas drawn from real geographic data in the game's
own coordinates. It covers one prototype region: central and eastern Europe, with the Alps, the Carpathians, the
Danube basin, and the Adriatic, Baltic and Black Sea coasts. It renders inside the real game as the default map style,
"Illustrated". Political colours, borders, selection, labels, units and every game system are unchanged.

| Document | What it is |
| --- | --- |
| [ARCHITECTURE-AUDIT.md](ARCHITECTURE-AUDIT.md) | How the map renders today, the coordinate system, which assets lose resolution, and the engine decision |
| [../../scripts/terrain/README.md](../../scripts/terrain/README.md) | The offline pipeline: setup, steps, coordinates, levels, data sources and licences |
| [WORLD-SCALING-PLAN.md](WORLD-SCALING-PLAN.md) | Taking it from one region to the whole map: sizes, options, order of work |
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
             relief, land cover colours, peaks at real summits, trees           terrainLayer.ts: level choice, culling,
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
  - peaks at summits found in a window of fixed pixels
  - trees on a lattice of fixed pixel spacing

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
| The pipeline runs end to end, offline from the app | `fetch → prepare → render → vectors → verify` ran on this machine. `sources.json` records every source file's URL, size and SHA-256. Render time per level: L0 5 s, L1 6 s, L2 24 s, L3 101 s, L4 345 s (one core). |
| 398 tiles in 5 levels, 28.3 MB, bundled | `assets/map/terrain/L0…L4` (4 / 9 / 25 / 72 / 288 tiles); `src/ui/map/terrainTiles.ts` (generated index). |
| One coordinate system, no estimated alignment | `tests/terrain.test.ts` projects sample points with pyproj (EPSG:4326 → 3857 → map units) and checks them against the game's own formula: equal to 6 decimal places. |
| The tiles follow the game's coastline | The land/sea painted in the L4 tiles was read back and compared with the game's outline within 3 map units of the coast (7.5 M pixels). 73 k pixels disagree. Nearly all are either the coast pixel itself (20 k, anti-aliased) or lakes, lagoons and wide rivers deliberately painted on the game's land (53 k). That leaves **173 pixels unexplained (0.002 %)**: 171 are game land painted as water, a median of 1.4 units from the coast, and 2 are game sea painted as land. Symbols are cut to the game's land, so nothing spills over a coast. |
| No seams between tiles | At every tile edge of L0–L2, and at a sample of 12 edges of L3 and of L4, the colour step across the edge was compared with the step at the same line in a render that has no edge there. The tiles add **1.5–2.4 grey levels** on average (at most 3.8, out of 255): JPEG noise. Against the steps across 8 px JPEG blocks inside tiles the ratio is 1.02–1.11 for L1–L4. |
| Deterministic, so rebuilds and neighbours agree | Re-rendering level 2 gives byte-identical tiles (25/25). Two overlapping boxes drawn at different offsets place every symbol identically. Their pixels differ on 89 of 262,144 pixels (0.03 %): isolated edge pixels that Skia anti-aliases a little differently on a surface of another size. |
| Each zoom level adds real detail, not magnification | The fine detail (Laplacian energy) of each level against the level above it magnified ×2 over the same ground: **10–58×** more (paper grain alone is under 1 % of that). Real features in a 32 × 32-unit box of the Alps, by level L1–L4: 2 → 51 → 189 → 769 symbols (peaks 2 → 2 → 7 → 26), plus hachures 6 → 20 → 76 → 339. The Carpathians: 2 → 112 → 309 → 1,064. These are round 2's thinner counts; round 1's are in the round 2 section below. |
| No magnification at the closest zoom | L4 is 16 px per map unit; the closest zoom (K_MAX = 5) on a 3× screen needs 15. Level choice allows at most 1/0.85 = 1.18× while a finer level fades in (tested). |
| Political state, borders, labels, units, selection are unchanged | They are drawn by the same SVG layers on top of the tiles. Tapping Bavaria in the illustrated region selects Bavaria (`perf.json`). The main, war and New World walkthroughs pass with no page errors. |
| Tests and checks | `npm run check` passes: typecheck, lint, content validation, and 79 Jest tests in 13 suites, 14 of them for the tile layer. |

### In the game (headless Chromium, 390 × 844 points at 3×; a browser is not a phone)

| View | k | Level drawn | Tiles drawn | Decoded tile memory | Redraw after a camera move, Atlas → Illustrated (unthrottled; CPU 4× slower) |
| --- | --- | --- | --- | --- | --- |
| europe | 0.45 | L1 | 13 | 5.6 MB | 31 → 27 ms; 99 → 142 ms |
| region | 0.9 | L2 | 38 | 23.6 MB | 55 → 60 ms; 488 → 315 ms |
| alps-play | 1.7 | L3 | 59 | 53.1 MB | 39 → 49 ms; 224 → 289 ms |
| carpathians-play | 1.7 | L3 | 64 | 55.1 MB | 53 → 41 ms; 219 → 229 ms |
| danube-play | 1.7 | L3 | 64 | 57.1 MB | 48 → 52 ms; 245 → 239 ms |
| alps-close | 3.2 | L4 | 102 | 100.5 MB | 39 → 43 ms; 176 → 160 ms |
| alps-max | 5 | L4 | 48 | 47.4 MB | 21 → 25 ms; 145 → 113 ms |
| adriatic-play | 1.7 | L3 | 72 | 65.1 MB | 52 → 47 ms; 280 → 228 ms |
| dalmatia-close | 3.2 | L4 | 88 | 85.1 MB | 31 → 27 ms; 106 → 303 ms |
| region-edge-west | 1.7 | L3 | 36 | 32.5 MB | 54 → 36 ms; 168 → 169 ms |

- **Panning** at play zoom: a two-second drag, twice per style. The camera moved 101 × 67 map units in every run, and
  no frame during a drag had a long task.
  - Unthrottled: both styles had median 16.7 ms, p95 16.8 ms and worst 16.8 ms. The redraw on release was under 50 ms,
    except one Illustrated run at 69 ms.
  - CPU 4× slower, Illustrated: median 16.7 ms, p95 16.8 ms, worst 33.4 ms; the redraw on release took 236 ms and
    253 ms.
  - CPU 4× slower, Atlas: median 16.7 ms, p95 16.8 ms, worst 33.4 ms; the redraw on release took 199 ms and 164 ms.

  During a drag only a transform moves, so frames hold 60 fps. On the web the moving view is its own compositor layer
  (round 2, below). When the finger lifts, the map is drawn again. With the tiles that costs a little more than
  without: 236–253 ms against 164–199 ms at 4× slowdown, and about 50 ms or less unthrottled. That redraw is how the
  game's renderer already works.
- **Redraw times** run from the camera change to two animation frames later, so they include up to about 33 ms of
  waiting for frames. Each is a single sample, and at 4× slowdown they vary by ±100 ms from run to run. For example,
  dalmatia-close measured 121 ms in the previous run and 303 ms in this one.
- **JS heap:** 22.5–52.3 MB in both styles. Images are decoded outside the JS heap. Their memory is the "decoded tile
  memory" column, computed from the tiles drawn.
- **Decoded tile memory** is highest (100 MB) just after the finest level starts to fade in at k ≈ 3.2, when two levels
  cover the screen. It is 47 MB at the closest zoom and 53–65 MB at play zoom.
- **Raw data:** `perf.json`. Screenshots of every view before and after: `screens/compare-*.jpg`.

### What is incomplete or open

- **Not measured on a phone.** All the performance numbers come from desktop Chromium, with the CPU slowed 4× as a rough
  stand-in for a mid-range phone. Frame rate, memory and image decoding in react-native-svg on iOS and Android are
  still to be measured. That is the next step, and the plan says how.
- **One region.** Outside central and eastern Europe the Illustrated style is Atlas-like.
  - At sea the region's edge is invisible: the tiles fade into the style's own sea over the last 24 units.
  - On land a straight line shows where the tiles end, for example through France at 3°E
    (`screens/compare-region-edge-west.jpg`). It goes away with the whole-map rollout.
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
| Tyrol Alps | 314 → 189 (−40%) | 107 → 76 (−29%) | 11 → 7 | −37% | 1,295 → 769 (−41%) | 544 → 339 (−38%) | 43 → 26 | −40% |
| Switzerland and Lombardy | 1,413 → 711 (−50%) | 2,660 → 1,600 (−40%) | 58 → 33 | −43% | 5,439 → 2,619 (−52%) | 11,311 → 6,329 (−44%) | 254 → 136 | −47% |
| Carpathians | 547 → 309 (−44%) | 192 → 127 (−34%) | 18 → 14 | −41% | 2,007 → 1,064 (−47%) | 1,056 → 676 (−36%) | 68 → 50 | −43% |
| Danube plain | 242 → 159 (−34%) | 1 → 0 | 5 → 4 | −35% | 940 → 632 (−33%) | 5 → 1 | 10 → 10 | −33% |

The boxes, in map units:
- Tyrol Alps: (1888, 832)–(1920, 864)
- Switzerland and Lombardy: (1880, 835)–(1945, 900)
- Carpathians: (2160, 832)–(2192, 864)
- Danube plain: (2048, 864)–(2080, 896)

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
  - Rivers are capped thinner when zoomed out.
  - The great rivers are smoothed.

Open country lost 33–35% of its marks. The mountains lost more than asked: 37–47% of all marks. At about 35% the
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
- **Rivers.** Minor rivers are drawn in a lighter blue than the great rivers, so they don't read as province lines.

### 3. Water set apart

- **Colour.** The sea is `#87a6ba`. That is deeper and bluer than round 1's `#a1b5b5`, and well short of the Atlas
  style's navy `#2b5a6b`.
- **Deep water.** It is darkened a little more, by the same shading inside the tiles and outside them
  (`TERRAIN_SEA_SHADE`, from `assets/map/relief-sea.png`). So the region's edge doesn't show at sea.
- **Coasts.** Every coast has a soft dark band in the water (`terrain.shore`): two strokes of the coastline, cut to the
  water. It outlines pale coastal realms.
  - The band is narrower when zoomed out.
  - Its wide outer stroke comes in only from k ≈ 0.8, so it doesn't smudge the fjords of Norway and Sweden.
- **Sea names** are darker: 3.1–3.8:1 contrast against the new sea.
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

  On the new Adriatic views the closest 10% sit at ΔE 17–19. The Atlas style's navy measures a median of 52 there,
  against the Illustrated style's 41.

### Performance after round 2

Panning a two-second drag at play zoom costs the same in both styles. In round 2 the first measurement of the new
casing and shore band showed 21% slow frames while dragging. The cause was the browser repainting the whole SVG on
each frame of the move. The moving map view now has its own compositor layer on the web (`WEB_LAYER` in `MapView`),
so a drag only moves a texture. `scripts/dev/pan-layers.mjs` measures each layer's cost with and without it. The table
above and `perf.json` are round 2's.


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
