"""
Step 2: put every dataset on one canonical grid in the game's map units: the region plus a margin, at the finest
level's resolution (WORK_PPU pixels per map unit). The grid is prepared in square chunks (CHUNK map units), only where
the game's land is within reach; the rest of it stays empty (zero) and is never drawn. Output to
scripts/data/terrain-work (git-ignored):

- elevation.npy   float32, metres (ETOPO 2022 surface: land elevation, sea-floor depth negative), warped from
                  EPSG:4326 with cubic resampling.
- cover.npy       uint8 [classes, rows, cols]: the fraction (0-255) of each ESA WorldCover class in each pixel,
                  averaged from the 1/16 overview (about 160 m).
- land.npy        uint8 0-255: how much of each pixel is land, from the GAME's own region, waste and far-land
                  outlines (src/content/map.json), rasterised 4x4-supersampled. This is the authority on land and
                  sea: terrain is painted to it, never the other way round. Each outline's own rings are filled
                  even-odd (its holes), and the outlines are then joined, as the game draws them, so two outlines
                  that overlap by a sliver never cancel into sea.
- lake.npy        uint8 0-255: Natural Earth 1:10m lakes (inside the game's land only; the game's own geometry has
                  no European lakes, so they are scenery).
- <name>_p8.npy, _p4, _p2, _p1: each of them averaged to 8, 4, 2 and 1 pixels per unit, for the coarser levels.
- grid.json       the grid: origin (map units), pixels per unit, size, its EPSG:3857 geotransform, the chunks made.

The sources are read from the per-tile cache fetch.py fills (TILE_CACHE): for each chunk, the ETOPO and WorldCover
tiles under it (plus a margin, so resampling near a chunk's edge sees its neighbours) are mosaicked and warped.

Run: python scripts/terrain/prepare.py            (--masks: only land.npy and lake.npy, from the cached grid)
"""
import argparse
import functools
import json
import math
import re

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.merge import merge
from rasterio.warp import reproject
from shapely.geometry import Polygon, shape
import shapely

import mapproj as mp
from config import CHUNK, CHUNK_REACH, MAP_JSON, MARGIN, PPU, REGION, SRC_DIR, TILE_CACHE, WC, WORK_DIR, WORK_PPU

CLASSES = ["tree", "shrub", "grass", "crop", "bare", "snow", "water", "wetland", "moss"]
FIELDS = ("elevation", "cover", "land", "lake")
PYRAMID = [p for p in PPU if p < WORK_PPU]  # the coarser copies: 8, 4, 2, 1 px per unit
SRC_PAD = 0.15  # degrees of source read around a chunk, for resampling at its edges


def grid():
    return mp.region_grid(REGION, MARGIN, WORK_PPU)


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


def path_geom(d):
    """An SVG path's rings filled even-odd (so its holes are holes), as one shape in map units (None if empty)."""
    polys = [shapely.make_valid(Polygon(r)) for r in parse_rings(d) if len(r) >= 3]
    return functools.reduce(lambda a, b: a.symmetric_difference(b), polys) if polys else None


def game_land_geoms(groups=("regions", "wastelands", "far")):
    """The game's land as shapes in map units: one per region, wasteland and far land (or the given groups)."""
    m = json.loads(MAP_JSON.read_text())
    return [g for group in groups for g in (path_geom(item["path"]) for item in m[group]) if g is not None]


def coverage(geoms, g, ss=4, band=256):
    """How much of each pixel the union of shapes (map units) covers, 0-255, supersampled ss x ss, in bands of rows."""
    x0, y0, x1, y1 = g.x0, g.y0, g.x0 + g.width / g.ppu, g.y0 + g.height / g.ppu
    area = shapely.box(x0, y0, x1, y1)
    hits = [gm for gm in geoms if gm.intersects(area)]
    out = np.zeros((g.height, g.width), dtype=np.uint8)
    if not hits:
        return out
    union = shapely.union_all(hits).intersection(area)
    for r0 in range(0, g.height, band):
        h = min(band, g.height - r0)
        sub = mp.Grid(g.x0, g.y0 + r0 / g.ppu, g.ppu * ss, g.width * ss, h * ss)
        part = union.intersection(shapely.box(x0, sub.y0, x1, sub.y0 + h / g.ppu))
        cov = np.zeros((h, g.width), np.float32)
        if not part.is_empty:
            # Rasterise in the sub-grid's own pixel space: map units → pixels.
            px = shapely.transform(part, lambda c, s=sub: (c - (s.x0, s.y0)) * s.ppu)
            inside = rasterize([(px, 1)], out_shape=(sub.height, sub.width), transform=rasterio.Affine.identity(), fill=0, dtype=np.uint8, all_touched=False)
            cov = inside.astype(np.float32).reshape(h, ss, g.width, ss).mean(axis=(1, 3))
        out[r0 : r0 + h] = np.round(cov * 255).astype(np.uint8)
    return out


