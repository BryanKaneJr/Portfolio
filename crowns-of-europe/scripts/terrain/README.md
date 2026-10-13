# Terrain pipeline (offline)

Builds the illustrated terrain tiles and the river and lake vectors the map draws in the "Illustrated"
style. It runs on a workstation or in CI, never on the phone. The app only bundles what it writes:
- `assets/map/terrain/L*/*.jpg`
- `assets/map/terrain/sea-shade.png`, `sea-shade-soft.png`
- `src/ui/map/terrainTiles.ts`
- `src/ui/map/terrainVectors.ts`

It covers the whole known Old World: `REGION` in `config.py`, map units x 1184–2576, y 128–1728 (about 33°W–47°E,
4°N–69°N). The New World keeps the Atlas style. Tiles are made only where they show the game's known land, or the sea
within reach of it; open sea and the parchment over the wastes are left to the style, so no edge of the terrain shows
on land.

## Setup

```
python3 -m venv .venv-terrain && . .venv-terrain/bin/activate
pip install -r scripts/terrain/requirements.txt      # rasterio's wheels include GDAL 3.12
sudo apt-get install libegl1                          # skia-python needs the system EGL library
```

## Steps (`npm run tiles:build` runs 1–4 with the active Python)

| Step | Script | What it does | Output |
| --- | --- | --- | --- |
| 1 | `fetch.py` | Downloads only the source tiles under the game's land in the region, one file per source tile. ETOPO 2022 15″ tiles are read over the part the land needs only, since GDAL fetches just the needed GeoTIFF blocks. ESA WorldCover is read from each Cloud Optimized GeoTIFF's built-in 1/16 level (~160 m). Natural Earth 1:10m vectors come from the pinned v5.1.2 release. | `scripts/data/terrain-src/tiles/` (git-ignored); files, SHA-256 and URLs in `assets/map/terrain/sources.json` |
| 2 | `prepare.py` | Warps every dataset onto one canonical grid in the game's map units at 16 px per unit, in 256-unit chunks where land is within reach: elevation (cubic), land-cover fractions per class (average of 0/255 masks), and the game's own land outline rasterised 4×4-supersampled. Writes coarser copies (8, 4, 2, 1 px per unit) for the coarser levels. | `scripts/data/terrain-work/` (git-ignored; about 12 GB for the Old World) |
| 3 | `render.py` | Draws each level from that data: land colour, relief, trees and marsh, water, paper grain on the land. Each level is drawn in blocks of 4 × 4 tiles with an 8-unit halo, four at a time, then cut into 512 px JPEG tiles. Also writes the tile index and the sea's depth shading. | `assets/map/terrain/L0…L4/*.jpg`, `assets/map/terrain/sea-shade*.png`, `src/ui/map/terrainTiles.ts` |
| 4 | `vectors.py` | Natural Earth rivers and lakes in map units, cut to the game's known land in the region, simplified to 0.1 units and written as relative steps at 0.1-unit precision, plus WorldCover's small lakes (from step 2's 8 px/unit copy; at least 1.5 square units over `L4_SKIP`'s regions). | `src/ui/map/terrainVectors.ts` |
| 5 | `verify.py` | Measures determinism, tile joins, coastline agreement and real detail per level. | `docs/terrain/verification.json`, `docs/terrain/img/` |

`render.py --preview LEVEL X0 Y0 X1 Y1 out.png` renders any box of any level, for tuning; `render.py --index` writes
only the tile index for the tiles on disk. Set `TERRAIN_WORK` to build a second grid aside.

## Coordinates: one canonical system, the game's

The game's map is spherical Mercator: 2575 × 2242 units, 101°W–47°E, top edge at 71.2°N. `mapproj.py` holds the
same formulas as `scripts/build-map.ts`, and the game's map units are an exact affine transform of EPSG:3857 metres.
GDAL therefore warps every lon/lat dataset straight onto a grid of map units, with no estimated control points.

`tests/terrain.test.ts` checks this against the game's own JavaScript formula, using sample points that `render.py`
projects through pyproj and records in `sources.json`.

The game's coastline is the authority on land and sea. Its outline comes from Natural Earth 1:50m via `build-map`.
The terrain is painted to that outline and never the other way round. Elevation decides only relief: land at or below
sea level, such as the Dutch polders or the Danube delta, is shaded as lowland, and sea the game has but ETOPO calls
land is painted as shallows.

## The levels

| Level | Pixels per map unit | Tile span (map units) | Used from zoom k on a 3× screen |
| --- | --- | --- | --- |
| L0 | 1 | 512 | whole map |
| L1 | 2 | 256 | k ≥ 0.39 |
| L2 | 4 | 128 | k ≥ 0.78 |
| L3 | 8 | 64 | k ≥ 1.57 (play zoom, 1.7) |
| L4 | 16 | 32 | k ≥ 3.14, up to K_MAX = 5 (15 px per unit needed) |

