"""
Step 5: check the tiles, by measurement rather than by eye. Writes docs/terrain/verification.json (and comparison
crops in docs/terrain/img/).

1. Determinism and band seams: a box straddling tile edges and the boundary between two render bands is rendered
   afresh and compared with the stitched tiles (only JPEG noise may differ).
2. Tile joins: across every shared edge, the colour step between the two tiles' facing pixel columns/rows is compared
   with the step between neighbouring columns/rows inside tiles (a seam would show as a much larger step).
3. Coastline: where a tile paints sea and where the game's own coastline (land.npy) says sea, at the finest level;
   disagreements are counted by distance from the game's coast.
4. Real detail: each level against the level above it magnified 2x over the same area: the finer level must carry
   more fine detail (Laplacian energy), i.e. it is not the coarser picture enlarged.

Run: python scripts/terrain/verify.py
"""
import json
import math

import numpy as np
from PIL import Image
from scipy import ndimage

import render
import symbols as sym
from config import PPU, REGION, ROOT, TILE, TILE_DIR, WORK_DIR, WORK_PPU

OUT = ROOT / "docs/terrain"


def load_tile(level, tx, ty):
    p = TILE_DIR / f"L{level}" / f"{tx}_{ty}.jpg"
    return np.asarray(Image.open(p).convert("RGB"), np.float32) if p.exists() else None


def stitched(level, box):
    """The tiles' pixels over a map box (must be inside the region)."""
    ppu = PPU[level]
    span = TILE / ppu
    x0, y0, x1, y1 = box
    out = np.zeros((int(round((y1 - y0) * ppu)), int(round((x1 - x0) * ppu)), 3), np.float32)
    for ty in range(int(math.floor(y0 / span)), int(math.ceil(y1 / span))):
        for tx in range(int(math.floor(x0 / span)), int(math.ceil(x1 / span))):
            t = load_tile(level, tx, ty)
            if t is None:
                continue
            tx0, ty0 = max(REGION[0], tx * span), max(REGION[1], ty * span)
            # Overlap of the tile with the box, in each one's pixels.
            ox0, oy0 = max(x0, tx0), max(y0, ty0)
            ox1, oy1 = min(x1, tx0 + t.shape[1] / ppu), min(y1, ty0 + t.shape[0] / ppu)
            if ox1 <= ox0 or oy1 <= oy0:
                continue
            src = t[int(round((oy0 - ty0) * ppu)) : int(round((oy1 - ty0) * ppu)), int(round((ox0 - tx0) * ppu)) : int(round((ox1 - tx0) * ppu))]
            out[int(round((oy0 - y0) * ppu)) : int(round((oy0 - y0) * ppu)) + src.shape[0], int(round((ox0 - x0) * ppu)) : int(round((ox0 - x0) * ppu)) + src.shape[1]] = src
    return out


