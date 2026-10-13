"""
Step 3: render the illustrated terrain tiles from the canonical rasters (prepare.py) and the symbol library
(symbols.py), level by level, and write the tile index the app reads.

Each level is drawn from the data at that level's own resolution, so it carries the detail that resolution can hold:
relief shading from the elevation averaged to the level's pixels, and trees placed in the real forests. Nothing is
magnified from a coarser level. Mountains and hills are features: one list of summits chosen once for the whole
region, each drawn at every level from the first one that shows it, sized in screen points (see features()). Every
random choice is a hash of a global position, so a rebuild draws the same map, and a tile and its neighbour agree
pixel for pixel at their shared edge (big levels are drawn in bands of tile rows, each with a halo wider than any
filter or symbol).

Land and sea come from the game's own coastline (land.npy): the terrain is painted to it, never the other way round.

Run:  python scripts/terrain/render.py                    all levels → assets/map/terrain + src/ui/map/terrainTiles.ts
                                                          (and the peaks → terrainPeaks.ts, assets/map/terrain/peaks)
      python scripts/terrain/render.py --peaks            only the peaks the app draws (seconds)
      python scripts/terrain/render.py --index            only the tile index, for the tiles on disk
      python scripts/terrain/render.py --preview L x0 y0 x1 y1 out.png    one box of one level (map units)
"""
import argparse
import json
import math
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor

import numpy as np
import shapely
import skia
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import cKDTree

import mapproj as mp
import symbols as sym
import prepare
from config import EDGE_MATCH, L4_SKIP, MAP_JSON, META_JSON, PEAKS_TS, PPU, REGION, ROOT, TILE, TILE_DIR, TILES_TS, WORK_DIR, WORK_PPU

HALO = 8  # map units drawn around each band and thrown away: wider than any filter or symbol at any level
LIGHT_AZ = math.radians(315)  # from the north-west
LIGHT_ALT = math.radians(45)
Z = [3.2, 2.6, 2.1, 1.8, 1.6]  # relief exaggeration per level (coarser levels need more to read)
QUALITY = 84

# ---------------------------------------------------------------- palette (sRGB 0-255)
PAPER = np.array([236, 225, 198], np.float32)
COVER_COLOURS = {
    "tree": [178, 184, 132],
    "shrub": [208, 200, 156],
    "grass": [216, 213, 166],
    "crop": [228, 216, 176],
    "bare": [232, 214, 174],
    "snow": [244, 244, 238],
    "water": [176, 198, 196],
    "wetland": [196, 200, 164],
    "moss": [206, 202, 176],
}
DEFAULT_LAND = np.array([226, 216, 178], np.float32)
UPLAND = np.array([212, 196, 160], np.float32)
ROCK = np.array([198, 188, 170], np.float32)
# Water: the sea comes from EDGE_MATCH (the style's own sea colour and depth shading), lakes from LAKE.
LAKE = np.array([152, 184, 200], np.float32)
SHADOW = np.array([96, 78, 58], np.float32)
FOREST_WASH = np.array([150, 160, 106], np.float32)
CANOPY = np.array([128, 138, 90], np.float32)
CANOPY_EDGE = np.array([62, 70, 44], np.float32)


# ---------------------------------------------------------------- deterministic noise
def hash01(ix, iy, salt):
    """A repeatable 0..1 per integer lattice point (vectorised; uint64 arithmetic wraps by design)."""
    with np.errstate(over="ignore"):
        h = np.asarray(ix, np.int64).astype(np.uint64) * np.uint64(0x9E3779B97F4A7C15)
        h ^= np.asarray(iy, np.int64).astype(np.uint64) * np.uint64(0xC2B2AE3D27D4EB4F)
        h ^= np.uint64((salt * 0x165667B19E3779F9) & 0xFFFFFFFFFFFFFFFF)
        h ^= h >> np.uint64(33)
        h *= np.uint64(0xFF51AFD7ED558CCD)
        h ^= h >> np.uint64(33)
        h *= np.uint64(0xC4CEB9FE1A85EC53)
        h ^= h >> np.uint64(33)
    return (h >> np.uint64(11)).astype(np.float64) / float(1 << 53)


def value_noise(gx0, gy0, w, h, cell, salt):
    """Smooth noise over global pixels [gx0, gx0+w) x [gy0, gy0+h), lattice spacing `cell` px: continuous across
    tiles and bands because it depends only on global pixel positions."""
    xs = (gx0 + np.arange(w)) / cell
    ys = (gy0 + np.arange(h)) / cell
    ix0 = np.floor(xs).astype(np.int64)
    iy0 = np.floor(ys).astype(np.int64)
    fx = xs - ix0
    fy = ys - iy0
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    X0, Y0 = np.meshgrid(ix0, iy0)
    FX, FY = np.meshgrid(fx, fy)
    a = hash01(X0, Y0, salt)
    b = hash01(X0 + 1, Y0, salt)
    c = hash01(X0, Y0 + 1, salt)
    d = hash01(X0 + 1, Y0 + 1, salt)
    return ((a * (1 - FX) + b * FX) * (1 - FY) + (c * (1 - FX) + d * FX) * FY).astype(np.float32)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- data at a level
class Data:
    """The prepared grid (prepare.py): the canonical arrays at WORK_PPU and their coarser copies, memory-mapped."""

    def __init__(self):
        self.grid = json.loads((WORK_DIR / "grid.json").read_text())
        self.classes = self.grid["classes"]
        self._arrays = {}
        self.elev = self.array("elevation", WORK_PPU)
        self.land = self.array("land", WORK_PPU)

    def array(self, name, ppu):
        if (name, ppu) not in self._arrays:
            path = WORK_DIR / (f"{name}.npy" if ppu == WORK_PPU else f"{name}_p{ppu}.npy")
            self._arrays[(name, ppu)] = np.load(path, mmap_mode="r")
        return self._arrays[(name, ppu)]

    def fields(self, box, ppu):
        """Every field over map box (x0, y0, x1, y1) at `ppu` px/unit (the grid's copy at that resolution)."""
        g = self.grid
        c0 = int(round((box[0] - g["x0"]) * ppu))
        r0 = int(round((box[1] - g["y0"]) * ppu))
        c1 = int(round((box[2] - g["x0"]) * ppu))
        r1 = int(round((box[3] - g["y0"]) * ppu))
        f = WORK_PPU // ppu
        assert c0 >= 0 and r0 >= 0 and c1 * f <= g["width"] and r1 * f <= g["height"], f"box {box} outside the prepared grid"

        def get(name, i=None):
            a = self.array(name, ppu)
            return np.asarray(a[r0:r1, c0:c1] if i is None else a[i, r0:r1, c0:c1], np.float32)

        out = {"elev": get("elevation"), "land": get("land") / 255.0, "lake": get("lake") / 255.0}
        for i, name in enumerate(self.classes):
            out[name] = get("cover", i) / 255.0
        return out


# ---------------------------------------------------------------- painting a box
def relief(elev, rows_lat, ppu, z):
    """Hillshade (0-1, flat = cos of the light's zenith) and slope (degrees), from elevation in metres."""
    m = (mp.km_per_unit(rows_lat) * 1000 / ppu)[:, None]  # ground metres per pixel, per row (Mercator is conformal)
    e = ndimage.gaussian_filter(elev, 0.7)
    gy, gx = np.gradient(e)
    gx = gx / m * z
    gy = gy / m * z
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)  # direction the slope faces, from north, clockwise (y grows southward)
    zen = math.pi / 2 - LIGHT_ALT
    hs = np.cos(zen) * np.cos(slope) + np.sin(zen) * np.sin(slope) * np.cos(LIGHT_AZ - aspect)
    return np.clip(hs, 0, 1).astype(np.float32), np.degrees(slope).astype(np.float32)


