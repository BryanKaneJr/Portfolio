"""
Step 4: the crisp vector layers drawn over the terrain tiles: rivers and lake shores from Natural Earth 1:10m, in the
game's map units, cut to the game's own coastline (a river ends exactly at the game's shore, never in its sea) and to
the prototype region. Written to src/ui/map/terrainVectors.ts.

Each feature keeps Natural Earth's min_zoom (the web-map zoom from which it is meant to show). The app turns its
camera zoom k (screen points per map unit) into the same scale: a web map at zoom z draws 256 * 2^z points per 360°,
the game draws 17.4 * k points per degree, so z = log2(17.4 * k * 360 / 256).

Run: python scripts/terrain/vectors.py
"""
import json
import math
import re

import numpy as np
import shapely
from shapely.geometry import LineString, MultiLineString, Polygon, box, shape

import mapproj as mp
from config import MAP_JSON, REGION, SRC_DIR, VECTORS_TS

TOLERANCE = 0.06  # map units (about 250 m): simplification, well under a screen pixel at the closest zoom
PAD = 6  # map units of game land considered around the region
MINOR_RANK = 10  # Natural Earth scalerank from which a river counts as minor
MINOR_MIN_LENGTH = 30  # map units (about 130 km): shorter minor rivers are left out, unless they touch a lake
LAKE_TOUCH = 0.5  # map units
SMOOTH_FROM = 1.0  # rivers this wide (points) and up are smoothed: drawn heavier, their coarse 1:10m kinks would show
# Lakes Natural Earth lacks (Hallwil, Sempach...) are taken from ESA WorldCover's water, inland only, so they too are
# drawn as water over the realms' colours instead of showing as tinted smudges in the tiles.
WC_LAKE_MIN_AREA = 0.3  # map units² (about 6 km²)
WC_LAKE_CORE = 0.3  # map units: water within this of a river line, over most of a body, is the river itself
WC_LAKE_COAST = 2.0  # map units from the game's coast, as the tiles keep inland water (render.py)


def river_width(p):
    """Stroke width (points, before the zoom's widening) from the river's Natural Earth rank: the great rivers (the
    Danube, Rhine, Po, Vistula) clearly heavier than their tributaries. Natural Earth's stroke weight is missing in the
    main file and unreliable in the European supplement (a few small rivers there are drawn as heavy as the Danube)."""
    sr = float(p.get("scalerank") or 10)
    return round(max(0.55, min(1.8, 2.0 - 0.13 * sr)), 2)


def parse_rings(d):
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


def game_land(bounds):
    """The game's land near the region as one geometry: each region's, waste's and far land's outline, even-odd."""
    m = json.loads(MAP_JSON.read_text())
    clip = box(*bounds)
    parts = []
    for group in ("regions", "wastelands", "far"):
        for item in m[group]:
            polys = [Polygon(r).buffer(0) for r in parse_rings(item["path"]) if len(r) >= 3]
            if not polys:
                continue
            # Even-odd within one outline: rings inside rings are holes.
            g = polys[0]
            for p in polys[1:]:
                g = g.symmetric_difference(p)
            if g.intersects(clip):
                parts.append(g.intersection(clip))
    return shapely.union_all(parts)


def to_map_geom(geom):
    return shapely.transform(geom, lambda c: np.column_stack(mp.to_map(c[:, 0], c[:, 1])))


def chaikin(coords, passes=2):
    """Corner-cutting smoothing that keeps both ends where they are."""
    pts = np.asarray(coords, float)
    for _ in range(passes):
        if len(pts) < 3:
            break
        q = 0.75 * pts[:-1] + 0.25 * pts[1:]
        r = 0.25 * pts[:-1] + 0.75 * pts[1:]
        mid = np.empty((2 * (len(pts) - 1), 2))
        mid[0::2], mid[1::2] = q, r
        pts = np.vstack([pts[:1], mid[1:-1], pts[-1:]])
    return pts


def smooth(geom):
    lines = [LineString(chaikin(list(line.coords))) for line in getattr(geom, "geoms", [geom]) if isinstance(line, LineString) and len(line.coords) >= 2]
    return MultiLineString(lines) if len(lines) > 1 else (lines[0] if lines else geom)


def worldcover_lakes(land_r, ne_lakes, rivers):
    """Inland water bodies from the prepared WorldCover fractions (prepare.py), as polygons in map units: not Natural
    Earth lakes, not within WC_LAKE_COAST of the game's coast, at least WC_LAKE_MIN_AREA."""
    from rasterio import features
    from scipy import ndimage
    from config import WORK_DIR, WORK_PPU

    g = json.loads((WORK_DIR / "grid.json").read_text())
    water = np.load(WORK_DIR / "cover.npy", mmap_mode="r")[g["classes"].index("water")]
    land = np.load(WORK_DIR / "land.npy", mmap_mode="r")
    mask = (np.asarray(water) > 140) & (np.asarray(land) > 127)
    mask = ndimage.binary_opening(mask, iterations=2)
    coast = ndimage.distance_transform_edt(np.asarray(land) > 127) / WORK_PPU
    mask &= coast >= WC_LAKE_COAST
    transform = __import__("affine").Affine(1 / WORK_PPU, 0, g["x0"], 0, 1 / WORK_PPU, g["y0"])
    out = []
    for geom, v in features.shapes(mask.astype(np.uint8), mask=mask, transform=transform):
        poly = shape(geom)
        if poly.area < WC_LAKE_MIN_AREA:
            continue
        if ne_lakes is not None:
            poly = poly.difference(ne_lakes.buffer(0.3))
        poly = poly.intersection(land_r).simplify(TOLERANCE)
        if poly.is_empty or poly.area < WC_LAKE_MIN_AREA:
            continue
        # A lake, not a stretch of wide river: no Natural Earth river runs along most of it.
        if rivers is not None and poly.intersection(rivers.buffer(WC_LAKE_CORE)).area > 0.4 * poly.area:
            continue
        out.append(poly)
    return out


