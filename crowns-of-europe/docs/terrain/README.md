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
| [screens/](screens/) | Before and after screenshots at seven zooms, the region's edge, and the tap test |

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
| The pipeline runs end to end, offline from the app | `fetch → prepare → render → vectors → verify` ran on this machine. `sources.json` records every source file's URL, size and SHA-256. Render time per level: L0 5 s, L1 6 s, L2 24 s, L3 107 s, L4 384 s (one core). |
| 398 tiles in 5 levels, 29.7 MB, bundled | `assets/map/terrain/L0…L4` (4 / 9 / 25 / 72 / 288 tiles); `src/ui/map/terrainTiles.ts` (generated index). |
| One coordinate system, no estimated alignment | `tests/terrain.test.ts` projects sample points with pyproj (EPSG:4326 → 3857 → map units) and checks them against the game's own formula: equal to 6 decimal places. |
| The tiles follow the game's coastline | The land/sea painted in the L4 tiles was read back and compared with the game's outline within 3 map units of the coast (7.5 M pixels). Of the pixels that disagree, most are the coast pixel itself (91 k, anti-aliased) or lakes, lagoons and wide rivers deliberately painted on the game's land (44 k). That leaves **0.24 % unexplained**: 95 % of those are within 0.14 units (about 600 m) of the coast, and 73 pixels are land painted where the game has sea. Symbols are cut to the game's land, so nothing spills over a coast. |
| No seams between tiles | At every tile edge of L0–L2, and at a sample of 12 edges of L3 and of L4, the colour step across the edge was compared with the step at the same line in a render that has no edge there. The tiles add **1.3–2.4 grey levels** on average (at most 3.5, out of 255): JPEG noise. Against the steps across 8 px JPEG blocks inside tiles the ratio is 1.02–1.12 for L1–L4. |
| Deterministic, so rebuilds and neighbours agree | Re-rendering level 2 gives byte-identical tiles (25/25). A full re-render after a mask fix reproduced 368 of 398 tiles byte for byte; the other 30 were the ones the fix touched. Two overlapping boxes drawn at different offsets place every symbol identically; their pixels differ on 0.05 % of pixels, where Skia anti-aliases long hachure paths slightly differently. |
| Each zoom level adds real detail, not magnification | The fine detail (Laplacian energy) of each level against the level above it magnified ×2 over the same ground: **11–59×** more (paper grain alone is under 1 % of that). Real features in a 32 × 32-unit box of the Alps, by level: 2 → 61 → 314 → 1,295 symbols (peaks 1 → 1 → 3 → 18), plus hachures 6 → 20 → 107 → 544. The Carpathians: 2 → 148 → 547 → 2,007. |
| No magnification at the closest zoom | L4 is 16 px per map unit; the closest zoom (K_MAX = 5) on a 3× screen needs 15. Level choice allows at most 1/0.85 = 1.18× while a finer level fades in (tested). |
| Political state, borders, labels, units, selection are unchanged | They are drawn by the same SVG layers on top of the tiles. Tapping Bavaria in the illustrated region selects Bavaria (`perf.json`). The main, war and New World walkthroughs pass with no page errors. |
| Tests and checks | `npm run check` passes: typecheck, lint, content validation, and 79 Jest tests in 13 suites, 14 of them for the tile layer. |

### In the game (headless Chromium, 390 × 844 points at 3×; a browser is not a phone)

| View | k | Level drawn | Tiles drawn | Decoded tile memory | Redraw after a camera move, Atlas → Illustrated (unthrottled; CPU 4× slower) |
| --- | --- | --- | --- | --- | --- |
| europe | 0.45 | L1 | 13 | 5.6 MB | 26 → 40 ms; 99 → 123 ms |
| region | 0.9 | L2 | 38 | 23.6 MB | 61 → 58 ms; 286 → 332 ms |
| alps-play | 1.7 | L3 | 59 | 53.1 MB | 45 → 58 ms; 239 → 212 ms |
| carpathians-play | 1.7 | L3 | 64 | 55.1 MB | 42 → 74 ms; 383 → 249 ms |
| danube-play | 1.7 | L3 | 64 | 57.1 MB | 76 → 56 ms; 208 → 273 ms |
| alps-close | 3.2 | L4 | 102 | 100.5 MB | 27 → 36 ms; 139 → 150 ms |
| alps-max | 5 | L4 | 48 | 47.4 MB | 32 → 19 ms; 95 → 122 ms |
| region-edge-west | 1.7 | L3 | 36 | 32.5 MB | 36 → 49 ms; 141 → 212 ms |

- **Panning** at play zoom: a two-second drag, twice per style. The camera moved 101 × 67 map units in every run.
  - Unthrottled, Illustrated: median 16.7 ms, p95 16.8 ms, worst 16.8 ms; redraw on release under 50 ms both times.
  - Unthrottled, Atlas: median 16.7 ms, p95 16.8 ms, worst 50.1 ms; redraw on release under 50 ms, 58 ms.
  - CPU 4× slower, Illustrated: median 16.7 ms, p95 16.8 ms, worst 83.3 ms; redraw on release 237 ms, 224 ms.
  - CPU 4× slower, Atlas: median 16.7 ms, p95 16.8 ms, worst 50 ms; redraw on release 174 ms, 226 ms.

  During a drag only a transform moves, so frames hold 60 fps. With the CPU 4× slower, one Illustrated run had a
  single 83 ms frame, a long task in mid-drag, against 50 ms at worst for Atlas. When the finger lifts the map is
  drawn again, which costs about the same with the tiles as without: 224–237 ms against 174–226 ms at 4× slowdown,
  under 50 ms unthrottled. That redraw is how the game's renderer already works.
- **Redraw times** are from the camera change to two animation frames later, so they include up to about 33 ms of
  waiting for frames.
- **JS heap:** 22.2–51.1 MB in both styles. Images are decoded outside the JS heap; their memory is
  the "decoded tile memory" column, computed from the tiles drawn.
- **Decoded tile memory** is highest (100 MB) just after the finest level starts to fade in at k ≈ 3.2, when two levels
  cover the screen. It is 47 MB at the closest zoom and 53–57 MB at play zoom.
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
