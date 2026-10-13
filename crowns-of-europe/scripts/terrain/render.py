"""
Step 3: render the illustrated terrain tiles from the canonical rasters (prepare.py) and the symbol library
(symbols.py), level by level, and write the tile index the app reads.

Each level is drawn from the data at that level's own resolution, so it carries the detail that resolution can hold:
relief shading from the elevation averaged to the level's pixels, symbol sizes fixed in pixels so a finer level gets
more, smaller peaks and trees placed at the real summits and in the real forests. Nothing is magnified from a coarser
level. Every random choice is a hash of the symbol's global position on the level's pixel grid, so a rebuild draws
the same map, and a tile and its neighbour agree pixel for pixel at their shared edge (big levels are drawn in bands of
tile rows, each with a halo wider than any filter or symbol).

Land and sea come from the game's own coastline (land.npy): the terrain is painted to it, never the other way round.

Run:  python scripts/terrain/render.py                    all levels → assets/map/terrain + src/ui/map/terrainTiles.ts
      python scripts/terrain/render.py --preview L x0 y0 x1 y1 out.png    one box of one level (map units)
"""
import argparse
import json
import math
import sys
import time

import numpy as np
import skia
from PIL import Image, ImageDraw
from scipy import ndimage

import mapproj as mp
import symbols as sym
from config import EDGE_MATCH, META_JSON, PPU, REGION, ROOT, TILE, TILE_DIR, TILES_TS, WORK_DIR, WORK_PPU

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
    def __init__(self):
        self.grid = json.loads((WORK_DIR / "grid.json").read_text())
        self.classes = self.grid["classes"]
        self.elev = np.load(WORK_DIR / "elevation.npy", mmap_mode="r")
        self.cover = np.load(WORK_DIR / "cover.npy", mmap_mode="r")
        self.land = np.load(WORK_DIR / "land.npy", mmap_mode="r")
        self.lake = np.load(WORK_DIR / "lake.npy", mmap_mode="r")

    def fields(self, box, ppu):
        """Every field over map box (x0, y0, x1, y1) at `ppu` px/unit, by averaging the canonical pixels."""
        g = self.grid
        f = WORK_PPU // ppu
        c0 = int(round((box[0] - g["x0"]) * WORK_PPU))
        r0 = int(round((box[1] - g["y0"]) * WORK_PPU))
        c1 = int(round((box[2] - g["x0"]) * WORK_PPU))
        r1 = int(round((box[3] - g["y0"]) * WORK_PPU))
        assert c0 >= 0 and r0 >= 0 and c1 <= g["width"] and r1 <= g["height"], f"box {box} outside the prepared grid"
        h, w = (r1 - r0) // f, (c1 - c0) // f

        def down(a):
            a = np.asarray(a[r0 : r0 + h * f, c0 : c0 + w * f], np.float32)
            return a.reshape(h, f, w, f).mean(axis=(1, 3)) if f > 1 else a

        out = {
            "elev": down(self.elev),
            "land": down(self.land) / 255.0,
            "lake": down(self.lake) / 255.0,
        }
        for i, name in enumerate(self.classes):
            out[name] = down(self.cover[i]) / 255.0
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
    # Paper grain, the same on every tile: two octaves of noise on global pixel positions.
    grain = 0.5 * value_noise(gx0, gy0, w, h, 3.0, 11) + 0.5 * value_noise(gx0, gy0, w, h, 23.0, 12)
    sea *= (0.955 + 0.06 * grain)[..., None]
    # Near the region's edge the sea turns into the sea the game draws outside it.
    edge = edge_weight(box, ppu, h, w)
    if edge.any():
        sea = outside_sea(sea, edge, box, ppu)
    rgb *= (0.955 + 0.06 * grain)[..., None]
    out = rgb * land[..., None] + sea * (1 - land)[..., None]
    return np.clip(out, 0, 255), slope, water, land, edge


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
# each level is shown at about 0.6-1.2 device pixels per tile pixel: a tile pixel is 0.2-0.4 points. Every symbol size,
# spacing and search window below is in tile pixels and scaled by SYM so the drawings read at that size (a tree about
# 3-6 points tall, a mountain about 10-30 points wide).
SYM = 2.2
TREE_PX = [0, 0, 5.8 * SYM, 6.2 * SYM, 6.6 * SYM]  # tree height, px, per level (levels 0-1 draw the forest as a canopy)
PEAK_PX = (14 * SYM, 36 * SYM)  # mountain width range, px
# Density per level. The finest levels, the ones seen close up, are thinned so single shapes stay apart: wider spacing
# for trees, hachures, grass and marsh (SPREAD; density goes as 1 / SPREAD^2), a wider search window for summits
# (PEAK_WIN x SYM px: fewer peaks, so the main ones stand out), and on high ground fewer trees and hachures again
# (HIGH_THIN: the share dropped by 1600 m, easing in from 700 m), since mountain country is the busiest.
SPREAD = [1.0, 1.0, 1.0, 1.18, 1.2]
PEAK_WIN = [17, 17, 17, 20, 20]
HIGH_THIN = [0.0, 0.0, 0.0, 0.28, 0.32]  # trees
HIGH_THIN_HACH = [0.0, 0.0, 0.0, 0.2, 0.25]  # hachures (lighter, so high valleys keep some slope)
# Peaks keep apart: none within PEAK_GAP x the wider glyph of a bigger one, so neighbouring bases overlap by less than
# half (the densest crests, the Savoy ridge, the Swiss and Dinaric Alps, open up). 0: no limit.
PEAK_GAP = [0.0, 0.0, 0.0, 0.56, 0.56]
# Trees from this much forest cover up (fewer stray single trees in open farmland close up).
TREE_FROM = [0.4, 0.4, 0.4, 0.44, 0.47]
# On high ground the fine relief is calmed by this share, so the gaps between peaks read as quiet ground.
CALM_HIGH = [0.0, 0.0, 0.0, 0.3, 0.35]
PEAK_RELIEF = [900, 800, 700, 600, 520]  # metres of relief within the glyph's reach for a summit to get a mountain