def paint_base(F, box, level, gx0, gy0):
    """The painted ground: land colour from cover and height, relief shading, forest wash, water, paper grain."""
    ppu = PPU[level]
    h, w = F["elev"].shape
    ys = box[1] + (np.arange(h) + 0.5) / ppu
    lat = mp.to_lonlat(0, ys)[1]
    land = np.clip(F["land"], 0, 1)
    # Land: a blend of the cover classes' colours (cover not in a class: the default farmland/parchment).
    rgb = np.zeros((h, w, 3), np.float32)
    total = np.zeros((h, w), np.float32)
    for name, col in COVER_COLOURS.items():
        frac = F[name]
        if name == "water":
            continue  # inland water is painted below, away from the coast
        rgb += frac[..., None] * np.array(col, np.float32)
        total += frac
    rest = np.clip(1 - total, 0, 1)
    rgb += rest[..., None] * DEFAULT_LAND
    rgb /= np.maximum(total + rest, 1e-6)[..., None]
    e = np.maximum(F["elev"], 0)
    rgb = rgb + (UPLAND - rgb) * (0.55 * smoothstep(500, 1700, e))[..., None]
    rgb = rgb + (ROCK - rgb) * (0.7 * smoothstep(1700, 2800, e) * (1 - F["tree"]))[..., None]
    snow = np.clip(F["snow"] * 1.4 + 0.6 * smoothstep(2900, 3600, e), 0, 1)
    rgb = rgb + (np.array(COVER_COLOURS["snow"], np.float32) - rgb) * snow[..., None]
    # A forest wash, so the gaps between the trees still read as woodland. On the coarse levels, where single trees
    # would only speckle the map, the forest is drawn as a canopy: a stippled mass with a darker, inked edge.
    forest = ndimage.gaussian_filter(F["tree"], 1.0)
    if TREE_PX[level] == 0:
        canopy = smoothstep(0.42, 0.68, ndimage.gaussian_filter(F["tree"], 1.6))
        stipple = value_noise(gx0, gy0, w, h, 1.5, 31)
        crowns = np.clip(canopy * (0.7 + 0.45 * stipple), 0, 1)
        rgb = rgb + (CANOPY - rgb) * (0.58 * crowns)[..., None]
        edge = np.clip(np.hypot(*np.gradient(canopy)) * 1.6, 0, 1)
        rgb = rgb + (CANOPY_EDGE - rgb) * (0.28 * edge)[..., None]
    else:
        rgb = rgb + (FOREST_WASH - rgb) * (0.5 * smoothstep(0.3, 0.7, forest))[..., None]
    # Relief: shade the slopes away from the light, lift those toward it.
    hs, slope = relief(np.where(land > 0.5, e, 0).astype(np.float32), lat, ppu, Z[level])
    flat = math.cos(math.pi / 2 - LIGHT_ALT)
    calm = 1 - CALM_HIGH[level] * smoothstep(1000, 1800, e)
    shadow = np.clip((flat - hs) / flat, 0, 1) * calm
    lit = np.clip((hs - flat) / (1 - flat), 0, 1) * calm
    rgb = rgb + (SHADOW - rgb) * (0.62 * shadow)[..., None]
    rgb = rgb + (PAPER * 1.04 - rgb) * (0.4 * lit)[..., None]
    # Inland water (wide rivers, lakes not in Natural Earth), kept well away from the game's coast so the
    # datasets' differing coastlines never show as water on the game's land.
    coast_px = ndimage.distance_transform_edt(land > 0.5)
    inland = smoothstep(2.0 * ppu, 3.0 * ppu, coast_px)
    water = np.clip(np.maximum(F["water"] * inland, F["lake"]), 0, 1)
    rgb = rgb + (LAKE - rgb) * (0.9 * smoothstep(0.35, 0.75, water))[..., None]
    # Sea: by depth (the game says sea where ETOPO has land: shallow), lightly shaded by the sea floor.
    # Sea: one rule inside the tiles and out (the app draws the same picture past the region): the style's sea colour,
    # darkened over deep water by the game's own depth shading, never lightened in the shallows (so a lagoon is never
    # paler than the land beside it). Computed on a coarse grid and enlarged: the shading is smooth.
    sea = sea_colour(box, ppu, h, w)
    # Near the region's edge the sea turns into the sea the game draws outside it.
    edge = edge_weight(box, ppu, h, w)
    if edge.any():
        sea = outside_sea(sea, edge, box, ppu)
    # Paper grain on the land, the same on every tile: two octaves of noise on global pixel positions. (Not on the sea,
    # which is exactly the app's own, so a tile left out over open sea shows no seam.)
    grain = 0.5 * value_noise(gx0, gy0, w, h, 3.0, 11) + 0.5 * value_noise(gx0, gy0, w, h, 23.0, 12)
    rgb *= (0.955 + 0.06 * grain)[..., None]
    out = rgb * land[..., None] + sea * (1 - land)[..., None]
    # What the style covers with its parchment (the wastes, the unknown waters, past the map's edge) is left plain.
    hid = hidden_mask(box, ppu, h, w)
    if hid is not None:
        out = out * (1 - hid)[..., None] + sea * hid[..., None]
    return np.clip(out, 0, 255), slope, water, land, edge


# ---------------------------------------------------------------- where tiles are made
REACH = 16  # map units: a tile is made if, grown by this much, it shows the game's known land (or the sea near it)
HIDE_IN = 1.0  # map units: how far inside the parchment's edge the ground is left plain
_COVER = {}


def cover_geoms():
    """The game's known land (its regions: not the wastes or the far lands), prepared for fast tests, and what the
    style hides under its parchment (the wastes and the unknown waters, a little inside their edges, and everything
    past the map's edge)."""
    if not _COVER:
        m = json.loads(MAP_JSON.read_text())
        regions = {r["id"]: prepare.path_geom(r["path"]) for r in m["regions"]}
        known = shapely.union_all([g for g in regions.values() if g is not None])
        fine = shapely.union_all([g for k, g in regions.items() if g is not None and k not in L4_SKIP])
        hide = prepare.game_land_geoms(("wastelands",))
        unknown = prepare.path_geom(m["unknownWater"])
        if unknown is not None:
            hide.append(unknown)
        hidden = shapely.union_all(hide).buffer(-HIDE_IN)
        outside = shapely.box(-1e4, -1e4, 2e4, 2e4).difference(shapely.box(0, 0, mp.W, mp.H))
        hidden = shapely.union_all([hidden, outside])
        for g in (known, fine, hidden):
            shapely.prepare(g)
        _COVER.update(known=known, fine=fine, hidden=hidden)
    return _COVER["known"], _COVER["hidden"]


def finest_land():
    """The known land the finest level is made for (every region but L4_SKIP's)."""
    cover_geoms()
    return _COVER["fine"]


def hidden_mask(box, ppu, h, w):
    """How much of each pixel of a box (at a level) the style's parchment covers, 0-1; None if none of it."""
    _, hidden = cover_geoms()
    b = shapely.box(*box)
    if not hidden.intersects(b):
        return None
    g = mp.Grid(box[0], box[1], ppu, w, h)
    return prepare.coverage([hidden], g, ss=2).astype(np.float32) / 255.0


def edge_weight(box, ppu, h, w):
    """1 at the region's edge, 0 from EDGE_MATCH's band inward (smooth), per pixel of a box."""
    band = EDGE_MATCH["band_units"]
    xs = box[0] + (np.arange(w) + 0.5) / ppu
    ys = box[1] + (np.arange(h) + 0.5) / ppu
    dx = np.minimum(xs - REGION[0], REGION[2] - xs)
    dy = np.minimum(ys - REGION[1], REGION[3] - ys)
    d = np.minimum(dy[:, None], dx[None, :])
    return (1 - smoothstep(0, band, d)).astype(np.float32)


_OUTSIDE = {}