def lake_geoms():
    polys = []
    for name in ("ne_10m_lakes.geojson", "ne_10m_lakes_europe.geojson"):
        data = json.loads((SRC_DIR / "naturalearth" / name).read_text())
        for f in data["features"]:
            geom = shape(f["geometry"])
            polys.append(shapely.make_valid(shapely.transform(geom, lambda c: np.column_stack(mp.to_map(c[:, 0], c[:, 1])))))
    # Each lake keeps its own islands; lakes in both files, or touching, are joined (never cancelled).
    return polys


# ---------------------------------------------------------------- the sources, per chunk
class Sources:
    """The cached source tiles (fetch.py), with their bounds, opened as needed."""

    def __init__(self):
        self.tiles = {"etopo": [], "worldcover": []}
        for path in sorted(TILE_CACHE.glob("*.tif")):
            kind = "etopo" if path.name.startswith("ETOPO") else "worldcover"
            with rasterio.open(path) as src:
                self.tiles[kind].append((path, tuple(src.bounds)))

    def mosaic(self, kind, west, south, east, north):
        """The source's pixels over a lon/lat box (merged from the tiles under it), with its transform; None if no
        tile is under it."""
        paths = [p for p, b in self.tiles[kind] if b[0] < east and b[2] > west and b[1] < north and b[3] > south]
        if not paths:
            return None, None
        srcs = [rasterio.open(p) for p in paths]
        try:
            # On the sources' own pixel grid (whole pixels from a tile corner), so nothing is shifted by part of a pixel.
            rx, ry = srcs[0].res
            ox, oy = srcs[0].bounds.left, srcs[0].bounds.top
            west = ox + math.floor(round((west - ox) / rx, 6)) * rx
            east = ox + math.ceil(round((east - ox) / rx, 6)) * rx
            north = oy - math.floor(round((oy - north) / ry, 6)) * ry
            south = oy - math.ceil(round((oy - south) / ry, 6)) * ry
            nodata = np.nan if kind == "etopo" else 0
            data, transform = merge(srcs, bounds=(west, south, east, north), res=(rx, ry), nodata=nodata, dtype="float32" if kind == "etopo" else "uint8")
        finally:
            for s in srcs:
                s.close()
        return data[0], transform


def chunk_grids(g, land):
    """The chunks of the grid within CHUNK_REACH map units of the game's land: (row, col, sub-grid)."""
    out = []
    for r in range(0, g.height, CHUNK * g.ppu):
        for c in range(0, g.width, CHUNK * g.ppu):
            h, w = min(CHUNK * g.ppu, g.height - r), min(CHUNK * g.ppu, g.width - c)
            sub = mp.Grid(g.x0 + c / g.ppu, g.y0 + r / g.ppu, g.ppu, w, h)
            reach = shapely.box(sub.x0 - CHUNK_REACH, sub.y0 - CHUNK_REACH, sub.x0 + w / g.ppu + CHUNK_REACH, sub.y0 + h / g.ppu + CHUNK_REACH)
            if land.intersects(reach):
                out.append((r, c, sub))
    return out


def lonlat_box(sub):
    lon0, lat1 = mp.to_lonlat(sub.x0, sub.y0)
    lon1, lat0 = mp.to_lonlat(sub.x0 + sub.width / sub.ppu, sub.y0 + sub.height / sub.ppu)
    return float(lon0) - SRC_PAD, float(lat0) - SRC_PAD, float(lon1) + SRC_PAD, float(lat1) + SRC_PAD


def elevation(src, sub):
    data, transform = src.mosaic("etopo", *lonlat_box(sub))
    out = np.full((sub.height, sub.width), np.nan, dtype=np.float32)
    if data is not None:
        reproject(source=data, destination=out, src_transform=transform, src_crs="EPSG:4326", src_nodata=np.nan, dst_transform=sub.transform, dst_crs="EPSG:3857", dst_nodata=np.nan, resampling=Resampling.cubic, num_threads=4)
    return np.nan_to_num(out, nan=0.0)  # (only open sea far from land lacks a source tile: it is never drawn)