def path_d(geom):
    out = []
    for line in getattr(geom, "geoms", [geom]):
        if line.is_empty:
            continue
        coords = list(line.coords) if isinstance(line, LineString) else list(line.exterior.coords)
        if len(coords) < 2:
            continue
        out.append("M" + "L".join(f"{x:.2f} {y:.2f}" for x, y in coords))
    return "".join(out)


def load(name):
    return json.loads((SRC_DIR / "naturalearth" / name).read_text())["features"]


def main():
    rb = REGION
    bounds = (rb[0] - PAD, rb[1] - PAD, rb[2] + PAD, rb[3] + PAD)
    land = game_land(bounds)
    region = box(*rb)
    land_r = land.intersection(region)
    print(f"game land in region: {land_r.area:.0f} square map units")

    lakes = []
    lake_union = []
    for name in ("ne_10m_lakes.geojson", "ne_10m_lakes_europe.geojson"):
        for f in load(name):
            g = to_map_geom(shape(f["geometry"]))
            if not g.intersects(region):
                continue
            g = g.intersection(land_r)
            if g.is_empty or g.area < 0.05:
                continue
            g = g.simplify(TOLERANCE)
            p = f["properties"]
            lake_union.append(g)
            rings = []
            for poly in getattr(g, "geoms", [g]):
                if isinstance(poly, Polygon):
                    rings.append(poly.exterior)
                    rings.extend(poly.interiors)
            d = "".join("M" + "L".join(f"{x:.2f} {y:.2f}" for x, y in r.coords) + "Z" for r in rings)
            lakes.append({"d": d, "z": float(p.get("min_zoom") or 0), "b": [round(v, 1) for v in g.bounds], "name": p.get("name") or ""})
    lake_geom = shapely.union_all(lake_union) if lake_union else None

    rivers = []
    river_geoms = []
    seen = set()
    for name in ("ne_10m_rivers_lake_centerlines.geojson", "ne_10m_rivers_europe.geojson"):
        for f in load(name):
            p = f["properties"]
            if "Lake" in (p.get("featurecla") or ""):
                continue  # centre-lines through lakes: the lake is drawn instead
            g = to_map_geom(shape(f["geometry"]))
            if not g.intersects(region):
                continue
            g = g.intersection(land_r)
            if lake_geom is not None:
                g = g.difference(lake_geom)
            if g.is_empty:
                continue
            g = g.simplify(TOLERANCE)
            if river_width(p) >= SMOOTH_FROM:
                g = smooth(g)
            d = path_d(g)
            if not d or d in seen:
                continue
            seen.add(d)
            river_geoms.append(g)
            # Short minor rivers (the low-ranked ones, Natural Earth scalerank 10+) would only crowd the close-up
            # views with stubs; the long ones stay, whatever their rank, and so does any that runs into a lake (so
            # a lake keeps its inflow and outflow, like the Aare, Reuss and Limmat on the Swiss plateau).
            minor = float(p.get("scalerank") or 0) >= MINOR_RANK and g.length < MINOR_MIN_LENGTH
            if minor and (lake_geom is None or g.distance(lake_geom) > LAKE_TOUCH):
                continue
            rivers.append({"d": d, "w": river_width(p), "z": float(p.get("min_zoom") or 6), "b": [round(v, 1) for v in g.bounds], "name": p.get("name") or ""})
    wc = worldcover_lakes(land_r, lake_geom, shapely.union_all(river_geoms) if river_geoms else None)
    for g in wc:
        rings = []
        for poly in getattr(g, "geoms", [g]):
            if isinstance(poly, Polygon):
                rings.append(poly.exterior)
                rings.extend(poly.interiors)
        d = "".join("M" + "L".join(f"{x:.2f} {y:.2f}" for x, y in r.coords) + "Z" for r in rings)
        # Shown from about play zoom (bigger ones a little sooner), like Natural Earth's smaller lakes.
        lakes.append({"d": d, "z": 6.0 if g.area >= 2 else 6.7 if g.area >= 0.5 else 7.0, "b": [round(v, 1) for v in g.bounds], "name": "(WorldCover)"})
    print(f"{len(wc)} lakes from WorldCover added")
    rivers.sort(key=lambda r: (r["z"], -r["w"]))
    print(f"{len(rivers)} rivers, {len(lakes)} lakes")
    lines = [
        "/**",
        " * Rivers and lake shores over the illustrated terrain (scripts/terrain/vectors.py): Natural Earth 1:10m in map",
        " * units, cut to the game's own coastline and to the terrain region. Per feature: its path, stroke width (points),",
        " * the web-map zoom it shows from (z) and its bounding box. Generated: do not edit by hand.",
        " */",
        "export interface TerrainLine {",
        "  d: string;",
        "  w: number;",
        "  z: number;",
        "  b: [number, number, number, number];",
        "}",
        "export const TERRAIN_RIVERS: TerrainLine[] = [",
    ]
    for r in rivers:
        lines.append(f"  {{ d: '{r['d']}', w: {r['w']}, z: {r['z']}, b: [{', '.join(str(v) for v in r['b'])}] }},")
    lines.append("];")
    lines.append("export const TERRAIN_LAKES: TerrainLine[] = [")
    for l in lakes:
        lines.append(f"  {{ d: '{l['d']}', w: 0.6, z: {l['z']}, b: [{', '.join(str(v) for v in l['b'])}] }},")
    lines.append("];")
    VECTORS_TS.write_text("\n".join(lines) + "\n")
    print(f"wrote {VECTORS_TS} ({VECTORS_TS.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
