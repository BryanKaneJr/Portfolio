"""
Step 2: put every dataset on one canonical grid in the game's map units: the prototype region plus a margin, at the
finest level's resolution (WORK_PPU pixels per map unit). Output to scripts/data/terrain-work (git-ignored):

- elevation.npy   float32, metres (ETOPO 2022 surface: land elevation, sea-floor depth negative), warped from
                  EPSG:4326 with cubic resampling.
- cover.npy       uint8 [classes, rows, cols]: the fraction (0-255) of each ESA WorldCover class in each pixel,
                  averaged from the 1/16 overview (about 160 m).
- land.npy        uint8 0-255: how much of each pixel is land, from the GAME's own region, waste and far-land
                  outlines (src/content/map.json), rasterised 4x4-supersampled. This is the authority on land and
                  sea: terrain is painted to it, never the other way round.
- lake.npy        uint8 0-255: Natural Earth 1:10m lakes (inside the game's land only; the game's own geometry has
                  no European lakes, so they are scenery).
- grid.json       the grid: origin (map units), pixels per unit, size, and its EPSG:3857 geotransform.

Run: python scripts/terrain/prepare.py
"""
import json
import re

import numpy as np
import rasterio
from rasterio.enums import MergeAlg, Resampling
from rasterio.features import rasterize
from rasterio.warp import reproject
from shapely.geometry import Polygon, shape
import shapely

import mapproj as mp
from config import MAP_JSON, MARGIN, REGION, SRC_DIR, WC, WORK_DIR, WORK_PPU

CLASSES = ["tree", "shrub", "grass", "crop", "bare", "snow", "water", "wetland", "moss"]


def grid():
    return mp.region_grid(REGION, MARGIN, WORK_PPU)


def warp(src_path, g, resampling, dtype, src_array=None):
    out = np.zeros((g.height, g.width), dtype=dtype)
    with rasterio.open(src_path) as src:
        reproject(
            source=src_array if src_array is not None else rasterio.band(src, 1),
            destination=out,
            src_transform=src.transform,
            src_crs=src.crs if src_array is None else "EPSG:4326",
            dst_transform=g.transform,
            dst_crs="EPSG:3857",
            resampling=resampling,
            num_threads=4,
        )
    return out


def elevation(g):
    print("elevation: ETOPO 2022 → map grid (cubic)")
    return warp(SRC_DIR / "etopo2022_15s_region.tif", g, Resampling.cubic, np.float32)


def cover(g):
    """Class fractions: each class as a 0/255 layer, averaged onto the grid."""
    path = SRC_DIR / "worldcover2021_ov16_region.tif"
    with rasterio.open(path) as src:
        wc = src.read(1)
        transform = src.transform
    out = np.zeros((len(CLASSES), g.height, g.width), dtype=np.uint8)
    for i, name in enumerate(CLASSES):
        codes = [WC[name]] + ([WC["mangrove"]] if name == "wetland" else [])
        layer = np.isin(wc, codes).astype(np.uint8) * 255
        dst = np.zeros((g.height, g.width), dtype=np.uint8)
        reproject(source=layer, destination=dst, src_transform=transform, src_crs="EPSG:4326", dst_transform=g.transform, dst_crs="EPSG:3857", resampling=Resampling.average, num_threads=4)
        out[i] = dst
        print(f"cover: {name} {dst.mean() / 2.55:.1f}%")
    return out


# ---------------------------------------------------------------- the game's land, authoritative
def parse_rings(d):
    """As scripts/lib/geo.ts parseRings: SVG path of M/L/Z commands to rings of (x, y) in map units."""
    rings, cur = [], []
    for cmd, args in re.findall(r"([MLZ])([^MLZ]*)", d):
        if cmd == "Z":
            if cur:
                rings.append(cur)
            cur = []
            continue
        if cmd == "M" and cur:
            rings.append(cur)
            cur = []
        nums = [float(v) for v in re.split(r"[\s,]+", args.strip()) if v]
        cur.extend(zip(nums[0::2], nums[1::2]))
    if cur:
        rings.append(cur)
    return rings


def game_land_rings():
    m = json.loads(MAP_JSON.read_text())
    rings = []
    for group in ("regions", "wastelands", "far"):
        for item in m[group]:
            rings.extend(parse_rings(item["path"]))
    return rings


def coverage(rings_xy, g, ss=4, band=256):
    """Even-odd fill of rings (map units) as 0-255 coverage, supersampled ss x ss, in bands of rows."""
    x0, y0, x1, y1 = g.x0, g.y0, g.x0 + g.width / g.ppu, g.y0 + g.height / g.ppu
    polys = []
    for r in rings_xy:
        if len(r) < 3:
            continue
        xs = [p[0] for p in r]
        ys = [p[1] for p in r]
        if max(xs) < x0 or min(xs) > x1 or max(ys) < y0 or min(ys) > y1:
            continue
        polys.append(Polygon(r))
    out = np.zeros((g.height, g.width), dtype=np.uint8)
    for r0 in range(0, g.height, band):
        h = min(band, g.height - r0)
        sub = mp.Grid(g.x0, g.y0 + r0 / g.ppu, g.ppu * ss, g.width * ss, h * ss)
        # Rasterise in the sub-grid's own pixel space: map units → pixels.
        geoms = [(shapely.transform(p, lambda c, s=sub: (c - (s.x0, s.y0)) * s.ppu), 1) for p in polys]
        hits = rasterize(geoms, out_shape=(sub.height, sub.width), transform=rasterio.Affine.identity(), fill=0, merge_alg=MergeAlg.add, dtype=np.uint8, all_touched=False)
        inside = (hits % 2).astype(np.float32)  # even-odd
        cov = inside.reshape(h, ss, g.width, ss).mean(axis=(1, 3))
        out[r0 : r0 + h] = np.round(cov * 255).astype(np.uint8)
    return out


def lakes(g, land):
    polys = []
    for name in ("ne_10m_lakes.geojson", "ne_10m_lakes_europe.geojson"):
        data = json.loads((SRC_DIR / "naturalearth" / name).read_text())
        for f in data["features"]:
            geom = shape(f["geometry"])
            polys.append(shapely.transform(geom, lambda c: np.column_stack(mp.to_map(c[:, 0], c[:, 1]))))
    rings = []
    for p in polys:
        for poly in getattr(p, "geoms", [p]):
            rings.append(list(poly.exterior.coords))
            rings.extend(list(i.coords) for i in poly.interiors)
    lake = coverage(rings, g)
    return np.minimum(lake, land)


def main():
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    g = grid()
    print(f"grid: origin ({g.x0}, {g.y0}) map units, {g.ppu} px/unit, {g.width} x {g.height} px")
    np.save(WORK_DIR / "elevation.npy", elevation(g))
    np.save(WORK_DIR / "cover.npy", cover(g))
    print("land: rasterising the game's own coastline (4x4 supersampled)")
    land = coverage(game_land_rings(), g)
    np.save(WORK_DIR / "land.npy", land)
    print("lakes: Natural Earth 1:10m")
    np.save(WORK_DIR / "lake.npy", lakes(g, land))
    (WORK_DIR / "grid.json").write_text(json.dumps({"x0": g.x0, "y0": g.y0, "ppu": g.ppu, "width": g.width, "height": g.height, "epsg3857_transform": list(g.transform)[:6], "classes": CLASSES}, indent=1))
    print("done")


if __name__ == "__main__":
    main()
