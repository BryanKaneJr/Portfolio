# Scaling the illustrated terrain from one region to the whole map

The prototype covers central and eastern Europe: map units x 1792–2368, y 576–1088 (about 3°E–35°E, 38°N–57°N).
That is 8.1% of the game's known land. This plan takes the same pipeline and runtime layer to every land the game
draws, without changing the game's coordinates, geometry or systems.

## What stays exactly as it is

- **Coordinates.** The map stays one spherical Mercator frame in map units: 2575 × 2242 units, an exact affine of
  EPSG:3857. Tiles are a quadtree anchored at map (0, 0), so a world tile's address is `L{level}/{tx}_{ty}` with no
  change to the scheme. Region tiles already use those addresses.
- **The game's coastline is the authority.** Each source is warped onto the map grid by GDAL, and the land mask is the
  game's own outline.
- **Runtime.** `terrainLayer.ts` already works on a level list and a bounding box. With the whole map, the region test
  in `MapView` (`terrainOn` / `allTerrain` / `tOut`) is always true and the Atlas fallback is never drawn.

## Size: the hard constraint

Tiles touching the game's known land (regions and wastelands, rasterised at 1 px per unit), per level, against the
prototype:

| Level | px per unit | Tile span (units) | Whole map: tiles touching land | Prototype tiles | Prototype size |
| --- | --- | --- | --- | --- | --- |
| L0 | 1 | 512 | 29 (of 30) | 4 | PROTO_L0 |
| L1 | 2 | 256 | 87 (of 99) | 9 | PROTO_L1 |
| L2 | 4 | 128 | 275 (of 378) | 25 | PROTO_L2 |
| L3 | 8 | 64 | 936 (of 1,476) | 72 | PROTO_L3 |
| L4 | 16 | 32 | 3,250 (of 5,751) | 288 | PROTO_L4 |
| Total | | | 4,577 | 398 | PROTO_TOTAL |

At the prototype's average of AVG_KB KB per JPEG tile (quality 84), the whole pyramid would be about WORLD_MB MB.
L4 alone would be about WORLD_L4_MB MB. That is too much to bundle in a phone app:
- App Store cellular downloads cap at 200 MB.
- Google Play's base module caps at 150 MB.

The levels below L4 are affordable: L0–L3 come to about WORLD_L0_3_MB MB.

### Options for the finest level (L4)

L4 serves zooms from about k = 3.1 to K_MAX = 5 on 3× screens.

| Option | Bundle | What the player sees | Effort |
| --- | --- | --- | --- |
| **A. L4 only for the core** (Europe, the Mediterranean and the Middle East: the dense, small regions where close zoom matters, e.g. Calais and Zealand) | Bundle about L0–L3 + 30–40% of L4 | Elsewhere, L3 shows up to 1.9× magnified at K_MAX on 3×. Below k ≈ 3.1 it shows at its full resolution. | Config only: a list of L4 boxes |
| **B. Smaller tiles: WebP + split layers.** Bake only colour, relief and water into the raster at L4. Draw the symbols (peaks, trees, marsh) from compact per-tile placement lists with a sprite atlas at runtime (Skia `drawAtlas` on native). | WebP is typically 25–35% smaller than JPEG at the same look. The L4 base without symbols compresses much better, since it is smooth. Placement lists are about 5 bytes per symbol. | The same picture; symbols stay crisp at any zoom | Medium: a Skia layer (below) and a placement exporter |
| **C. Lower K_MAX to about 3** | L4 not needed at all | The closest zoom is 40% less close: a gameplay change | Trivial, but the owner decides |
| **D. Store-delivered asset packs** (Play Asset Delivery fast-follow, iOS Background Assets) | Base app stays small | Full detail after a background download | Medium; it conflicts with "offline, no network calls in `src/`" unless the store does all of it |

**Recommendation:** start with A, then B.
- **A** costs nothing at runtime and keeps the game fully offline.
- **B** is the long-term format: it also cuts memory, because the raster tiles shrink and symbols draw as sprites. It is
  also where Skia pays for itself.
- **C** stays the fallback if the bundle must be smaller still.

### Elevation resolution

- ETOPO 2022 15″ has about 10–14 samples per map unit at 45–50°N. L4 (16 px per unit) therefore already interpolates
  elevation 1.2–1.6×, while land cover and symbols are true to the level.
