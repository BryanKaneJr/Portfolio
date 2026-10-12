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
MINOR_MIN_LENGTH = 30  # map units (about 130 km): shorter minor rivers are left out


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
            d = path_d(g)
            if not d or d in seen:
                continue
            seen.add(d)
            # Short minor rivers (the low-ranked ones, Natural Earth scalerank 10+) would only crowd the close-up
            # views with stubs; the long ones stay, whatever their rank.
            if float(p.get("scalerank") or 0) >= MINOR_RANK and g.length < MINOR_MIN_LENGTH:
                continue
            w = float(p.get("strokeweig") or 0.4)
            rivers.append({"d": d, "w": round(min(2.2, 0.45 + w * 1.1), 2), "z": float(p.get("min_zoom") or 6), "b": [round(v, 1) for v in g.bounds], "name": p.get("name") or ""})
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
