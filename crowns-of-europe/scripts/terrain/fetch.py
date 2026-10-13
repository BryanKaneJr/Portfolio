"""
Step 1: fetch only the source data the region needs, one file per source tile, into scripts/data/terrain-src/tiles
(TILE_CACHE, git-ignored), and record what was fetched (URLs, files, SHA-256, dates, licences) in
assets/map/terrain/sources.json.

Only source tiles under the game's known land in REGION (grown by FETCH_MARGIN map units) are read:
- ETOPO 2022 15 arc-second surface elevation: each 15° tile is read only over the part of it the land needs (the
  GeoTIFFs are internally tiled, so GDAL fetches just those blocks over HTTP), on the tile's own pixel grid.
- ESA WorldCover 10 m 2021: each 3° tile, read from its Cloud Optimized GeoTIFF's built-in 1/16 overview (about
  160 m). Tiles that do not exist (open sea) are recorded as missing.
- Natural Earth 1:10m physical vectors, as GeoJSON from the pinned release.

Run: python scripts/terrain/fetch.py   (idempotent: anything already in the cache is kept)
"""
import datetime
import hashlib
import json
import math
import sys
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
import shapely
from rasterio.enums import Resampling
from rasterio.transform import from_origin

import mapproj as mp
import prepare
from config import ETOPO, FETCH_MARGIN, META_JSON, NATURAL_EARTH, REGION, SRC_DIR, TILE_CACHE, WORLDCOVER

GDAL_ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="6", GDAL_HTTP_RETRY_DELAY="3", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def tile_name(spec, lat, lon):
    return spec["tile"].format(ns="N" if lat >= 0 else "S", lat=abs(lat), ew="E" if lon >= 0 else "W", lon=abs(lon))


def land_lonlat():
    """The game's land in REGION, grown by FETCH_MARGIN, in lon/lat."""
    box = shapely.box(*REGION)
    land = shapely.union_all([g for g in prepare.game_land_geoms() if g.intersects(box)]).buffer(FETCH_MARGIN).intersection(box)
    return shapely.transform(land, lambda c: np.column_stack(mp.to_lonlat(c[:, 0], c[:, 1])))


def write(out, data, **profile):
    part = Path(str(out) + ".part")
    with rasterio.open(part, "w", **profile) as dst:
        dst.write(data, 1)
    part.rename(out)


# ---------------------------------------------------------------- ETOPO 2022
def fetch_etopo(land):
    """15° tiles named by their north-west corner ("N60E000" covers 45°N-60°N, 0°E-15°E)."""
    west, south, east, north = land.bounds
    names = []
    for tlat in range(int(math.floor(south / 15)) * 15 + 15, int(math.ceil(north / 15)) * 15 + 1, 15):
        for tlon in range(int(math.floor(west / 15)) * 15, int(math.ceil(east / 15)) * 15, 15):
            part = shapely.box(tlon, tlat - 15, tlon + 15, tlat).intersection(land)
            if part.is_empty:
                continue
            name = tile_name(ETOPO, tlat, tlon)
            names.append(name)
            out = TILE_CACHE / name
            if out.exists():
                continue
            b = part.bounds
            with rasterio.open("/vsicurl/" + ETOPO["base"] + name) as src:
                win = rasterio.windows.from_bounds(*b, src.transform).round_offsets().round_lengths()
                win = win.intersection(rasterio.windows.Window(0, 0, src.width, src.height))
                data = src.read(1, window=win)
                profile = dict(driver="GTiff", width=data.shape[1], height=data.shape[0], count=1, dtype=data.dtype, crs=src.crs, transform=src.window_transform(win), nodata=src.nodata, compress="deflate", predictor=3 if data.dtype.kind == "f" else 2, tiled=True)
            write(out, data, **profile)
            print(f"etopo: {name} {data.shape[1]}x{data.shape[0]}", flush=True)
    return names


# ---------------------------------------------------------------- ESA WorldCover
def fetch_worldcover(land):
    """3° tiles named by their south-west corner, from each COG's 1/16 overview."""
    west, south, east, north = land.bounds
    n = 36000 // WORLDCOVER["overview_factor"]
    present, missing = [], []
    for tlat in range(int(math.floor(south / 3)) * 3, int(math.ceil(north)), 3):
        for tlon in range(int(math.floor(west / 3)) * 3, int(math.ceil(east)), 3):
            if not shapely.box(tlon, tlat, tlon + 3, tlat + 3).intersects(land):
                continue
            name = tile_name(WORLDCOVER, tlat, tlon)
            out = TILE_CACHE / name
            if out.exists():
                present.append(name)
                continue
            try:
                with rasterio.open("/vsicurl/" + WORLDCOVER["base"] + name) as src:
                    data = src.read(1, out_shape=(n, n), resampling=Resampling.nearest)  # served from the 1/16 overview
            except rasterio.errors.RasterioIOError:
                missing.append(name)  # open sea: WorldCover has no tile there
                continue
            write(out, data, driver="GTiff", width=n, height=n, count=1, dtype="uint8", crs="EPSG:4326", transform=from_origin(tlon, tlat + 3, 3 / n, 3 / n), compress="deflate", tiled=True, nodata=0)
            present.append(name)
            print(f"worldcover: {name}", flush=True)
    return present, missing


# ---------------------------------------------------------------- Natural Earth
def fetch_natural_earth():
    files = []
    for name in NATURAL_EARTH["files"]:
        out = SRC_DIR / "naturalearth" / name
        out.parent.mkdir(parents=True, exist_ok=True)
        if not out.exists():
            url = NATURAL_EARTH["base"] + name
            print(f"naturalearth: {name}")
            with urllib.request.urlopen(url, timeout=120) as r, open(out, "wb") as f:
                f.write(r.read())
        files.append(out)
    return files


def main():
    TILE_CACHE.mkdir(parents=True, exist_ok=True)
    land = land_lonlat()
    with rasterio.Env(**GDAL_ENV):
        etopo = fetch_etopo(land)
        wc_present, wc_missing = fetch_worldcover(land)
    ne = fetch_natural_earth()
    meta = json.loads(META_JSON.read_text()) if META_JSON.exists() else {}
    meta.update({
        "note": "Source data for the terrain tiles, fetched by scripts/terrain/fetch.py, one file per source tile. The cache files are not committed; their checksums are recorded so a rebuild can be checked against them.",
        "region_map_units": REGION,
        "region_bbox_lonlat": [round(v, 3) for v in land.bounds],
        "retrieved": datetime.date.today().isoformat(),
        "etopo": {**ETOPO, "tiles": [{"file": n, "sha256": sha256(TILE_CACHE / n)} for n in etopo]},
        "worldcover": {**WORLDCOVER, "tiles_read": [{"file": n, "sha256": sha256(TILE_CACHE / n)} for n in wc_present], "tiles_missing_open_sea": wc_missing},
        "natural_earth": {**NATURAL_EARTH, "cache": [{"file": p.name, "bytes": p.stat().st_size, "sha256": sha256(p)} for p in ne]},
    })
    META_JSON.parent.mkdir(parents=True, exist_ok=True)
    META_JSON.write_text(json.dumps(meta, indent=1) + "\n")
    print(f"wrote {META_JSON}: {len(etopo)} ETOPO tiles, {len(wc_present)} WorldCover tiles ({len(wc_missing)} missing: open sea)")


if __name__ == "__main__":
    sys.exit(main())