def keep_apart(peaks, gap):
    """Peaks (relief, row, col, width) with the bigger ones first, dropping any that stands within gap x the wider of
    the two glyphs of one already kept. Deterministic: ties go by position."""
    if gap <= 0 or not peaks:
        return peaks
    cell = gap * PEAK_PX[1]
    grid = {}
    kept = []
    for p in sorted(peaks, key=lambda t: (-t[0], t[1], t[2])):
        _, r, c, wpx = p
        gi, gj = int(r // cell), int(c // cell)
        near = False
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for _, r2, c2, w2 in grid.get((gi + di, gj + dj), ()):
                    if (r - r2) ** 2 + (c - c2) ** 2 < (gap * max(wpx, w2)) ** 2:
                        near = True
                        break
                if near:
                    break
            if near:
                break
        if not near:
            kept.append(p)
            grid.setdefault((gi, gj), []).append(p)
    return kept


def symbols(F, slope, land, box, level, gx0, gy0):
    """Every symbol in the box as (sort_y, draw) pairs: peaks, hills, trees, marsh, plus a hachure path."""
    ppu = PPU[level]
    h, w = F["elev"].shape
    e = np.maximum(F["elev"], 0)
    items = []
    lat_of = lambda ly: mp.to_lonlat(0, box[1] + ly / ppu)[1]
    inland = land > 0.97
    # Mountains: summits that stand highest within a glyph's reach and well above the land around, sized by how much.
    # The search window is in pixels, so a finer level finds more, smaller summits: real detail as you zoom in.
    es = ndimage.gaussian_filter(e, 1.4)
    win = int(round(PEAK_WIN[level] * SYM)) | 1
    top = ndimage.maximum_filter(es, size=win)
    low = ndimage.minimum_filter(es, size=win * 2 + 1)
    relief_m = top - low
    summit = (es >= top - 1e-3) & (relief_m > PEAK_RELIEF[level]) & (e > 700) & inland
    rs, cs = np.nonzero(summit)
    peaks = []
    for r, c in zip(rs, cs):
        rel = relief_m[r, c]
        wpx = float(np.clip(PEAK_PX[0] + (rel - PEAK_RELIEF[level]) / 70 * SYM, *PEAK_PX))
        peaks.append((float(rel), int(r), int(c), wpx))
    peaks = keep_apart(peaks, PEAK_GAP[level])
    body = Image.new("L", (w, h), 0)  # where the peaks stand: no tree is drawn there
    paint_body = ImageDraw.Draw(body)
    for rel, r, c, wpx in peaks:
        g = (int(gx0 + c), int(gy0 + r))
        seed = int(hash01(g[0], g[1], 7 + level) * 2**31)
        snow = float(smoothstep(2400, 3300, es[r, c]))
        y = r + wpx * 0.3  # the glyph's middle on the summit
        items.append((y, ("mountain", c, y, wpx, seed, snow)))
        paint_body.polygon([(c - 0.62 * wpx, y), (c, y - 0.7 * wpx), (c + 0.62 * wpx, y)], fill=255)
    # Hills: lesser summits on rolling uplands.
    hill = (es >= top - 1e-3) & (relief_m > 160) & (relief_m <= PEAK_RELIEF[level]) & (e > 150) & inland
    rs, cs = np.nonzero(hill)
    for r, c in zip(rs, cs):
        g = (int(gx0 + c), int(gy0 + r))
        if hash01(g[0], g[1], 21 + level) > 0.7:
            continue
        wpx = float(np.clip(10 + relief_m[r, c] / 40, 11, 18)) * SYM * 0.85
        seed = int(hash01(g[0], g[1], 23 + level) * 2**31)
        items.append((r + 2, ("hill", c, r + 2, wpx, seed)))
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
    # Hachures: short strokes down steep slopes, away from the peaks' own drawing.
    gx, gy, lx, ly, u, I, J = jitter_grid(gx0, gy0, w, h, 3.0 * SYM * SPREAD[level], 401 + level)
    ri = np.clip(ly.astype(int), 0, h - 1)
    ci = np.clip(lx.astype(int), 0, w - 1)
    steep = smoothstep([9, 9, 10, 11, 12][level], [20, 20, 22, 24, 26][level], slope[ri, ci])
    keep = (u < steep * (1 - HIGH_THIN_HACH[level] * smoothstep(700, 1600, e[ri, ci]))) & (land[ri, ci] > 0.97)
    gyy, gxx = np.gradient(ndimage.gaussian_filter(e, 1.0))
    hach = []
    for x, y, r, c, st in zip(lx[keep], ly[keep], ri[keep], ci[keep], steep[keep]):
        dx, dy = -gxx[r, c], -gyy[r, c]  # downhill
        n = math.hypot(dx, dy)
        if n < 1e-6:
            continue
        L = (1.6 + 2.2 * st) * SYM
        hach.append((x, y, x + dx / n * L, y + dy / n * L, st))
    return items, hach


def draw_symbols(canvas, items, hach, sprites, ox, oy):
    """Draw hachures, then every symbol from the top of the box down (nearer ones over farther ones)."""
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
        if kind == "mountain":
            _, x, y, wpx, seed, snow = it
            sym.mountain(canvas, x + ox, y + oy, wpx, seed, snow=snow)
        elif kind == "hill":
            _, x, y, wpx, seed = it
            sym.hill(canvas, x + ox, y + oy, wpx, seed)
        elif kind == "tree":
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
    """Every tile of a level that touches the region, clipped to it: (tx, ty, x0, y0, x1, y1) in map units."""
    ppu = PPU[level]
    span = TILE / ppu
    rx0, ry0, rx1, ry1 = REGION
    out = []
    for ty in range(int(math.floor(ry0 / span)), int(math.ceil(ry1 / span))):
        for tx in range(int(math.floor(rx0 / span)), int(math.ceil(rx1 / span))):
            x0, y0 = max(rx0, tx * span), max(ry0, ty * span)
            x1, y1 = min(rx1, (tx + 1) * span), min(ry1, (ty + 1) * span)
            if x1 > x0 and y1 > y0:
                out.append((tx, ty, x0, y0, x1, y1))
    return out


def render_level(data, sprites, level):
    ppu = PPU[level]
    span = TILE / ppu
    tiles = level_tiles(level)
    rows = sorted({t[1] for t in tiles})
    band_rows = max(1, 4096 // TILE)  # tile rows per band
    out_dir = TILE_DIR / f"L{level}"
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    n_sym = 0
    for b in range(0, len(rows), band_rows):
        band = [t for t in tiles if t[1] in rows[b : b + band_rows]]
        box = (min(t[2] for t in band), min(t[3] for t in band), max(t[4] for t in band), max(t[5] for t in band))
        t0 = time.time()
        img, n = render_box(data, sprites, level, box)
        n_sym += n
        for tx, ty, x0, y0, x1, y1 in band:
            c0 = int(round((x0 - box[0]) * ppu))
            r0 = int(round((y0 - box[1]) * ppu))
            c1 = int(round((x1 - box[0]) * ppu))
            r1 = int(round((y1 - box[1]) * ppu))
            name = f"{tx}_{ty}.jpg"
            Image.fromarray(img[r0:r1, c0:c1]).save(out_dir / name, quality=QUALITY, optimize=True)
            written.append({"tx": tx, "ty": ty, "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0, "file": f"L{level}/{name}"})
        print(f"  L{level} band {b // band_rows + 1}: {img.shape[1]}x{img.shape[0]} px, {n} symbols, {time.time() - t0:.1f}s")
    return written, n_sym


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
        "}",
        "export interface TerrainLevel {",
        "  level: number;",
        "  ppu: number;",
        "  span: number;",
        "  tiles: TerrainTile[];",
        "}",
        f"export const TERRAIN_REGION = {{ x0: {REGION[0]}, y0: {REGION[1]}, x1: {REGION[2]}, y1: {REGION[3]} }};",
        f"export const TERRAIN_TILE_PX = {TILE};",
        "/** The depth shading drawn over the Illustrated style's sea everywhere (the tiles paint the same): darkening only. */",
        "export const TERRAIN_SEA_SHADE = { sharp: require('../../../assets/map/terrain/sea-shade.png'), soft: require('../../../assets/map/terrain/sea-shade-soft.png') };",
        "export const TERRAIN_LEVELS: TerrainLevel[] = [",
    ]
    for level, tiles in levels:
        lines.append(f"  {{ level: {level}, ppu: {PPU[level]}, span: {TILE / PPU[level]}, tiles: [")
        for t in tiles:
            lines.append(f"    {{ key: 'L{level}/{t['tx']}_{t['ty']}', src: require('../../../assets/map/terrain/{t['file']}'), x: {t['x']}, y: {t['y']}, w: {t['w']}, h: {t['h']} }},")
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
    a = ap.parse_args()
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
    for level in [int(v) for v in a.levels.split(",")]:
        t0 = time.time()
        tiles, n = render_level(data, sprites, level)
        levels.append((level, tiles))
        stats[f"L{level}"] = {"ppu": PPU[level], "tiles": len(tiles), "symbols": n, "seconds": round(time.time() - t0, 1)}
        print(f"L{level}: {len(tiles)} tiles in {time.time() - t0:.0f}s")
    write_index(levels)
    meta = json.loads(META_JSON.read_text())
    meta["tiles"] = {"region_map_units": REGION, "tile_px": TILE, "jpeg_quality": QUALITY, "edge_match": EDGE_MATCH, "levels": stats}
    meta["projection_check"] = projection_check()
    META_JSON.write_text(json.dumps(meta, indent=1) + "\n")


if __name__ == "__main__":
    sys.exit(main())
