"""
Settings for the offline terrain pipeline (see scripts/terrain/README.md).

Everything here is in the game's own map units (src/content/map.json: 2575 x 2242 units, spherical Mercator).
The tile pyramid is a quadtree anchored at map unit (0, 0): level L has PPU[L] pixels per map unit and tiles of
TILE pixels, so a level-L tile is TILE / PPU[L] map units square and splits exactly into four level-(L+1) tiles.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAP_JSON = ROOT / "src/content/map.json"
SEAS_JSON = ROOT / "src/content/seas.json"

# Caches (git-ignored): downloaded source data, and the canonical rasters made from it.
SRC_DIR = ROOT / "scripts/data/terrain-src"
WORK_DIR = Path(os.environ.get("TERRAIN_WORK", ROOT / "scripts/data/terrain-work"))  # (overridable, to build a second grid aside)

# Outputs (committed): the tiles, the vector layers and the index the app reads.
TILE_DIR = ROOT / "assets/map/terrain"
TILES_TS = ROOT / "src/ui/map/terrainTiles.ts"
VECTORS_TS = ROOT / "src/ui/map/terrainVectors.ts"
PEAKS_TS = ROOT / "src/ui/map/terrainPeaks.ts"
META_JSON = ROOT / "assets/map/terrain/sources.json"

# The region the terrain covers, in map units: the whole known Old World, from the Azores to the map's east edge and
# from the Gold Coast to the North Cape (about 33°W-47°E, 4°N-69°N; the New World ends at x 1152). Tiles are made
# only where they show the game's known land, or the sea within reach of it (render.py level_tiles): open sea and
# the parchment of the unknown are left to the style, so no edge of the terrain ever shows on land.
REGION = (1184, 128, 2576, 1728)  # x0, y0, x1, y1
# The finest level (L4) is made only where regions are small enough that players zoom right in; over these (the far
# north and east's giant regions, West Africa and the Atlantic islands) level 3 stands in at the closest zooms.
L4_SKIP = (
    "norway", "svealand", "finland", "karelia", "novgorod", "yaroslavl", "ryazan", "don", "iceland",
    "azores", "madeira", "canaries", "cape_verde", "arguin", "senegal", "gambia", "guinea", "sierra_leone", "mali",
    "timbuktu", "gao", "ivory_coast", "gold_coast",
)

# Pixels per map unit, per level. The game's closest zoom is K_MAX = 5 screen points per map unit
# (src/ui/map/camera.ts); on a 3x screen that is 15 device pixels per map unit, which level 4 covers.
PPU = [1, 2, 4, 8, 16]
TILE = 512  # pixels

# Source data is prepared on one canonical grid at the finest level's resolution, over the region plus a margin (so
# shading and symbol placement near the region's edge see their neighbours).
MARGIN = 32  # map units
WORK_PPU = PPU[-1]

# Source tiles are fetched (fetch.py) and kept one file per source tile in TILE_CACHE, wherever the game's land in
# REGION (grown by FETCH_MARGIN map units) needs them; prepare.py reads the ones it needs for each chunk of the grid.
TILE_CACHE = SRC_DIR / "tiles"
FETCH_MARGIN = 8  # map units
# The grid is prepared in square chunks of this many map units, only where land is within reach (CHUNK_REACH).
CHUNK = 256
CHUNK_REACH = 48  # map units: the margin, a tile's 16-unit reach into the sea, and room for every filter

# ---------------------------------------------------------------- sources
ETOPO = {
    "name": "NOAA ETOPO 2022 Global Relief Model, 15 arc-second, surface elevation (ice surface), GeoTIFF tiles",
    "version": "ETOPO 2022 v1",
    "base": "https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/15s/15s_surface_elev_gtif/",
    # Tiles are 15° x 15°, named by their north-west corner.
    "tile": "ETOPO_2022_v1_15s_{ns}{lat:02d}{ew}{lon:03d}_surface.tif",
    "doi": "https://doi.org/10.25921/fd45-gt74",
    "licence": "Public domain (U.S. Government work, NOAA National Centers for Environmental Information)",
    "attribution": "NOAA National Centers for Environmental Information. 2022: ETOPO 2022 15 Arc-Second Global Relief Model. https://doi.org/10.25921/fd45-gt74",
}
WORLDCOVER = {
    "name": "ESA WorldCover 10 m 2021 v200, land cover map (Cloud Optimized GeoTIFF tiles)",
    "version": "v200 (2021)",
    "base": "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/",
    # Tiles are 3° x 3°, named by their south-west corner.
    "tile": "ESA_WorldCover_10m_2021_v200_{ns}{lat:02d}{ew}{lon:03d}_Map.tif",
    # Read from the COG's built-in overview at 1/16 (about 160 m): the finest level's pixel is about 260 m.
    "overview_factor": 16,
    "doi": "https://doi.org/10.5281/zenodo.7254221",
    "licence": "CC BY 4.0",
    "attribution": "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
}
NATURAL_EARTH = {
    "name": "Natural Earth 1:10m physical vectors (rivers and lake centre-lines with the European supplement, lakes with the European supplement, coastline)",
    "version": "v5.1.2 (nvkelso/natural-earth-vector)",
    "base": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/",
    "files": [
        "ne_10m_rivers_lake_centerlines.geojson",
        "ne_10m_rivers_europe.geojson",
        "ne_10m_lakes.geojson",
        "ne_10m_lakes_europe.geojson",
        "ne_10m_coastline.geojson",
    ],
    "licence": "Public domain",
    "attribution": "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com",
}

# ESA WorldCover classes.
WC = {
    "tree": 10,
    "shrub": 20,
    "grass": 30,
    "crop": 40,
    "built": 50,
    "bare": 60,
    "snow": 70,
    "water": 80,
    "wetland": 90,
    "mangrove": 95,
    "moss": 100,
}

# The Illustrated style's sea, inside the tiles and out: this colour under the depth shading (relief_image, the game's
# baked sea depth with only its darkening kept, written by render.py) at this opacity. Over the last band_units of the region the tiles fade their own sea into exactly
# that, so the region's edge doesn't show on the water. tests/terrain.test.ts checks these against styles.ts.
EDGE_MATCH = {"sea": "#87a6ba", "relief": 0.55, "relief_image": "assets/map/terrain/sea-shade.png", "band_units": 24}