- Further north the Mercator scale grows (fewer km per unit), so 15″ is enough there.
- Toward the equator a unit spans more ground (about 6.4 km at 0°), so 15″ has even more samples per unit than needed.

## Pipeline changes for the world

1. **Regions as a list.** Change `REGION` in `config.py` to a list of boxes, each a multiple of 32 units, so every level
   tiles it exactly. Or use the whole map with a per-tile "touches land or coast within the halo" test. Tiles of open
   sea are not drawn: the runtime sea shows there, as it does outside the prototype.
2. **Sea edge.** The tiles' sea already fades into the style's sea near the region's edge (`EDGE_MATCH`). For the
   world, apply the same fade by distance from the coast (for example 24 units), so open-sea tiles can be dropped
   without a visible edge.
3. **Fetching by box.**
   - ETOPO 15″ is read windowed over HTTP (GDAL `/vsicurl/`), so each box costs only its blocks.
   - The globe at 15″ is 86,400 × 43,200 samples. The known world is a fraction of that, roughly 1–2 GB of float32
     in the git-ignored cache, read once.
   - WorldCover is read from each 3° COG's 1/16 overview, about 2,650 land tiles worldwide. Only those under the
     game's land are read.
   - Natural Earth 10m is already global.
4. **Canonical grid per box.** `prepare.py` writes one 16 px/unit grid per box plus a 32-unit margin. A box of
   576 × 512 units is about 9,700 × 8,700 px, roughly 1 GB across all its arrays. Boxes can be prepared and rendered
   in parallel processes.
5. **Render time.** The prototype's L4 took about 400 s for 288 tiles on one core. 3,250 L4 tiles is about 75 minutes
   on one core, or about 10 minutes on 8. Lower levels cost about a third of that again. The work is embarrassingly
   parallel by band and box. Determinism holds across processes, because every random choice is a hash of the global
   pixel position.
6. **Biome tuning.**
   - The palette was tuned for temperate Europe. The world adds hot desert (the Sahara and Arabia), tropical forest
     (West Africa and the Caribbean), boreal forest and tundra.
   - WorldCover classes already separate these: bare, shrub, tree, moss. Add symbol variants for palms, dunes and
     scrub to `symbols.py`.
   - Glaciers come from the snow/ice class (Alps, Scandinavia, Iceland, Greenland's edge).
7. **Verification per box.** `verify.py`'s checks run unchanged per box: determinism, joins, coast agreement and detail
   gain. Add a CI step comparing tile hashes to `sources.json`, so a rebuild with the same sources is detected as
   identical.

## Runtime changes for the world

- **Engine.**
  - Keep `react-native-svg` for the political layers, which already work and are tested.
  - Move the terrain tiles, and in option B the symbols, into a `@shopify/react-native-skia` canvas under the SVG on
    native, using the same camera transform.
  - On the web, keep the SVG `<image>` path (it already performs well) or use CanvasKit.
  - See `ARCHITECTURE-AUDIT.md` for the comparison.
- **Memory.**
  - At play zoom on a 3× screen the layer draws one L0 tile, the L2 tiles under the screen and the L3 tiles over the
    screen plus a 15% buffer: about 30–50 tiles, 1 MB each decoded (512² × 4 bytes).
  - The LRU cache holds up to 160 tiles (about 160 MB decoded at worst on the web; native image caches may hold less).
  - For low-memory devices:
    - lower `CACHE_TILES`
    - skip the L(fine-1) layer under the screen once the fine level has fully faded in
    - use 256 px tiles at L4, which reduces overdraw at the screen's edge
- **Level choice.** It is unchanged: the coarsest level sharp enough for the zoom and screen density, with the next
  finer one faded in. The tests in `tests/terrain.test.ts` already check coverage, monotonicity and the buffer limit
  for any level list.

## Order of work

1. Europe core, option A:
   - extend `REGION` to Iberia, France, Britain, Scandinavia, Anatolia and the Levant
   - add the distance-from-coast sea fade
   - build, run `verify.py` and the screenshots
2. Measure on two physical phones (an iPhone SE-class and a mid-range Android): frame time while panning at play zoom,
   peak memory at K_MAX, and tile pop-in. Adjust `CACHE_TILES`, `BUFFER` and the fade.
3. The Skia terrain layer on native (option B's runtime), behind the same `terrainLayer.ts` API.
4. Biome symbols and palette for Africa, the Middle East and the Americas; then the rest of the known world.
5. Decide the L4 extent against the final bundle budget.
