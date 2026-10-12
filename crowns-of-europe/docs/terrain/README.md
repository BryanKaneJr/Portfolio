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

RESULTS_PLACEHOLDER

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