def check_determinism(data, sprites):
    level = 4
    span = TILE / PPU[level]
    band_rows = max(1, 4096 // TILE)
    first_row = int(math.floor(REGION[1] / span))
    boundary_y = (first_row + band_rows) * span  # where the first band ends
    box = (1950.0, boundary_y - 16, 1982.0, boundary_y + 16)
    fresh, _ = render.render_box(data, sprites, level, box)
    tiles = stitched(level, box)
    diff = np.abs(fresh.astype(np.float32) - tiles)
    Image.fromarray(np.concatenate([fresh, tiles.astype(np.uint8), np.clip(diff * 8, 0, 255).astype(np.uint8)], axis=1)).save(OUT / "img/determinism-L4.png")
    return {"box_map_units": box, "band_boundary_y": boundary_y, "mean_abs_diff": round(float(diff.mean()), 3), "p99_abs_diff": round(float(np.percentile(diff, 99)), 2), "note": "fresh render vs stitched JPEG tiles across a band boundary and tile edges; differences are JPEG compression only if small"}


def check_joins():
    out = {}
    for level in range(len(PPU)):
        files = sorted((TILE_DIR / f"L{level}").glob("*.jpg"))
        tiles = {}
        for f in files:
            tx, ty = (int(v) for v in f.stem.split("_"))
            tiles[(tx, ty)] = np.asarray(Image.open(f).convert("RGB"), np.float32)
        across, inside = [], []
        for (tx, ty), t in tiles.items():
            r = tiles.get((tx + 1, ty))
            if r is not None and r.shape[0] == t.shape[0]:
                across.append(np.abs(t[:, -1] - r[:, 0]).mean())
                inside.append(np.abs(t[:, -2] - t[:, -1]).mean())
                inside.append(np.abs(r[:, 0] - r[:, 1]).mean())
            b = tiles.get((tx, ty + 1))
            if b is not None and b.shape[1] == t.shape[1]:
                across.append(np.abs(t[-1] - b[0]).mean())
                inside.append(np.abs(t[-2] - t[-1]).mean())
                inside.append(np.abs(b[0] - b[1]).mean())
        if across:
            out[f"L{level}"] = {"edges": len(across), "mean_step_across_edges": round(float(np.mean(across)), 3), "mean_step_inside_tiles": round(float(np.mean(inside)), 3), "ratio": round(float(np.mean(across) / max(1e-6, np.mean(inside))), 3)}
    return out


def check_coast():
    level = 4
    ppu = PPU[level]
    g = json.loads((WORK_DIR / "grid.json").read_text())
    land = np.load(WORK_DIR / "land.npy", mmap_mode="r")
    f = WORK_PPU // ppu
    c0 = int(round((REGION[0] - g["x0"]) * WORK_PPU))
    r0 = int(round((REGION[1] - g["y0"]) * WORK_PPU))
    w = int((REGION[2] - REGION[0]) * ppu)
    h = int((REGION[3] - REGION[1]) * ppu)
    game_land = np.asarray(land[r0 : r0 + h * f : f, c0 : c0 + w * f : f]) > 127
    # Sample the region in strips to keep memory small: tiles' sea is the colour of the painted sea (bluer than red).
    painted_land = np.zeros((h, w), bool)
    span = TILE / ppu
    for f_ in sorted((TILE_DIR / f"L{level}").glob("*.jpg")):
        tx, ty = (int(v) for v in f_.stem.split("_"))
        t = np.asarray(Image.open(f_).convert("RGB"), np.int16)
        x0, y0 = int(round((max(REGION[0], tx * span) - REGION[0]) * ppu)), int(round((max(REGION[1], ty * span) - REGION[1]) * ppu))
        sea = (t[..., 2] - t[..., 0] > 6) & (t[..., 2] > 140)
        painted_land[y0 : y0 + t.shape[0], x0 : x0 + t.shape[1]] = ~sea
    # Inland water (lakes, wide rivers) is painted blue on purpose: only compare near the game's coast.
    coast = game_land ^ ndimage.binary_erosion(game_land)
    dist = ndimage.distance_transform_edt(~coast) / ppu  # map units from the game's coast
    near = dist <= 3
    disagree = (painted_land != game_land) & near
    d = dist[disagree]
    return {
        "level": level,
        "pixels_within_3_units_of_coast": int(near.sum()),
        "disagreeing": int(disagree.sum()),
        "disagreeing_share": round(float(disagree.sum() / max(1, near.sum())), 5),
        "disagreement_distance_units": {"median": round(float(np.median(d)), 3) if d.size else 0, "p95": round(float(np.percentile(d, 95)), 3) if d.size else 0, "max": round(float(d.max()), 3) if d.size else 0},
        "note": "sea/land as painted in the L4 tiles vs the game's coastline; distances in map units (1 unit is about 4.1-4.5 km here; 1 px = 1/16 unit)",
    }


def laplace_energy(img):
    g = img.mean(axis=2)
    return float(np.mean(ndimage.laplace(g) ** 2))


def check_detail():
    out = {}
    boxes = {"alps": (1888, 832, 1920, 864), "carpathians": (2160, 832, 2192, 864), "danube_plain": (2048, 864, 2080, 896)}
    for name, box in boxes.items():
        rows = []
        for level in range(1, len(PPU)):
            fine = stitched(level, box)
            coarse = stitched(level - 1, box)
            up = np.asarray(Image.fromarray(coarse.astype(np.uint8)).resize((fine.shape[1], fine.shape[0]), Image.BICUBIC), np.float32)
            rows.append({"level": level, "laplacian_energy": round(laplace_energy(fine), 2), "coarser_level_enlarged": round(laplace_energy(up), 2), "ratio": round(laplace_energy(fine) / max(1e-6, laplace_energy(up)), 2)})
            if level == 4:
                Image.fromarray(np.concatenate([up.astype(np.uint8), fine.astype(np.uint8)], axis=1)).save(OUT / f"img/detail-{name}-L3up-vs-L4.png")
        out[name] = {"box_map_units": box, "levels": rows}
    return out


def main():
    (OUT / "img").mkdir(parents=True, exist_ok=True)
    data = render.Data()
    sprites = sym.TreeSprites()
    report = {
        "determinism_and_band_seams": check_determinism(data, sprites),
        "tile_joins": check_joins(),
        "coastline_vs_game": check_coast(),
        "detail_gain_per_level": check_detail(),
    }
    (OUT / "verification.json").write_text(json.dumps(report, indent=1) + "\n")
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
