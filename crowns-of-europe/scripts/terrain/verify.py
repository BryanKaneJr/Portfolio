"""
Step 5: check the tiles, by measurement rather than by eye. Writes docs/terrain/verification.json (and comparison
crops in docs/terrain/img/).

1. Determinism and band seams: a box straddling tile edges and the boundary between two render bands is rendered
   afresh and compared with the stitched tiles (only JPEG noise may differ).
2. Tile joins: across every shared edge, the colour step between the two tiles' facing pixel columns/rows is compared
   with the step across a JPEG block edge inside the tiles; and, definitively, with the step at the same line in a
   render that has no edge there (a seam would add a step the unsplit render does not have).
3. Coastline: where a tile paints sea and where the game's own coastline (land.npy) says sea, at the finest level;
   disagreements are counted by distance from the game's coast.
4. Real detail: each level against the level above it magnified 2x over the same area: the finer level must carry
   more fine detail (Laplacian energy), i.e. it is not the coarser picture enlarged.

Run: python scripts/terrain/verify.py   [--only coastline_vs_game ...]
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
    """(a) The renderer itself: two overlapping boxes drawn at different offsets agree pixel for pixel on their overlap
    (raw, before JPEG). (b) The shipped tiles: a tile-aligned box across the boundary between the first two L4 render
    bands is drawn afresh, cut into its tiles and encoded exactly as render.py does; the result is compared with the
    tiles on disk (bytes and decoded pixels)."""
    import io

    level = 4
    ppu = PPU[level]
    span = TILE / ppu
    band_rows = max(1, 4096 // TILE)
    first_row = int(math.floor(REGION[1] / span))
    boundary_y = (first_row + band_rows) * span  # where the first band ends
    # (a) raw: a 32-unit box and a 48-unit box around it.
    small = (1950.0, boundary_y - 16, 1982.0, boundary_y + 16)
    big = (small[0] - 8, small[1] - 8, small[2] + 8, small[3] + 8)
    a, _ = render.render_box(data, sprites, level, small)
    b, _ = render.render_box(data, sprites, level, big)
    o = 8 * ppu
    b = b[o : o + a.shape[0], o : o + a.shape[1]]
    raw = np.abs(a.astype(np.int16) - b.astype(np.int16))
    # (b) shipped tiles: one tile column, the tile rows either side of the band boundary.
    tx = int(1952 // span)
    box = (tx * span, boundary_y - span, (tx + 1) * span, boundary_y + span)
    fresh, _ = render.render_box(data, sprites, level, box)
    rows = []
    for k, ty in enumerate((int((boundary_y - span) // span), int(boundary_y // span))):
        crop = fresh[k * TILE : (k + 1) * TILE]
        buf = io.BytesIO()
        Image.fromarray(crop).save(buf, format="JPEG", quality=render.QUALITY, optimize=True)
        disk = (TILE_DIR / f"L{level}" / f"{tx}_{ty}.jpg").read_bytes()
        dec_new = np.asarray(Image.open(io.BytesIO(buf.getvalue())).convert("RGB"), np.int16)
        dec_disk = np.asarray(Image.open(io.BytesIO(disk)).convert("RGB"), np.int16)
        jpeg_err = np.abs(dec_disk - crop.astype(np.int16))
        dd = np.abs(dec_new - dec_disk).max(axis=2)
        blocks = dd.reshape(TILE // 8, 8, TILE // 8, 8).max(axis=(1, 3)) > 0
        rows.append({
            "tile": f"L{level}/{tx}_{ty}",
            "band": 1 + k,
            "bytes_identical": buf.getvalue() == disk,
            "decoded_mean_abs_diff": round(float(dd.mean()), 4),
            "jpeg_blocks_differing_share": round(float(blocks.mean()), 4),
            "decoded_max_abs_diff": int(dd.max()),
            "jpeg_error_vs_raw_mean": round(float(jpeg_err.mean()), 3),
            "jpeg_error_vs_raw_p99": float(np.percentile(jpeg_err, 99)),
        })
    # (c) a whole level rebuilt: L2 is drawn as one band, so drawing it again must give the same bytes for every tile.
    rebuilt = []
    tiles2 = render.level_tiles(2)
    box2 = (min(t[2] for t in tiles2), min(t[3] for t in tiles2), max(t[4] for t in tiles2), max(t[5] for t in tiles2))
    img2, _ = render.render_box(data, sprites, 2, box2)
    for tx2, ty2, x0, y0, x1, y1 in tiles2:
        c0, r0 = int(round((x0 - box2[0]) * PPU[2])), int(round((y0 - box2[1]) * PPU[2]))
        c1, r1 = int(round((x1 - box2[0]) * PPU[2])), int(round((y1 - box2[1]) * PPU[2]))
        buf = io.BytesIO()
        Image.fromarray(img2[r0:r1, c0:c1]).save(buf, format="JPEG", quality=render.QUALITY, optimize=True)
        rebuilt.append(buf.getvalue() == (TILE_DIR / "L2" / f"{tx2}_{ty2}.jpg").read_bytes())
    stitched_view = stitched(level, small)
    diff = np.abs(a.astype(np.float32) - stitched_view)
    Image.fromarray(np.concatenate([a, stitched_view.astype(np.uint8), np.clip(diff * 8, 0, 255).astype(np.uint8)], axis=1)).save(OUT / "img/determinism-L4.png")
    return {
        "raw_render_offsets": {"box_map_units": small, "overlapping_box": big, "max_abs_diff": int(raw.max()), "pixels_differing": int((raw.max(axis=2) > 0).sum()), "pixels": int(raw.shape[0] * raw.shape[1])},
        "shipped_tiles_across_band_boundary": {"band_boundary_y": boundary_y, "tiles": rows},
        "level2_rebuilt_byte_identical": f"{sum(rebuilt)}/{len(rebuilt)} tiles",
        "note": "raw: the same symbols land in the same places wherever a box starts; the pixels differ only where Skia anti-aliases the combined hachure paths a little differently for a bigger box (a few hundredths of a percent of pixels). Rebuilt: drawing the same band again gives byte-identical tiles. Shipped: re-encoding a fresh one-tile-wide render matches the tiles on disk except in JPEG blocks where that 1-level rounding tips a coefficient. What remains between a raw render and a tile is JPEG compression (quality 84, 4:2:0 chroma), largest at sharp colour edges such as lake shores; determinism-L4.png shows raw | tiles | difference x8.",
    }


def check_joins():
    """Across every shared tile edge, the colour step between the two tiles' facing pixel columns (rows) is compared
    with the step across an 8 px JPEG block boundary inside the tiles (the tile edge is one too, so this compares like
    with like). A seam would make the edge step clearly larger."""
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
                m = (t.shape[1] // 16) * 8  # a block boundary near the middle
                inside.append(np.abs(t[:, m - 1] - t[:, m]).mean())
            b = tiles.get((tx, ty + 1))
            if b is not None and b.shape[1] == t.shape[1]:
                across.append(np.abs(t[-1] - b[0]).mean())
                m = (t.shape[0] // 16) * 8
                inside.append(np.abs(t[m - 1] - t[m]).mean())
        if across:
            out[f"L{level}"] = {"edges": len(across), "mean_step_across_tile_edges": round(float(np.mean(across)), 3), "mean_step_across_block_edges_inside": round(float(np.mean(inside)), 3), "ratio": round(float(np.mean(across) / max(1e-6, np.mean(inside))), 3)}
    return out


def check_seams_vs_raw(data, sprites):
    """The definitive seam test: at a tile edge, the colour step between the two tiles' facing pixels against the step
    at the same line in a render with no edge there (one box drawn across it). Equal steps mean the edge adds
    nothing but JPEG noise; a seam would add a step the unsplit render does not have. L0-L2 are drawn whole, every
    edge measured; L3 and L4 at a sample of edges spread over the region, each drawn as a two-tile box."""
    out = {}
    for level in range(len(PPU)):
        ppu = PPU[level]
        span = TILE / ppu
        tiles = {(t[0], t[1]): t for t in render.level_tiles(level)}
        pairs = [((tx, ty), (tx + 1, ty), "v") for (tx, ty) in tiles if (tx + 1, ty) in tiles] + [((tx, ty), (tx, ty + 1), "h") for (tx, ty) in tiles if (tx, ty + 1) in tiles]
        if level >= 3:
            pairs = sorted(pairs, key=lambda p: (p[0][1] * 131 + p[0][0] * 31) % 97)[:12]  # a fixed, spread-out sample
        whole = None
        if level <= 2:
            box = (min(t[2] for t in tiles.values()), min(t[3] for t in tiles.values()), max(t[4] for t in tiles.values()), max(t[5] for t in tiles.values()))
            whole, _ = render.render_box(data, sprites, level, box)
            whole = whole.astype(np.float32)
        tile_steps, raw_steps = [], []
        for a_, b_, kind in pairs:
            ta, tb = tiles[a_], tiles[b_]
            A, B = load_tile(level, *a_), load_tile(level, *b_)
            if kind == "v":
                if A.shape[0] != B.shape[0]:
                    continue
                tile_steps.append(np.abs(A[:, -1] - B[:, 0]).mean())
                x = tb[2]
                if whole is not None:
                    c = int(round((x - box[0]) * ppu)); r0 = int(round((ta[3] - box[1]) * ppu))
                    raw = whole[r0 : r0 + A.shape[0]]
                else:
                    raw, _ = render.render_box(data, sprites, level, (ta[2], ta[3], tb[4], tb[5]))
                    raw = raw.astype(np.float32); c = A.shape[1]
                raw_steps.append(np.abs(raw[:, c - 1] - raw[:, c]).mean())
            else:
                if A.shape[1] != B.shape[1]:
                    continue
                tile_steps.append(np.abs(A[-1] - B[0]).mean())
                y = tb[3]
                if whole is not None:
                    r = int(round((y - box[1]) * ppu)); c0 = int(round((ta[2] - box[0]) * ppu))
                    raw = whole[:, c0 : c0 + A.shape[1]]
                else:
                    raw, _ = render.render_box(data, sprites, level, (ta[2], ta[3], tb[4], tb[5]))
                    raw = raw.astype(np.float32); r = A.shape[0]
                raw_steps.append(np.abs(raw[r - 1] - raw[r]).mean())
        if tile_steps:
            ts, rs = np.array(tile_steps), np.array(raw_steps)
            out[f"L{level}"] = {"edges_measured": len(ts), "mean_step_in_tiles": round(float(ts.mean()), 3), "mean_step_unsplit_render": round(float(rs.mean()), 3), "largest_excess_over_unsplit": round(float((ts - rs).max()), 3)}
    return out


def check_coast():
    """Where the L4 tiles paint sea against where the game's own coastline (land.npy) says sea, within 3 map units of
    the game's coast. Each disagreeing pixel is put down to one of: the coast pixel itself (the game's outline crosses
    it, so it is part land), inland water the data puts there on purpose (a lake, lagoon or wide river from Natural
    Earth or WorldCover, painted blue on the game's land), or unexplained."""
    level = 4
    ppu = PPU[level]
    g = json.loads((WORK_DIR / "grid.json").read_text())
    land = np.load(WORK_DIR / "land.npy", mmap_mode="r")
    lake = np.load(WORK_DIR / "lake.npy", mmap_mode="r")
    cover = np.load(WORK_DIR / "cover.npy", mmap_mode="r")
    water_i = g["classes"].index("water")
    f = WORK_PPU // ppu
    c0 = int(round((REGION[0] - g["x0"]) * WORK_PPU))
    r0 = int(round((REGION[1] - g["y0"]) * WORK_PPU))
    w = int((REGION[2] - REGION[0]) * ppu)
    h = int((REGION[3] - REGION[1]) * ppu)
    cov = np.asarray(land[r0 : r0 + h * f : f, c0 : c0 + w * f : f])
    game_land = cov > 127
    partial = (cov > 0) & (cov < 255)
    inland_water = (np.asarray(lake[r0 : r0 + h * f : f, c0 : c0 + w * f : f]) > 64) | (np.asarray(cover[water_i, r0 : r0 + h * f : f, c0 : c0 + w * f : f]) > 64)
    painted_land = np.zeros((h, w), bool)
    span = TILE / ppu
    for f_ in sorted((TILE_DIR / f"L{level}").glob("*.jpg")):
        tx, ty = (int(v) for v in f_.stem.split("_"))
        t = np.asarray(Image.open(f_).convert("RGB"), np.int16)
        x0, y0 = int(round((max(REGION[0], tx * span) - REGION[0]) * ppu)), int(round((max(REGION[1], ty * span) - REGION[1]) * ppu))
        # The painted sea and inland water are bluer than red (shallows by about 8, deeps by 26, ripple lines by 26);
        # every land colour is redder than blue (farmland by about 48, forest 46, snow, the closest, 6).
        sea = t[..., 2] - t[..., 0] > 0
        painted_land[y0 : y0 + t.shape[0], x0 : x0 + t.shape[1]] = ~sea
    coast = game_land ^ ndimage.binary_erosion(game_land)
    dist = ndimage.distance_transform_edt(~coast) / ppu  # map units from the game's coast
    near = dist <= 3
    disagree = (painted_land != game_land) & near
    edge_px = disagree & (partial | (dist <= 1.5 / ppu))  # the coast's own (anti-aliased) pixel and its neighbour
    water_on_land = disagree & ~edge_px & game_land & ~painted_land & ndimage.binary_dilation(inland_water, iterations=2)
    rest = disagree & ~edge_px & ~water_on_land
    sea_as_land = rest & ~game_land
    land_as_sea = rest & game_land
    d = dist[rest]
    # A picture of where the unexplained pixels are (the region at L1 scale: one dot per pixel that has any).
    small = rest.reshape(h // 16, 16, w // 16, 16).any(axis=(1, 3))
    Image.fromarray(np.where(small, 0, 255).astype(np.uint8)).save(OUT / "img/coast-unexplained-L4.png")
    return {
        "level": level,
        "pixels_within_3_units_of_coast": int(near.sum()),
        "disagreeing": int(disagree.sum()),
        "of_which_coast_pixel_itself": int(edge_px.sum()),
        "of_which_inland_water_on_purpose": int(water_on_land.sum()),
        "unexplained": int(rest.sum()),
        "unexplained_share": round(float(rest.sum() / max(1, near.sum())), 6),
        "unexplained_game_sea_painted_as_land": int(sea_as_land.sum()),
        "unexplained_game_land_painted_as_sea": int(land_as_sea.sum()),
        "unexplained_distance_units": {"median": round(float(np.median(d)), 3) if d.size else 0, "p95": round(float(np.percentile(d, 95)), 3) if d.size else 0, "max": round(float(d.max()), 3) if d.size else 0},
        "note": "sea/land read from the L4 tiles' colours vs the game's coastline, within 3 map units of it (1 unit is about 4.1-4.5 km here; 1 px = 1/16 unit). img/coast-unexplained-L4.png marks (black) each 16x16 px block with an unexplained pixel.",
    }


def laplace_energy(img):
    g = img.mean(axis=2)
    return float(np.mean(ndimage.laplace(g) ** 2))


def check_detail(data):
    """Each level against the level above it magnified 2x over the same area. (a) Fine detail: Laplacian energy of the
    finer level over that of the coarser one enlarged (enlarging cannot add any); the paper grain's own share is given
    so it is not mistaken for geography. (b) Real features: the peaks, hills and trees each level places in the box,
    from the data at its own resolution."""
    out = {}
    boxes = {"alps": (1888, 832, 1920, 864), "carpathians": (2160, 832, 2192, 864), "danube_plain": (2048, 864, 2080, 896)}
    for name, box in boxes.items():
        rows = []
        for level in range(0, len(PPU)):
            ppu = PPU[level]
            hb = (box[0] - render.HALO, box[1] - render.HALO, box[2] + render.HALO, box[3] + render.HALO)
            F = data.fields(hb, ppu)
            gx0, gy0 = int(round(hb[0] * ppu)), int(round(hb[1] * ppu))
            _, slope, _, land, _ = render.paint_base(F, hb, level, gx0, gy0)
            items, hach = render.symbols(F, slope, land, hb, level, gx0, gy0)
            p = render.HALO * ppu
            hh, ww = slope.shape
            inside = [it for y, it in items if p <= y < hh - p and p <= it[2 if it[0] == "tree" else 1] < ww - p]
            kinds = {}
            for it in inside:
                k = it[1] if it[0] == "tree" else it[0]
                kinds[k] = kinds.get(k, 0) + 1
            row = {"level": level, "px_per_unit": ppu, "symbols": kinds, "hachure_strokes": sum(1 for x0, y0, *_ in hach if p <= y0 < hh - p and p <= x0 < ww - p)}
            if level > 0:
                fine = stitched(level, box)
                coarse = stitched(level - 1, box)
                up = np.asarray(Image.fromarray(coarse.astype(np.uint8)).resize((fine.shape[1], fine.shape[0]), Image.BICUBIC), np.float32)
                grain = 0.5 * render.value_noise(int(box[0] * ppu), int(box[1] * ppu), fine.shape[1], fine.shape[0], 3.0, 11) + 0.5 * render.value_noise(int(box[0] * ppu), int(box[1] * ppu), fine.shape[1], fine.shape[0], 23.0, 12)
                grain_img = fine.mean(axis=(0, 1))[None, None, :] * (0.955 + 0.06 * grain)[..., None]
                e_f, e_up, e_g = laplace_energy(fine), laplace_energy(up), laplace_energy(grain_img)
                row.update({"laplacian_energy": round(e_f, 1), "coarser_level_enlarged": round(e_up, 1), "ratio": round(e_f / max(1e-6, e_up), 2), "paper_grain_alone": round(e_g, 1)})
                if level == 4:
                    Image.fromarray(np.concatenate([up.astype(np.uint8), fine.astype(np.uint8)], axis=1)).save(OUT / f"img/detail-{name}-L3up-vs-L4.png")
            rows.append(row)
        out[name] = {"box_map_units": box, "levels": rows}
    return out


def main():
    import argparse

    checks = {
        "determinism_and_band_seams": lambda d, sp: check_determinism(d, sp),
        "tile_joins": lambda d, sp: check_joins(),
        "seams_vs_unsplit_render": lambda d, sp: check_seams_vs_raw(d, sp),
        "coastline_vs_game": lambda d, sp: check_coast(),
        "detail_gain_per_level": lambda d, sp: check_detail(d),
    }
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", choices=list(checks), help="run only these checks (the others keep their last results)")
    a = ap.parse_args()
    (OUT / "img").mkdir(parents=True, exist_ok=True)
    data = render.Data()
    sprites = sym.TreeSprites()
    path = OUT / "verification.json"
    report = json.loads(path.read_text()) if a.only and path.exists() else {}
    for name, fn in checks.items():
        if not a.only or name in a.only:
            report[name] = fn(data, sprites)
    report = {name: report[name] for name in checks if name in report}
    path.write_text(json.dumps(report, indent=1) + "\n")
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