def cover(src, sub):
    """Class fractions: each class as a 0/255 layer, averaged onto the chunk."""
    out = np.zeros((len(CLASSES), sub.height, sub.width), dtype=np.uint8)
    wc, transform = src.mosaic("worldcover", *lonlat_box(sub))
    if wc is None:
        return out
    for i, name in enumerate(CLASSES):
        codes = [WC[name]] + ([WC["mangrove"]] if name == "wetland" else [])
        layer = np.isin(wc, codes).astype(np.uint8) * 255
        reproject(source=layer, destination=out[i], src_transform=transform, src_crs="EPSG:4326", dst_transform=sub.transform, dst_crs="EPSG:3857", resampling=Resampling.average, num_threads=4)
    return out


# ---------------------------------------------------------------- output
def down(a, f):
    """Mean over f x f blocks of the last two axes."""
    if f == 1:
        return a
    *lead, h, w = a.shape
    return a.reshape(*lead, h // f, f, w // f, f).mean(axis=(-3, -1))


class Out:
    """The grid's arrays and their coarser copies, as memory-mapped .npy files written chunk by chunk."""

    def __init__(self, g, names):
        self.arrays = {}
        for name in names:
            dtype, lead = (np.float32, ()) if name == "elevation" else (np.uint8, (len(CLASSES),) if name == "cover" else ())
            for p in [WORK_PPU] + PYRAMID:
                f = WORK_PPU // p
                path = WORK_DIR / (f"{name}.npy" if p == WORK_PPU else f"{name}_p{p}.npy")
                self.arrays[(name, p)] = np.lib.format.open_memmap(path, mode="w+", dtype=dtype, shape=(*lead, g.height // f, g.width // f))

    def put(self, name, r, c, a):
        for p in [WORK_PPU] + PYRAMID:
            f = WORK_PPU // p
            dst = self.arrays[(name, p)]
            v = down(a.astype(np.float32), f) if f > 1 else a
            if dst.dtype == np.uint8 and f > 1:
                v = np.round(v).astype(np.uint8)
            dst[..., r // f : r // f + v.shape[-2], c // f : c // f + v.shape[-1]] = v

    def flush(self):
        for a in self.arrays.values():
            a.flush()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--masks", action="store_true", help="only rebuild land.npy and lake.npy (and their coarser copies)")
    a = ap.parse_args()
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    g = grid()
    print(f"grid: origin ({g.x0}, {g.y0}) map units, {g.ppu} px/unit, {g.width} x {g.height} px")
    geoms = game_land_geoms()
    land_all = shapely.union_all([gm for gm in geoms if gm.intersects(shapely.box(g.x0, g.y0, g.x0 + g.width / g.ppu, g.y0 + g.height / g.ppu))])
    chunks = chunk_grids(g, land_all)
    print(f"{len(chunks)} chunks of {CHUNK} map units within reach of land")
    lakes = lake_geoms()
    out = Out(g, ("land", "lake") if a.masks else FIELDS)
    src = None if a.masks else Sources()
    for n, (r, c, sub) in enumerate(chunks, 1):
        if not a.masks:
            out.put("elevation", r, c, elevation(src, sub))
            out.put("cover", r, c, cover(src, sub))
        land = coverage(geoms, sub)
        out.put("land", r, c, land)
        out.put("lake", r, c, np.minimum(coverage(lakes, sub), land))
        print(f"  chunk {n}/{len(chunks)}: ({sub.x0:.0f}, {sub.y0:.0f}), land {land.mean() / 2.55:.0f}%", flush=True)
    out.flush()
    (WORK_DIR / "grid.json").write_text(json.dumps({
        "x0": g.x0, "y0": g.y0, "ppu": g.ppu, "width": g.width, "height": g.height,
        "epsg3857_transform": list(g.transform)[:6], "classes": CLASSES, "pyramid": PYRAMID,
        "chunk": CHUNK, "chunks": [[sub.x0, sub.y0, sub.x0 + sub.width / g.ppu, sub.y0 + sub.height / g.ppu] for _, _, sub in chunks],
    }, indent=1))
    print("done")


if __name__ == "__main__":
    main()