Each level is drawn from the data at its own resolution:
- **Relief** is shaded from elevation averaged to that level's pixels.
- **Trees** stand on a jittered lattice of fixed pixel spacing.

So a finer level carries more and smaller real features; it is not a coarser level enlarged. `verify.py` measures
this.

Symbol sizes are in tile pixels, chosen for phones. The app picks the level by zoom × screen density, so on a 3× screen
every level is shown at about 0.6–1.2 device pixels per tile pixel. `SYM` in `render.py` scales every symbol and
spacing so that a tree is about 3–6 points tall there. Symbols are drawn on their own layer and cut to the game's land
before they go on the ground, so nothing spills over the coast. The two finest levels are thinned (`SPREAD`,
`HIGH_THIN`, `TREE_FROM`), and `CALM_HIGH` softens the fine relief above 1000 m.

**Mountains are not drawn in the tiles.** The app draws the owner's own drawings (`art/mountains`, placed along the
real ranges by `scripts/build-terrain.ts` for the Atlas style) over the famous ranges only, small (`famousMountains`
in `src/ui/map/terrainLayer.ts`). The tiles carry the relief shading, no slope hachures, and keep the main summits
clear of trees (`features()`: one ranked list of summits on the crests of real ranges, by height and isolation).

A tile is made only where, grown by `REACH` (16 units), it shows the game's known land (`level_tiles`); the finest
level skips the regions in `L4_SKIP`, where level 3 stands in. The index marks a tile `full` when all four of its
children exist, and the app hides a coarser tile only there. What the style covers with its parchment (the wastes,
the unknown waters, past the map's edge) is painted plain (`hidden_mask`).

The sea follows one rule inside the tiles and out. It is the style's sea colour under the game's baked sea depth, with
only the darkening kept: deep water darker, shallows never paler than open sea. `render.py` writes that shading as
`assets/map/terrain/sea-shade*.png`. The app draws it past the region, and the tiles paint the same, so no seam shows
where they end, and no paper grain is laid on it, so a tile left out over open sea leaves no seam. `EDGE_MATCH` in
`config.py` holds the colour, the opacity and the picture, and a test keeps them in step with the style.

`vectors.py` sets each river's width from its Natural Earth rank: the great rivers clearly heavier than tributaries.
Natural Earth's own stroke weight is missing in the main file and unreliable in the European supplement. It leaves out
minor rivers (scalerank 10 and up) shorter than 30 map units (about 130 km), unless they touch a lake. The great rivers
are smoothed (two Chaikin passes), since drawn heavier their coarse 1:10m kinks would show. Lakes that Natural Earth
lacks (Hallwil, Sempach...) are added from WorldCover's water, inland only, leaving out stretches of wide river (water
that a river line runs along). All lakes are drawn filled over the realms' colours, so they read as water. The close-up views keep the long rivers and every lake's inflow and outflow, without the
short stubs.

### Source resolution against need

ETOPO 2022 15″ has about 10–14 samples per map unit at 45–50°N. Level 4's 16 px per unit therefore interpolates
elevation by about 1.2–1.6×, using cubic warping, smoothed before shading. Everything drawn on top of the relief is
true to level 4's resolution: land cover from WorldCover at about 160 m, the symbols, and the coastal lines.

## Determinism

Every random choice is a hash of the symbol's global position on its level's pixel lattice: tree spacing and variant,
mountain shape, grain noise. A rebuild draws the same map, and a tile's edge matches its neighbour's pixel for pixel.

## Data sources and licences

| Data | Version | Use | Licence | Attribution |
| --- | --- | --- | --- | --- |
| NOAA ETOPO 2022 Global Relief Model, 15″ surface elevation | v1 (2022) | Relief, snow line, sea depth | Public domain (U.S. Government work) | NOAA National Centers for Environmental Information. 2022: ETOPO 2022 15 Arc-Second Global Relief Model. https://doi.org/10.25921/fd45-gt74 |
| ESA WorldCover 10 m | v200 (2021) | Forest, grass, farmland, scrub, bare ground, snow and ice, wetland, inland water | CC BY 4.0 | © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium |
| Natural Earth 1:10m physical | v5.1.2 | Rivers and lake centre-lines (with the European supplement), lakes (with the European supplement), coastline used only to compare | Public domain | Made with Natural Earth |
| Natural Earth 1:50m land, via `world-atlas` | as `build-map` | The game's own coastline (unchanged) | Public domain | Made with Natural Earth |

WorldCover is CC BY 4.0, so the attribution above must appear in the app's credits and the README; it is added to
both.
