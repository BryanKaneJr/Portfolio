"""
Step 1: fetch only the source data the prototype region needs, into scripts/data/terrain-src (git-ignored), and
record what was fetched (URLs, sizes, SHA-256, dates, licences) in assets/map/terrain/sources.json.

- ETOPO 2022 15 arc-second surface elevation: the 15° tiles over FETCH_BBOX, each read only over the bbox (the
  GeoTIFFs are internally tiled, so GDAL fetches just those blocks over HTTP), mosaicked into one GeoTIFF.
- ESA WorldCover 10 m 2021: the 3° tiles over FETCH_BBOX, read from each Cloud Optimized GeoTIFF's built-in 1/16
  overview (about 160 m), mosaicked into one GeoTIFF. Tiles that do not exist (open sea) are recorded as missing.
- Natural Earth 1:10m physical vectors, as GeoJSON from the pinned release.

Run: python scripts/terrain/fetch.py   (idempotent: anything already in the cache is kept)
"""
import datetime
import hashlib
import json
import math
import sys
import urllib.request

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.windows import from_bounds

from config import ETOPO, FETCH_BBOX, META_JSON, NATURAL_EARTH, SRC_DIR, WORLDCOVER

GDAL_ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="4", GDAL_HTTP_RETRY_DELAY="2", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def tile_name(spec, lat, lon):
    return spec["tile"].format(ns="N" if lat >= 0 else "S", lat=abs(lat), ew="E" if lon >= 0 else "W", lon=abs(lon))


# ---------------------------------------------------------------- ETOPO 2022
def fetch_etopo():
    out = SRC_DIR / "etopo2022_15s_region.tif"
    west, south, east, north = FETCH_BBOX
    res = 15 / 3600
    width = int(round((east - west) / res))
    height = int(round((north - south) / res))
    tiles = []
    # 15° tiles named by their north-west corner: the tile "N60E000" covers 45°N-60°N, 0°E-15°E.
    for tlat in range(int(math.floor(south / 15)) * 15 + 15, int(math.ceil(north / 15)) * 15 + 1, 15):
        for tlon in range(int(math.floor(west / 15)) * 15, int(math.ceil(east / 15)) * 15, 15):
            tiles.append((tlat, tlon))
    if out.exists():
        print(f"etopo: cached {out.name}")
        return out, [tile_name(ETOPO, a, b) for a, b in tiles]
    mosaic = np.full((height, width), np.nan, dtype=np.float32)
    names = []
    with rasterio.Env(**GDAL_ENV):
        for tlat, tlon in tiles:
            name = tile_name(ETOPO, tlat, tlon)
            url = "/vsicurl/" + ETOPO["base"] + name
            with rasterio.open(url) as src:
                b = src.bounds
                ix0, iy0 = max(west, b.left), min(north, b.top)
                ix1, iy1 = min(east, b.right), max(south, b.bottom)
                if ix0 >= ix1 or iy1 >= iy0:
                    continue
                win = from_bounds(ix0, iy1, ix1, iy0, src.transform).round_offsets().round_lengths()
                data = src.read(1, window=win).astype(np.float32)
                data[data == src.nodata] = np.nan
                c0 = int(round((ix0 - west) / res))
                r0 = int(round((north - iy0) / res))
                h, w = data.shape
                mosaic[r0 : r0 + h, c0 : c0 + w] = data[: height - r0, : width - c0]
                names.append(name)
                print(f"etopo: {name} {w}x{h}")
    assert not np.isnan(mosaic).any(), "ETOPO mosaic has holes"
    profile = dict(driver="GTiff", width=width, height=height, count=1, dtype="float32", crs="EPSG:4326", transform=from_origin(west, north, res, res), compress="deflate", predictor=3, tiled=True)
    with rasterio.open(out, "w", **profile) as dst:
        dst.write(mosaic, 1)
    return out, names


# ---------------------------------------------------------------- ESA WorldCover
def fetch_worldcover():
    out = SRC_DIR / "worldcover2021_ov16_region.tif"
    west, south, east, north = FETCH_BBOX
    f = WORLDCOVER["overview_factor"]
    res = 3 / (36000 / f)  # degrees per pixel at the overview
    width = int(round((east - west) / res))
    height = int(round((north - south) / res))
    lat0 = int(math.floor(south / 3)) * 3
    lon0 = int(math.floor(west / 3)) * 3
    present, missing = [], []
    if out.exists():
        meta = json.loads((SRC_DIR / "worldcover_tiles.json").read_text())
        print(f"worldcover: cached {out.name}")
        return out, meta["present"], meta["missing"]
    mosaic = np.zeros((height, width), dtype=np.uint8)  # 0: no data (open sea: WorldCover has no tiles there)
    with rasterio.Env(**GDAL_ENV):
        for tlat in range(lat0, int(math.ceil(north)), 3):
            for tlon in range(lon0, int(math.ceil(east)), 3):
                name = tile_name(WORLDCOVER, tlat, tlon)
                url = "/vsicurl/" + WORLDCOVER["base"] + name
                try:
                    with rasterio.open(url) as src:
                        n = 36000 // f
                        data = src.read(1, out_shape=(n, n), resampling=Resampling.nearest)  # served from the 1/16 overview
                except rasterio.errors.RasterioIOError:
                    missing.append(name)
                    continue
                present.append(name)
                # Place the 3° tile into the mosaic (clipped to the bbox).
                c0 = int(round((tlon - west) / res))
                r0 = int(round((north - (tlat + 3)) / res))
                rs, cs = max(0, -r0), max(0, -c0)
                re_, ce = min(n, height - r0), min(n, width - c0)
                if re_ > rs and ce > cs:
                    mosaic[r0 + rs : r0 + re_, c0 + cs : c0 + ce] = data[rs:re_, cs:ce]
                print(f"worldcover: {name}")
    profile = dict(driver="GTiff", width=width, height=height, count=1, dtype="uint8", crs="EPSG:4326", transform=from_origin(west, north, res, res), compress="deflate", tiled=True, nodata=0)
    with rasterio.open(out, "w", **profile) as dst:
        dst.write(mosaic, 1)
    (SRC_DIR / "worldcover_tiles.json").write_text(json.dumps({"present": present, "missing": missing}, indent=1))
    return out, present, missing


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
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    etopo, etopo_tiles = fetch_etopo()
    wc, wc_present, wc_missing = fetch_worldcover()
    ne = fetch_natural_earth()
    today = datetime.date.today().isoformat()
    meta = {
        "note": "Source data for the terrain tiles, fetched by scripts/terrain/fetch.py. The cache files are not committed; their checksums are recorded so a rebuild can be checked against them.",
        "region_bbox_lonlat": FETCH_BBOX,
        "retrieved": today,
        "etopo": {**ETOPO, "tiles": etopo_tiles, "cache": {"file": etopo.name, "bytes": etopo.stat().st_size, "sha256": sha256(etopo)}},
        "worldcover": {**WORLDCOVER, "tiles_read": wc_present, "tiles_missing_open_sea": wc_missing, "cache": {"file": wc.name, "bytes": wc.stat().st_size, "sha256": sha256(wc)}},
        "natural_earth": {**NATURAL_EARTH, "cache": [{"file": p.name, "bytes": p.stat().st_size, "sha256": sha256(p)} for p in ne]},
    }
    META_JSON.parent.mkdir(parents=True, exist_ok=True)
    META_JSON.write_text(json.dumps(meta, indent=1) + "\n")
    print(f"wrote {META_JSON}")


if __name__ == "__main__":
    sys.exit(main())