def shade_image(soft=False):
    """The depth shading the Illustrated style draws over its sea (TERRAIN_SEA_SHADE): the game's baked sea depth
    (assets/map/relief-sea*.png, grey + alpha, white over shallows and black over deep water) with only the darkening
    kept. Written next to the tiles by write_shade_images()."""
    src = Image.open(ROOT / ("assets/map/relief-sea-soft.png" if soft else "assets/map/relief-sea.png")).convert("LA")
    a = np.asarray(src, np.uint8)
    alpha = np.where(a[..., 0] < 128, a[..., 1], 0).astype(np.uint8)
    return np.stack([np.zeros_like(alpha), alpha], axis=-1)


def write_shade_images():
    for soft, name in ((False, "sea-shade.png"), (True, "sea-shade-soft.png")):
        Image.fromarray(shade_image(soft), "LA").save(TILE_DIR / name, optimize=True)


def sea_colour(box, ppu, h, w):
    """The sea over a box: EDGE_MATCH's colour under the dark-only depth shading at EDGE_MATCH's opacity, as the app
    draws it (bilinear over the whole map), sampled at up to 2 px per unit and enlarged."""
    if not _OUTSIDE:
        im = np.asarray(Image.open(ROOT / EDGE_MATCH["relief_image"]).convert("LA"), np.float32) / 255.0
        _OUTSIDE["grey"], _OUTSIDE["alpha"] = im[..., 0], im[..., 1]
        _OUTSIDE["base"] = np.array([int(EDGE_MATCH["sea"][i : i + 2], 16) for i in (1, 3, 5)], np.float32)
    f = max(1, ppu // 2)
    hc, wc = -(-h // f), -(-w // f)
    ys = box[1] + (np.arange(hc) + 0.5) * f / ppu
    xs = box[0] + (np.arange(wc) + 0.5) * f / ppu
    grey, alpha = _OUTSIDE["grey"], _OUTSIDE["alpha"]
    v = ys[:, None] * grey.shape[0] / mp.H - 0.5
    u = xs[None, :] * grey.shape[1] / mp.W - 0.5
    vv, uu = np.broadcast_arrays(v, u)
    g = ndimage.map_coordinates(grey, [vv.ravel(), uu.ravel()], order=1, mode="nearest").reshape(hc, wc)
    a = ndimage.map_coordinates(alpha, [vv.ravel(), uu.ravel()], order=1, mode="nearest").reshape(hc, wc) * EDGE_MATCH["relief"]
    col = _OUTSIDE["base"][None, None, :] * (1 - a)[..., None] + (g * 255)[..., None] * a[..., None]
    if f > 1:
        col = np.stack([ndimage.zoom(col[..., i], f, order=1)[:h, :w] for i in range(3)], axis=-1)
    return col.astype(np.float32)


def outside_sea(sea, edge, box, ppu):
    """Blend the tiles' sea toward what the game paints outside the region: the style's sea colour under the baked
    depth shading (a grey + alpha picture of the whole map, stretched over it and sampled bilinearly, as the app does)."""
    if not _OUTSIDE:
        im = np.asarray(Image.open(ROOT / EDGE_MATCH["relief_image"]).convert("LA"), np.float32) / 255.0
        _OUTSIDE["grey"], _OUTSIDE["alpha"] = im[..., 0], im[..., 1]
        _OUTSIDE["base"] = np.array([int(EDGE_MATCH["sea"][i : i + 2], 16) for i in (1, 3, 5)], np.float32)
    grey, alpha = _OUTSIDE["grey"], _OUTSIDE["alpha"]
    mw, mh = mp.W, mp.H
    rows, cols = np.nonzero(edge > 0)
    u = (box[0] + (cols + 0.5) / ppu) * grey.shape[1] / mw - 0.5
    v = (box[1] + (rows + 0.5) / ppu) * grey.shape[0] / mh - 0.5
    g = ndimage.map_coordinates(grey, [v, u], order=1, mode="nearest")
    a = ndimage.map_coordinates(alpha, [v, u], order=1, mode="nearest") * EDGE_MATCH["relief"]
    outside = _OUTSIDE["base"][None, :] * (1 - a)[:, None] + (g * 255)[:, None] * a[:, None]
    e = edge[rows, cols][:, None]
    sea[rows, cols] = sea[rows, cols] * (1 - e) + outside * e
    return sea


def ripples(canvas_rgb, land, water_inland, ppu, edge):
    """Coastal ripple lines in the sea (and one in lakes): thin lines at fixed distances from the shore, fading out
    at the region's edge with the rest of the tiles' own sea."""
    sea = land < 0.5
    d = ndimage.distance_transform_edt(sea)
    lines = np.zeros_like(d, np.float32)
    for dist, a in ((3.5, 0.32), (7.5, 0.2), (12.5, 0.11)):
        lines = np.maximum(lines, a * np.clip(1 - np.abs(d - dist) / 0.75, 0, 1))
    lines *= sea * (1 - edge)
    lake = water_inland > 0.55
    if lake.any():
        dl = ndimage.distance_transform_edt(lake)
        lines = np.maximum(lines, 0.22 * np.clip(1 - np.abs(dl - 2.5) / 0.7, 0, 1) * lake)
    ink = np.array([78, 104, 118], np.float32)
    canvas_rgb += (ink - canvas_rgb) * lines[..., None]
    return canvas_rgb


# ---------------------------------------------------------------- symbols
def jitter_grid(gx0, gy0, w, h, spacing, salt):
    """One candidate point per `spacing`-px cell of the level's global pixel lattice, jittered within the cell.
    Returns global and local pixel coordinates and a per-point random value."""
    i0 = int(math.floor(gx0 / spacing))
    j0 = int(math.floor(gy0 / spacing))
    i1 = int(math.ceil((gx0 + w) / spacing))
    j1 = int(math.ceil((gy0 + h) / spacing))
    I, J = np.meshgrid(np.arange(i0, i1), np.arange(j0, j1))
    gx = (I + 0.15 + 0.7 * hash01(I, J, salt)) * spacing
    gy = (J + 0.15 + 0.7 * hash01(J, I, salt + 1)) * spacing
    u = hash01(I, J, salt + 2)
    lx = gx - gx0
    ly = gy - gy0
    keep = (lx >= 0) & (ly >= 0) & (lx < w) & (ly < h)
    return gx[keep], gy[keep], lx[keep], ly[keep], u[keep], I[keep], J[keep]


# Symbols are sized for a phone. The app picks the level by zoom x screen density (terrainLayer.ts), so on a 3x screen
# each level is shown at about 0.6-1.2 device pixels per tile pixel: a tile pixel is 0.2-0.4 points. Tree, marsh and
# grass sizes and spacings below are in tile pixels and scaled by SYM so the drawings read at that size (a tree about
# 3-6 points tall). Mountains and hills are features with their own rules (below).
SYM = 2.2
TREE_PX = [0, 0, 5.8 * SYM, 6.2 * SYM, 6.6 * SYM]  # tree height, px, per level (levels 0-1 draw the forest as a canopy)
# Density per level. The finest levels, the ones seen close up, are thinned so single shapes stay apart: wider spacing
# for trees, grass and marsh (SPREAD; density goes as 1 / SPREAD^2), and on high ground fewer trees again (HIGH_THIN:
# the share dropped by 1600 m, easing in from 700 m), since mountain country is the busiest.
SPREAD = [1.0, 1.0, 1.0, 1.18, 1.2]
HIGH_THIN = [0.0, 0.0, 0.0, 0.28, 0.32]  # trees
# Trees from this much forest cover up (fewer stray single trees in open farmland close up).
TREE_FROM = [0.4, 0.4, 0.4, 0.44, 0.47]
# On high ground the fine relief is calmed by this share, so the gaps between peaks read as quiet ground.
CALM_HIGH = [0.0, 0.0, 0.2, 0.3, 0.35]

# ---------------------------------------------------------------- mountains and hills: features, not a fill
# Mountains are drawn the way an atlas draws them: as the features of a range, not a texture over it. One ranked list
# of summits is made for the whole region, once, in map units (so every level makes the same choice), and each level
# draws the top of that list under its own spacing. A peak drawn at one level is drawn at every finer one, in the same
# place, with the same shape and tier: zooming in only adds lesser peaks in the gaps along the same crests.
# - Where: only on the ranges the Atlas style lays its mountain drawings on (ranges(): build-terrain.ts isMountain and
#   rangeField), at summits near the top of the ground around them (CREST within 8 units, PEAK_SHARE within 40) and
#   well above its low ground (PEAK_RELIEF), so valleys, basins and plateaus stay bare and each range shows its own
#   main crests.
# - Which first: by score, a summit's height plus a bonus for its isolation (how far it is to any higher summit).
# - Tiers: the top tier is each range's few highest isolated massifs (TOP_*), the middle tier the other high peaks
#   (MID_SCORE), the rest are small. Heights go 1 : 0.72 : 0.5 (TIER).
# - Sizes are set in screen points. Each level is mostly seen at one zoom (VIEW_K: level 2 at play zoom, where it is
#   opaque and most magnified, level 3 at close zoom, level 4 at the closest), and its glyphs are sized for that.
# - Levels 0-1 are seen far out, where the Atlas style draws no mountains either: relief shading only. No level draws
#   stand-alone hachures: the relief shading carries the slopes.
# - Hills: a few on each notable upland off the ranges (Massif Central, Jura, Vosges, Black Forest...), none on the
#   ranges or the farmland.
# - Names: no glyph within NAME_PAD points of a region's name, at the zoom each level is drawn at (NAME_K), except a
#   top-tier massif.
FEAT_PPU = 4  # px per map unit of the summit analysis (about 1.1 km)
VIEW_K = [0.45, 0.9, 1.7, 3.2, 5.0]  # the zoom (points per map unit) each level is sized for
PEAK_PT = [0, 0, 12.0, 15.0, 17.0]  # the top tier's height, points at VIEW_K, per level (0: no peaks)
TIER = (1.0, 0.72, 0.5)  # top, middle, small
PEAK_SPACE = [0, 0, 12.5, 9.5, 8.5]  # map units, at least, between two peaks' summits
PEAK_CROWD = (60, 4)  # at most this many peaks in any square this many points wide, at VIEW_K
PEAK_FLOOR = [0, 0, 1800, 1600, 1450]  # metres, the summit's own height (the finest data), at least
PEAK_SHARE = [1, 1, 0.7, 0.62, 0.55]  # of the highest ground within 40 units, at least
CREST = [1, 1, 0.85, 0.8, 0.75]  # of the highest ground within 8 units, at least
PEAK_RELIEF = 950  # metres above the lowest ground within 8 units, at least (no peaks on the plateaus)
ISO_BONUS = 300  # score: metres per doubling of isolation (from 4 units, capped at 64)
TOP_ISO = 11.5  # top tier: no higher summit within this many map units,
TOP_SHARE = 0.78  # ...this share as high as the highest ground within 60 units, at least,
TOP_E = 1900  # ...this high (m, smoothed), at least,
TOP_SPACE = 15  # ...this far from another top-tier massif (map units),
TOP_AREA = 1500  # ...and one per this many square units of its range's core, up to TOP_MAX
TOP_MAX = 6
MID_SCORE = 3000  # middle tier: the other summits scoring this much, at least
OUTLINE_PT = 1.0  # glyph outline, points on screen
HILL_PT = [0, 0, 10.0, 13.0, 16.0]  # hill width, points at VIEW_K, per level (0: no hills)
HILL_SPACE = [0, 0, 11.0, 8.0, 6.0]  # map units between hills, at least
HILL_E = [0, 0, 1150, 1000, 900]  # the least height (m, smoothed) for a hill, per level
HILL_CAP = [0, 0, 3, 5, 8]  # hills per upland, at most
HILL_OFF = 3  # map units a hill keeps off the ranges
NAME_K = [1.15, 1.15, 1.6, 2.4, 4.0]  # the zoom each level's names are measured at (about where it turns opaque)
NAME_PAD = 5  # points

_FEATURES = {}


def ranges(e1, land1):
    """The mountain ranges at one pixel per map unit, found as the Atlas style finds them (build-terrain.ts):
    the mountains (isMountain: very high ground, or high ground with much relief within 8 units), and the ranges they
    make (rangeField: grown a little over the rugged land joined to them, small gaps closed, specks dropped). Returns
    the ranges' mask, and the mountains' cores labelled one per massif with each label's area in square units."""
    on = land1 > 0.5
    rug = ndimage.maximum_filter(e1, 17) - ndimage.minimum_filter(e1, 17)
    core = on & ((e1 >= 1900) | ((e1 >= 700) & (rug >= 1150)) | ((e1 >= 1400) & (rug >= 900)))
    m = core.copy()
    foot = on & (e1 >= 600) & (rug >= 800)
    for _ in range(10):
        m |= ndimage.binary_dilation(m) & foot
    m = ndimage.binary_erosion(ndimage.binary_dilation(m, np.ones((5, 5), bool)), np.ones((5, 5), bool), border_value=1)
    m = ndimage.binary_dilation(ndimage.binary_erosion(m, np.ones((3, 3), bool), border_value=1), np.ones((3, 3), bool))
    m = (ndimage.uniform_filter(ndimage.uniform_filter(m.astype(np.float32), 5), 5) >= 0.5) & on
    lab, n = ndimage.label(m)
    m &= (np.bincount(lab.ravel(), minlength=n + 1) >= 60)[lab]
    core = ndimage.binary_erosion(ndimage.binary_dilation(core, np.ones((3, 3), bool)), np.ones((3, 3), bool), border_value=1) & m
    lab, n = ndimage.label(core)
    area = np.bincount(lab.ravel(), minlength=n + 1).astype(np.float64)
    drop = area < 60
    drop[0] = True
    lab[drop[lab]] = 0
    return m, lab, area


def name_boxes(k):
    """Every region name the game writes at zoom k, as a box in map units grown by NAME_PAD points (MapView.tsx:
    nameSize, NAME_EM; the name's baseline sits 0.35 of its size below the label point)."""
    names = {r["id"]: r["name"] for r in json.loads((ROOT / "src/content/regions.json").read_text())}
    out = []
    for r in mp._map["regions"]:
        if r["labelRadius"] * k < 13 or r["id"] not in names:
            continue
        fs = max(9.0, min(14.0, r["labelRadius"] * k * 0.42))
        half = (len(names[r["id"]]) * fs * 0.68 / 2 + NAME_PAD) / k
        x, y = r["label"]
        out.append((x - half, y - (0.4 * fs + NAME_PAD) / k, x + half, y + (0.35 * fs + NAME_PAD) / k))
    return np.array(out, np.float64).reshape(-1, 4)


def glyph_px(level, tier):
    """A peak's height in a level's pixels."""
    return PEAK_PT[level] * TIER[tier] * PPU[level] / VIEW_K[level]


def features():
    """The region's mountains and hills, chosen once for every level: (x, y, kind, tier, level, seed, snow) with the
    summit at (x, y) in map units and `level` the coarsest level that draws it."""
    if "all" in _FEATURES:
        return _FEATURES["all"]
    data = Data()
    g = data.grid
    P = FEAT_PPU

    def down(a, n):
        h, w = a.shape[0] // n, a.shape[1] // n
        return np.asarray(a[: h * n, : w * n], np.float32).reshape(h, n, w, n).mean(axis=(1, 3))

    e = np.maximum(np.asarray(data.array("elevation", P), np.float32), 0)
    land = np.asarray(data.array("land", P), np.float32) / 255.0
    es = ndimage.gaussian_filter(e, 1.0)
    e1 = down(e, P)
    on_range, core, core_area = ranges(e1, down(land, P))
    off_range = ndimage.distance_transform_edt(~on_range)  # map units to the nearest range
    upland, _ = ndimage.label((e1 >= 650) & ~on_range)
    # Candidates: the highest point within 1.5 units, on land.
    rs, cs = np.nonzero((es >= ndimage.maximum_filter(es, size=int(3 * P) | 1) - 1e-3) & (es > 500) & (land > 0.9))
    el = es[rs, cs].astype(np.float64)
    X = g["x0"] + (cs + 0.5) / P
    Y = g["y0"] + (rs + 0.5) / P
    n = len(el)
    rank = np.empty(n, np.int64)
    rank[np.lexsort((X, Y, -el))] = np.arange(n)  # highest first; ties by position
    # Isolation: the distance to the nearest higher candidate (ranked higher), up to 64 units.
    tree = cKDTree(np.column_stack([X, Y]))
    iso = np.full(n, 64.0)
    for i, near in enumerate(tree.query_ball_point(np.column_stack([X, Y]), 64.0)):
        near = np.asarray(near, np.int64)
        near = near[rank[near] < rank[i]]
        if len(near):
            iso[i] = min(64.0, float(np.min(np.hypot(X[near] - X[i], Y[near] - Y[i]))))
    score = el + ISO_BONUS * np.log2(np.clip(iso, 2, 64) / 4)
    crest = el / np.maximum(ndimage.maximum_filter(es, size=16 * P + 1)[rs, cs], 1)
    relief8 = el - ndimage.minimum_filter(es, size=16 * P + 1)[rs, cs]
    share = el / np.maximum(ndimage.maximum_filter(es, size=80 * P + 1)[rs, cs], 1)
    near_max = ndimage.maximum_filter(es, size=120 * P + 1)[rs, cs]
    ri, ci = rs // P, cs // P
    ranged = ndimage.binary_dilation(on_range)[ri, ci]  # a summit on a range's edge is on it
    massif = ndimage.grey_dilation(core, size=3)[ri, ci]
    upl = upland[ri, ci]
    seeds = (hash01(np.round(X * P).astype(np.int64), np.round(Y * P).astype(np.int64), 7) * 2**31).astype(np.int64)
    # The summit's own height (the finest data, within 0.75 units): the height floor, and snow.
    f = WORK_PPU // P
    raw = np.array([float(np.max(data.elev[max(0, r * f - 12) : r * f + 16, max(0, c * f - 12) : c * f + 16])) for r, c in zip(rs, cs)])
    # Tiers. Top: each massif's few highest isolated summits.
    tier = np.where(score >= MID_SCORE, 1, 2)
    tops = []
    for i in sorted(np.nonzero((massif > 0) & (iso >= TOP_ISO) & (el >= TOP_E) & (el >= TOP_SHARE * near_max))[0], key=lambda i: (-score[i], Y[i], X[i])):
        cap = min(TOP_MAX, max(1, int(round(core_area[massif[i]] / TOP_AREA))))
        if sum(1 for j in tops if massif[j] == massif[i]) < cap and all(math.hypot(X[i] - X[j], Y[i] - Y[j]) >= TOP_SPACE for j in tops):
            tops.append(i)
    tier[tops] = 0

    def clear(i, wu, top, bottom, names):
        box = (X[i] - wu / 2, Y[i] - top, X[i] + wu / 2, Y[i] + bottom)
        return not np.any((names[:, 0] < box[2]) & (names[:, 2] > box[0]) & (names[:, 1] < box[3]) & (names[:, 3] > box[1]))

    def crowded(i, kept, side):
        """Would summit i make some side x side square hold more than PEAK_CROWD[1] peaks?"""
        near = kept[(np.abs(X[kept] - X[i]) < side) & (np.abs(Y[kept] - Y[i]) < side)]
        if len(near) < PEAK_CROWD[1]:
            return False
        for x0 in X[i] - side + side * np.arange(1, 13) / 12:
            for y0 in Y[i] - side + side * np.arange(1, 13) / 12:
                if np.sum((X[near] >= x0) & (X[near] < x0 + side) & (Y[near] >= y0) & (Y[near] < y0 + side)) >= PEAK_CROWD[1]:
                    return True
        return False

    out = []
    # Peaks, level by level, each keeping every peak of the coarser levels.
    order = sorted(np.nonzero(ranged & (relief8 >= PEAK_RELIEF))[0], key=lambda i: (tier[i] != 0, -score[i], Y[i], X[i]))
    kept = np.zeros(0, np.int64)
    for level in range(len(PPU)):
        if not PEAK_PT[level]:
            continue
        names = name_boxes(NAME_K[level])
        foot = np.array([sym.SUMMIT_FOOT[t] * glyph_px(level, t) for t in range(3)]) / PPU[level]  # the widest glyph, units
        for i in order:
            if i in kept or crest[i] < CREST[level] or (tier[i] != 0 and (raw[i] < PEAK_FLOOR[level] or share[i] < PEAK_SHARE[level])):
                continue
            gap = np.maximum(PEAK_SPACE[level], 0.55 * (foot[tier[i]] + foot[tier[kept]]))
            if np.any(np.hypot(X[kept] - X[i], Y[kept] - Y[i]) < gap) or crowded(i, kept, PEAK_CROWD[0] / VIEW_K[level]):
                continue
            hi = glyph_px(level, tier[i]) / PPU[level]
            if tier[i] != 0 and not clear(i, foot[tier[i]], 0.7 * hi, 0.3 * hi, names):
                continue  # (a top-tier massif is drawn even under a name: the map would not be the map without it)
            kept = np.append(kept, i)
            t = int(tier[i])
            snow = float(smoothstep(2100, 3100, raw[i])) if t == 0 else float(smoothstep(3000, 3600, raw[i])) if t == 1 else 0.0
            out.append((float(X[i]), float(Y[i]), "mountain", t, level, int(seeds[i]), snow))
    # Hills: the highest points of the uplands off the ranges, a few each.
    order = sorted(np.nonzero(upl > 0)[0], key=lambda i: (-score[i], Y[i], X[i]))
    hills = np.zeros(0, np.int64)
    for level in range(len(PPU)):
        if not HILL_PT[level]:
            continue
        names = name_boxes(NAME_K[level])
        wu = HILL_PT[level] / VIEW_K[level]
        for i in order:
            if i in hills or off_range[ri[i], ci[i]] < HILL_OFF or el[i] < HILL_E[level] or crest[i] < 0.9:
                continue
            if np.sum(upl[hills] == upl[i]) >= HILL_CAP[level] or np.any(np.hypot(X[hills] - X[i], Y[hills] - Y[i]) < HILL_SPACE[level]):
                continue
            if not clear(i, wu, 0.35 * wu, 0.15 * wu, names):
                continue
            hills = np.append(hills, i)
            out.append((float(X[i]), float(Y[i]), "hill", 2, level, int(seeds[i]), 0.0))
    _FEATURES["all"] = out
    return out


def symbols(F, slope, land, box, level, gx0, gy0):
    """Every symbol in the box as (sort_y, draw) pairs: trees, marsh, grass (and an empty hachure list: the relief
    shading carries the slopes; the peaks and hills are the app's, see write_peaks())."""
    ppu = PPU[level]
    h, w = F["elev"].shape
    e = np.maximum(F["elev"], 0)
    items = []
    lat_of = lambda ly: mp.to_lonlat(0, box[1] + ly / ppu)[1]
    # Mountains and hills are not drawn here: the app draws them over the realms' colours from the same list
    # (write_peaks(), terrainPeaks.ts), at a steady size on screen. The tiles keep clear ground where each one stands
    # (no tree on it, nor just below it, where a tree would stand in front), so it reads as a feature in a forest too.
    body = Image.new("L", (w, h), 0)
    paint_body = ImageDraw.Draw(body)
    below = TREE_PX[level]
    for x, y, kind, tier, lev, seed, snow in features():
        c, r = x * ppu - gx0, y * ppu - gy0
        if lev > level or not (-w * 0.05 <= c < w * 1.05 and -h * 0.05 <= r < h * 1.05):
            continue
        if kind == "mountain":
            hpx = glyph_px(level, tier)
            base = r + 0.3 * hpx  # the glyph's middle on the summit
            half = 0.6 * sym.SUMMIT_FOOT[tier] * hpx
            top = base - 1.15 * hpx
        else:
            wpx = HILL_PT[level] * ppu / VIEW_K[level]
            base = r + 0.15 * wpx
            half, top = 0.6 * wpx, base - 0.5 * wpx
        paint_body.polygon([(c - half, base + below), (c - half, base), (c, top), (c + half, base), (c + half, base + below)], fill=255)
    # Trees: on a jittered lattice, kept where the land is forest (more forest, more trees).
    if TREE_PX[level] > 0:
        s = TREE_PX[level]
        forest = ndimage.gaussian_filter(F["tree"], 0.8)
        gx, gy, lx, ly, u, I, J = jitter_grid(gx0, gy0, w, h, s * 0.62 * SPREAD[level], 101 + level)  # overlapping, so woods read as woods
        ri = np.clip(ly.astype(int), 0, h - 1)
        ci = np.clip(lx.astype(int), 0, w - 1)
        high = 1 - HIGH_THIN[level] * smoothstep(700, 1600, e[ri, ci])
        on_peak = np.asarray(body)[ri, ci] > 0
        keep = (u < smoothstep(TREE_FROM[level], 0.85, forest[ri, ci]) * high) & (land[ri, ci] > 0.97) & ~on_peak
        for x, y, r, c, i, j in zip(lx[keep], ly[keep], ri[keep], ci[keep], I[keep], J[keep]):
            el = e[r, c]
            lat = lat_of(y)
            conifer_p = smoothstep(700, 1300, el) + smoothstep(53.5, 57, lat)
            kind = "conifer" if hash01(i, j, 131) < conifer_p else "broadleaf"
            variant = int(hash01(i, j, 137) * sym.TreeSprites.VARIANTS)
            size = s * (0.85 + 0.3 * hash01(i, j, 139))
            items.append((y, ("tree", kind, x, y, size, variant)))
    # Marsh: on wetland.
    if level >= 2:
        gx, gy, lx, ly, u, I, J = jitter_grid(gx0, gy0, w, h, 11 * SYM * SPREAD[level], 201 + level)
        ri = np.clip(ly.astype(int), 0, h - 1)
        ci = np.clip(lx.astype(int), 0, w - 1)
        keep = (u < smoothstep(0.15, 0.5, F["wetland"][ri, ci])) & (land[ri, ci] > 0.97)
        for x, y, i, j in zip(lx[keep], ly[keep], I[keep], J[keep]):
            items.append((y, ("marsh", x, y, 7.0 * SYM, int(hash01(i, j, 211) * 2**31))))
    # Grass tufts on open grassland and steppe (fine levels only).
    if level >= 3:
        gx, gy, lx, ly, u, I, J = jitter_grid(gx0, gy0, w, h, 9 * SYM * SPREAD[level], 301 + level)
        ri = np.clip(ly.astype(int), 0, h - 1)
        ci = np.clip(lx.astype(int), 0, w - 1)
        keep = (u < 0.55 * smoothstep(0.45, 0.85, F["grass"][ri, ci])) & (land[ri, ci] > 0.97) & (F["tree"][ri, ci] < 0.2)
        for x, y in zip(lx[keep], ly[keep]):
            items.append((y, ("grass", x, y)))
    return items, []


def draw_symbols(canvas, items, hach, sprites, ox, oy):
    """Draw hachures (if any), then every symbol from the top of the box down (nearer ones over farther ones)."""
    if hach:
        for a in (0.18, 0.3, 0.42):
            p = skia.Path()
            for x0, y0, x1, y1, st in hach:
                if abs(0.18 + 0.24 * st - a) <= 0.061:
                    p.moveTo(x0 + ox, y0 + oy)
                    p.lineTo(x1 + ox, y1 + oy)
            canvas.drawPath(p, sym.paint(sym.INK, a, stroke=0.6 * SYM**0.6))
    for _, it in sorted(items, key=lambda t: t[0]):
        kind = it[0]
        if kind == "tree":
            _, tk, x, y, size, variant = it
            sprites.draw(canvas, tk, x + ox, y + oy, size, variant)
        elif kind == "marsh":
            _, x, y, s, seed = it
            sym.marsh(canvas, x + ox, y + oy, s, seed)
        elif kind == "grass":
            _, x, y = it
            sym.grass(canvas, x + ox, y + oy, 4.0 * SYM, 0.4)


def render_box(data, sprites, level, box):
    """The finished picture of map box (x0, y0, x1, y1) at a level: RGB uint8, (y1-y0)*ppu x (x1-x0)*ppu."""
    ppu = PPU[level]
    hb = (box[0] - HALO, box[1] - HALO, box[2] + HALO, box[3] + HALO)
    gx0 = int(round(hb[0] * ppu))
    gy0 = int(round(hb[1] * ppu))
    F = data.fields(hb, ppu)
    rgb, slope, water, land, edge = paint_base(F, hb, level, gx0, gy0)
    rgb = ripples(rgb, land, water, ppu, edge)
    h, w = slope.shape
    # Symbols are drawn on their own layer and cut to the game's land before they go on the ground, so no tree or
    # peak ever spills over the game's coastline.
    surface = skia.Surface(w, h)
    canvas = surface.getCanvas()
    canvas.clear(skia.ColorTRANSPARENT)
    items, hach = symbols(F, slope, land, hb, level, gx0, gy0)
    draw_symbols(canvas, items, hach, sprites, 0, 0)
    layer = surface.makeImageSnapshot().toarray(colorType=skia.kRGBA_8888_ColorType).astype(np.float32) / 255.0
    a = layer[..., 3:4] * np.clip(land, 0, 1)[..., None]  # premultiplied colour, alpha, both cut to the land
    img = rgb * (1 - a) + layer[..., :3] * 255.0 * np.clip(land, 0, 1)[..., None]
    img = np.clip(np.round(img), 0, 255).astype(np.uint8)
    p = HALO * ppu
    return img[p : h - p, p : w - p], len(items)


# ---------------------------------------------------------------- the pyramid
def level_tiles(level):
    """Every tile of a level that is made: those touching the region (clipped to it) that, grown by REACH, show the
    game's known land (at the finest level, land outside L4_SKIP). Open sea and what the parchment hides are left to
    the style. (tx, ty, x0, y0, x1, y1), map units. A tile's parent is made whenever it is (its grown box holds the
    child's)."""
    ppu = PPU[level]
    span = TILE / ppu
    rx0, ry0, rx1, ry1 = REGION
    known = finest_land() if level == len(PPU) - 1 else cover_geoms()[0]
    out = []
    for ty in range(int(math.floor(ry0 / span)), int(math.ceil(ry1 / span))):
        for tx in range(int(math.floor(rx0 / span)), int(math.ceil(rx1 / span))):
            x0, y0 = max(rx0, tx * span), max(ry0, ty * span)
            x1, y1 = min(rx1, (tx + 1) * span), min(ry1, (ty + 1) * span)
            if x1 > x0 and y1 > y0 and known.intersects(shapely.box(x0 - REACH, y0 - REACH, x1 + REACH, y1 + REACH)):
                out.append((tx, ty, x0, y0, x1, y1))
    return out


BLOCK = 2048 // TILE  # tiles a side drawn in one go (with its halo): a few hundred MB a worker
WORKERS = max(1, min(4, (os.cpu_count() or 1)))
_W = {}


def _worker_init():
    _W["data"] = Data()
    _W["sprites"] = sym.TreeSprites()


def _render_block(level, block):
    """Draw one block of a level's tiles and write them; returns their index entries and the symbol count."""
    ppu = PPU[level]
    box = (min(t[2] for t in block), min(t[3] for t in block), max(t[4] for t in block), max(t[5] for t in block))
    img, n = render_box(_W["data"], _W["sprites"], level, box)
    written = []
    for tx, ty, x0, y0, x1, y1 in block:
        c0, r0 = int(round((x0 - box[0]) * ppu)), int(round((y0 - box[1]) * ppu))
        c1, r1 = int(round((x1 - box[0]) * ppu)), int(round((y1 - box[1]) * ppu))
        name = f"{tx}_{ty}.jpg"
        Image.fromarray(img[r0:r1, c0:c1]).save(TILE_DIR / f"L{level}" / name, quality=QUALITY, optimize=True)
        written.append({"tx": tx, "ty": ty, "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0, "file": f"L{level}/{name}"})
    return written, n, img.shape


def render_level(level):
    """Every tile of a level, drawn in blocks of BLOCK x BLOCK tiles (each with its halo, so neighbours agree pixel for
    pixel), WORKERS at a time."""
    tiles = level_tiles(level)
    (TILE_DIR / f"L{level}").mkdir(parents=True, exist_ok=True)
    blocks = {}
    for t in tiles:
        blocks.setdefault((t[1] // BLOCK, t[0] // BLOCK), []).append(t)
    written, n_sym = [], 0
    with ProcessPoolExecutor(max_workers=WORKERS, initializer=_worker_init) as pool:
        jobs = [(key, pool.submit(_render_block, level, blk)) for key, blk in sorted(blocks.items())]
        for i, (key, job) in enumerate(jobs, 1):
            w, n, shape = job.result()
            written += w
            n_sym += n
            print(f"  L{level} block {i}/{len(jobs)}: {len(w)} tiles, {shape[1]}x{shape[0]} px, {n} symbols", flush=True)
    written.sort(key=lambda t: (t["ty"], t["tx"]))
    return written, n_sym


def full_flags(levels):
    """For each made tile, whether all four of its children (those inside the region) are made too: only then may
    the app hide it under the finer level (terrainLayer.tilesToDraw)."""
    made = {lv: {(t["tx"], t["ty"]) for t in tiles} for lv, tiles in levels}
    flags = {}
    for lv, tiles in levels:
        span = TILE / PPU[lv]
        for t in tiles:
            kids = []
            if lv + 1 in made:
                for dy in (0, 1):
                    for dx in (0, 1):
                        cx, cy = 2 * t["tx"] + dx, 2 * t["ty"] + dy
                        x0, y0 = cx * span / 2, cy * span / 2
                        if x0 < REGION[2] and y0 < REGION[3] and x0 + span / 2 > REGION[0] and y0 + span / 2 > REGION[1]:
                            kids.append((cx, cy) in made[lv + 1])
            flags[(lv, t["tx"], t["ty"])] = bool(kids) and all(kids)
    return flags


# ---------------------------------------------------------------- the peaks the app draws
PEAK_SPRITE_PX = 96  # a sprite's glyph height (mountains) or width (hills): about twice the largest it is drawn on a 3x screen
PEAK_VARIANTS = 6  # shapes per tier (a summit takes the one its seed picks)
SNOW_STEPS = (0.0, 0.5, 1.0)
# How strongly each tone of the glyph (drawn in its opaque colours) lightens or darkens what is under it, by luminance:
# the shaded face and the ink darken towards INK, the lit face and the snow lighten towards paper white.
DARK_L, DARK_ALPHA = (40, 100, 150, 186), (0.95, 0.72, 0.46, 0.4)
LIGHT_L, LIGHT_ALPHA = (194, 214, 246), (0.42, 0.52, 0.94)
SPLIT_L = 190
PEAK_FROM = {2: (0.6, 1.0), 3: (2.5, 2.9), 4: (4.0, 4.4)}  # zoom over which a level's peaks fade in (the Atlas: 0.6-1.0)
PEAK_MIN_PT = 5.0  # a glyph smaller than this on screen is left out (fading in over the next point)
HILL_MIN_PT = 8.0


def as_overlay(px):
    """A glyph drawn in opaque colours (RGBA, premultiplied, uint8) as an overlay for the realms' colours: its lit face
    and snow lighten towards paper white, its shaded face, hatching and outline darken towards ink, each by its own
    amount (DARK_*, LIGHT_*), so the realm's colour shows through and the peak still reads as a solid form."""
    f = px.astype(np.float32) / 255.0
    a = f[..., 3]
    c = np.where(a[..., None] > 0, f[..., :3] / np.maximum(a[..., None], 1e-6), 0) * 255.0
    lum = c @ np.array([0.299, 0.587, 0.114], np.float32)
    lit = lum >= SPLIT_L
    alpha = a * np.where(lit, np.interp(lum, LIGHT_L, LIGHT_ALPHA), np.interp(lum, DARK_L, DARK_ALPHA))
    rgb = np.where(lit[..., None], np.array([255, 252, 244], np.float32), np.array(sym.INK, np.float32))
    return np.dstack([rgb, alpha * 255.0]).round().clip(0, 255).astype(np.uint8)


def peak_sprite(kind, tier, variant, snow):
    """One sprite: (RGBA uint8 straight alpha, base centre x, base y) in sprite pixels."""
    G = PEAK_SPRITE_PX
    if kind == "mountain":
        stroke = OUTLINE_PT * G / (PEAK_PT[2] * TIER[tier])  # the outline in points at play zoom, whatever the tier
        pad = int(math.ceil(stroke * 1.5)) + 2
        w, h = int(math.ceil(sym.SUMMIT_FOOT[tier] * G)) + 2 * pad, int(math.ceil(1.05 * G)) + 2 * pad
        bx, by = w / 2, h - pad
    else:
        stroke = 0.8 * OUTLINE_PT * G / HILL_PT[2]
        pad = int(math.ceil(stroke * 1.5)) + 2
        w, h = G + 2 * pad, int(math.ceil(0.45 * G)) + 2 * pad
        bx, by = w / 2, h - pad
    surface = skia.Surface(w, h)
    canvas = surface.getCanvas()
    canvas.clear(skia.ColorTRANSPARENT)
    seed = 1000 * (tier + 1) + 17 * variant + (500 if kind == "hill" else 0)
    if kind == "mountain":
        sym.summit(canvas, bx, by, G, seed, tier, snow, stroke)
    else:
        sym.hill(canvas, bx, by, G, seed, stroke=stroke)
    px = surface.makeImageSnapshot().toarray(colorType=skia.kRGBA_8888_ColorType)
    return as_overlay(px), bx, by


def write_peaks():
    """The mountains and hills for the app (features()): their sprites (assets/map/terrain/peaks/) and
    src/ui/map/terrainPeaks.ts, which lists each with its place, tier, the tile level it was chosen for and its sprite."""
    out_dir = TILE_DIR / "peaks"
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.png"):
        old.unlink()
    sprites, index, rows = [], {}, []
    rx0, ry0, rx1, ry1 = REGION
    known, _ = cover_geoms()
    for x, y, kind, tier, level, seed, snow in features():
        if not (rx0 <= x < rx1 and ry0 <= y < ry1) or not known.contains(shapely.Point(x, y)):
            continue  # (the margin around the region, and the wastes under the parchment)
        variant = seed % PEAK_VARIANTS
        step = min(range(len(SNOW_STEPS)), key=lambda i: abs(SNOW_STEPS[i] - snow)) if kind == "mountain" else 0
        key = (kind, tier, variant, step)
        if key not in index:
            img, bx, by = peak_sprite(kind, tier, variant, SNOW_STEPS[step])
            name = f"{kind[0]}{tier}-{variant}-{step}.png"
            Image.fromarray(img, "RGBA").save(out_dir / name, optimize=True)
            G = PEAK_SPRITE_PX
            index[key] = len(sprites)
            sprites.append({"file": name, "w": img.shape[1] / G, "h": img.shape[0] / G, "ax": bx / img.shape[1], "ay": by / img.shape[0]})
        rows.append((round(x, 2), round(y, 2), 0 if kind == "mountain" else 1, tier, level, index[key]))
    rows.sort(key=lambda r: (r[4], r[1], r[0]))
    lines = [
        "/**",
        " * The Illustrated style's mountains and hills (scripts/terrain/render.py, write_peaks): one list of summits chosen",
        " * once for the whole terrain region, drawn by the app over the realms' colours at a steady size on screen.",
        " * Generated: do not edit by hand.",
        " */",
        "export interface PeakSprite {",
        "  src: number;",
        "  w: number; // the sprite's size, as a multiple of its glyph's size (a mountain's height, a hill's width)",
        "  h: number;",
        "  ax: number; // where the glyph's base centre sits in the sprite (0-1)",
        "  ay: number;",
        "}",
        "export const PEAK_SPRITES: PeakSprite[] = [",
    ]
    for sp in sprites:
        lines.append(f"  {{ src: require('../../../assets/map/terrain/peaks/{sp['file']}'), w: {sp['w']:.4f}, h: {sp['h']:.4f}, ax: {sp['ax']:.4f}, ay: {sp['ay']:.4f} }},")
    lines += [
        "];",
        "/** Per peak, six numbers: x, y (the summit, map units), kind (0 mountain, 1 hill), tier (0 top, 1 middle, 2 small),",
        " * the tile level it was chosen for (2, 3, 4: it shows from that level's zoom on) and its sprite. */",
        "export const TERRAIN_PEAKS: number[] = [",
    ]
    for r in rows:
        lines.append(f"  {r[0]}, {r[1]}, {r[2]}, {r[3]}, {r[4]}, {r[5]},")
    sizes = {lev: [VIEW_K[lev], PEAK_PT[lev], HILL_PT[lev]] for lev in (2, 3, 4)}
    lines += [
        "];",
        "/** How big they are on screen: the top tier's height and a hill's width (points) at the zoom each level is made",
        " * for, the tiers' shares of the top's height, where each level's peaks fade in, and the smallest drawn. */",
        "export const PEAK_SIZE = {",
        f"  k: [{', '.join(str(sizes[l][0]) for l in (2, 3, 4))}],",
        f"  top: [{', '.join(str(sizes[l][1]) for l in (2, 3, 4))}],",
        f"  hill: [{', '.join(str(sizes[l][2]) for l in (2, 3, 4))}],",
        f"  tier: [{', '.join(str(t) for t in TIER)}],",
        f"  from: {{ {', '.join(f'{l}: [{a}, {b}]' for l, (a, b) in PEAK_FROM.items())} }} as Record<number, [number, number]>,",
        f"  minPt: {PEAK_MIN_PT},",
        f"  hillMinPt: {HILL_MIN_PT},",
        "  base: [0.3, 0.15], // the glyph's base below the summit, as a share of its size (mountain, hill)",
        "};",
    ]
    PEAKS_TS.write_text("\n".join(lines) + "\n")
    print(f"{len(rows)} peaks, {len(sprites)} sprites")


def write_index(levels):
    lines = [
        "/**",
        " * The illustrated terrain's tiles (scripts/terrain/render.py): per level, its pixels per map unit and every tile",
        " * with its place in map units. Generated: do not edit by hand.",
        " */",
        "export interface TerrainTile {",
        "  key: string;",
        "  src: number;",
        "  x: number;",
        "  y: number;",
        "  w: number;",
        "  h: number;",
        "  full?: boolean; // all four of its children (inside the region) exist",
        "}",
        "export interface TerrainLevel {",
        "  level: number;",
        "  ppu: number;",
        "  span: number;",
        "  tiles: TerrainTile[];",
        "}",
        f"export const TERRAIN_REGION = {{ x0: {REGION[0]}, y0: {REGION[1]}, x1: {REGION[2]}, y1: {REGION[3]} }};",
        f"export const TERRAIN_TILE_PX = {TILE};",
        "/** Regions the finest level is not made for (their next level stands in at the closest zooms). */",
        f"export const TERRAIN_FINEST_SKIP: string[] = [{', '.join(repr(r) for r in L4_SKIP)}];",
        "/** The depth shading drawn over the Illustrated style's sea everywhere (the tiles paint the same): darkening only. */",
        "export const TERRAIN_SEA_SHADE = { sharp: require('../../../assets/map/terrain/sea-shade.png'), soft: require('../../../assets/map/terrain/sea-shade-soft.png') };",
        "export const TERRAIN_LEVELS: TerrainLevel[] = [",
    ]
    full = full_flags(levels)
    for level, tiles in levels:
        lines.append(f"  {{ level: {level}, ppu: {PPU[level]}, span: {TILE / PPU[level]}, tiles: [")
        for t in tiles:
            flag = ", full: true" if full[(level, t["tx"], t["ty"])] else ""
            lines.append(f"    {{ key: 'L{level}/{t['tx']}_{t['ty']}', src: require('../../../assets/map/terrain/{t['file']}'), x: {t['x']}, y: {t['y']}, w: {t['w']}, h: {t['h']}{flag} }},")
        lines.append("  ] },")
    lines.append("];")
    TILES_TS.write_text("\n".join(lines) + "\n")


def projection_check():
    """Sample points projected the way the pipeline warps the data (pyproj EPSG:4326 → EPSG:3857, then the affine
    to map units), for tests/terrain.test.ts to compare with the game's own formula."""
    from pyproj import Transformer

    t = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    out = []
    for lon, lat in [(3.0, 57.0), (35.0, 38.0), (11.4, 47.27), (24.5, 45.5), (19.04, 47.5), (7.65, 45.98), (16.37, 48.21), (-101, 71.2), (47, -25)]:
        X, Y = t.transform(lon, lat)
        x, y = mp.from_3857(X, Y)
        out.append({"lon": lon, "lat": lat, "x": round(float(x), 9), "y": round(float(y), 9)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", nargs=6, metavar=("LEVEL", "X0", "Y0", "X1", "Y1", "OUT"))
    ap.add_argument("--levels", default=",".join(str(i) for i in range(len(PPU))))
    ap.add_argument("--peaks", action="store_true", help="only write the peaks the app draws (terrainPeaks.ts, sprites)")
    ap.add_argument("--index", action="store_true", help="only write the tile index (terrainTiles.ts) for the tiles on disk")
    a = ap.parse_args()
    if a.peaks:
        write_peaks()
        return
    if a.index:
        levels = []
        for level in range(len(PPU)):
            tiles = [{"tx": tx, "ty": ty, "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0, "file": f"L{level}/{tx}_{ty}.jpg"} for tx, ty, x0, y0, x1, y1 in level_tiles(level)]
            missing = [t["file"] for t in tiles if not (TILE_DIR / t["file"]).exists()]
            assert not missing, f"tiles not rendered: {missing[:5]}"
            levels.append((level, tiles))
        write_index(levels)
        return
    data = Data()
    sprites = sym.TreeSprites()
    write_shade_images()  # first: the tiles' sea is painted from it
    if a.preview:
        level = int(a.preview[0])
        box = tuple(float(v) for v in a.preview[1:5])
        t0 = time.time()
        img, n = render_box(data, sprites, level, box)
        Image.fromarray(img).save(a.preview[5])
        print(f"preview L{level} {img.shape[1]}x{img.shape[0]} px, {n} symbols, {time.time() - t0:.1f}s")
        return
    levels = []
    stats = {}
    features()  # (once here, so the workers inherit it)
    for level in [int(v) for v in a.levels.split(",")]:
        t0 = time.time()
        tiles, n = render_level(level)
        levels.append((level, tiles))
        stats[f"L{level}"] = {"ppu": PPU[level], "tiles": len(tiles), "symbols": n, "seconds": round(time.time() - t0, 1)}
        print(f"L{level}: {len(tiles)} tiles in {time.time() - t0:.0f}s")
    write_index(levels)
    write_peaks()
    meta = json.loads(META_JSON.read_text())
    meta["tiles"] = {"region_map_units": REGION, "tile_px": TILE, "jpeg_quality": QUALITY, "edge_match": EDGE_MATCH, "levels": stats}
    meta["projection_check"] = projection_check()
    META_JSON.write_text(json.dumps(meta, indent=1) + "\n")


if __name__ == "__main__":
    sys.exit(main())
