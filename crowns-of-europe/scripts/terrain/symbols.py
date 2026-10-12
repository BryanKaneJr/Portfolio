"""
The terrain's illustration library: a few coherent, hand-drawn-looking vector symbols in one ink and palette, drawn
with Skia. Every symbol is a function of a size and a seed, so the same place always gets the same drawing.

- Trees: a broadleaf crown (lobed, shaded on the side away from the light, a trunk) and a conifer (a stacked,
  tiered cone). Pre-rendered into small sprites per size and variant, then stamped (fast, and identical across
  tiles).
- Mountains: a peak with a lit face, a shaded face with a few hatch strokes, a spur, and a snow cap on the highest;
  outline in ink. Drawn per peak with its own seeded shape (2-3 summits, slight asymmetry).
- Marsh: a tuft of reeds over two water strokes.
- Grass tuft and stipple dots for open grassland and sand.

The light comes from the upper left (north-west), as on hand-drawn maps. `export_svg` writes the library as SVG files
(art/terrain-symbols) for review.
"""
import math

import numpy as np
import skia

INK = (58, 44, 30)
INK_SOFT = (88, 70, 50)
LEAF = (122, 134, 82)
LEAF_DARK = (86, 100, 60)
LEAF_LIGHT = (156, 164, 108)
NEEDLE = (96, 112, 76)
NEEDLE_DARK = (64, 80, 54)
ROCK_LIGHT = (232, 220, 190)
ROCK_SHADE = (150, 128, 98)
SNOW = (250, 250, 246)
SNOW_SHADE = (200, 206, 212)
REED = (92, 100, 66)
WATER_INK = (96, 124, 128)


def rgba(c, a=1.0):
    return skia.Color(int(c[0]), int(c[1]), int(c[2]), int(round(a * 255)))


def paint(c, a=1.0, stroke=None, cap=skia.Paint.kRound_Cap, join=skia.Paint.kRound_Join):
    p = skia.Paint(AntiAlias=True, Color=rgba(c, a))
    if stroke is not None:
        p.setStyle(skia.Paint.kStroke_Style)
        p.setStrokeWidth(stroke)
        p.setStrokeCap(cap)
        p.setStrokeJoin(join)
    return p


def rng(seed):
    return np.random.default_rng(seed & 0xFFFFFFFF)


# ---------------------------------------------------------------- trees
def broadleaf_path(s, seed):
    """A lobed crown of size s (px), centred on (0, -0.62 s), with its trunk's foot at (0, 0)."""
    r = rng(seed)
    cx, cy, rad = 0.0, -0.62 * s, 0.36 * s
    n = 7
    p = skia.Path()
    pts = []
    for i in range(n):
        a = -math.pi / 2 + i * 2 * math.pi / n + r.uniform(-0.15, 0.15)
        rr = rad * r.uniform(0.86, 1.08)
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.92))
    # Scalloped edge: a quadratic bulge between neighbouring points.
    p.moveTo(*pts[0])
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        ox, oy = mx - cx, my - cy
        l = math.hypot(ox, oy) or 1
        bulge = 0.32 * rad
        p.quadTo(mx + ox / l * bulge, my + oy / l * bulge, b[0], b[1])
    p.close()
    return p, (cx, cy, rad)


def conifer_path(s, seed):
    """A tiered cone of height s (px) with its foot at (0, 0)."""
    r = rng(seed)
    h = 0.92 * s
    w = 0.30 * s * r.uniform(0.9, 1.1)
    tiers = 3
    p = skia.Path()
    top = -h
    p.moveTo(0, top)
    # Right side down in tiers, then the left side back up.
    right, left = [], []
    for t in range(1, tiers + 1):
        y = top + h * 0.82 * t / tiers
        ww = w * (0.45 + 0.55 * t / tiers)
        right += [(ww, y), (ww * 0.55, y - h * 0.05)]
        left += [(-ww, y), (-ww * 0.55, y - h * 0.05)]
    for x, y in right[:-1]:
        p.lineTo(x, y)
    p.lineTo(right[-2][0], right[-2][1])
    p.lineTo(left[-2][0], left[-2][1])
    for x, y in reversed(left[:-1]):
        p.lineTo(x, y)
    p.close()
    return p, h


def tree_sprite(kind, s, seed, scale=4):
    """A tree drawn at `scale` times its size, as an RGBA image. Anchor: the trunk's foot, at (pad, pad + s)."""
    pad = int(math.ceil(0.25 * s))
    W = int(math.ceil(s + 2 * pad)) * scale
    surface = skia.Surface(W, W)
    c = surface.getCanvas()
    c.clear(skia.ColorTRANSPARENT)
    c.scale(scale, scale)
    c.translate(pad + s / 2, pad + s)
    ink = max(0.55, s * 0.085)
    if kind == "broadleaf":
        crown, (cx, cy, rad) = broadleaf_path(s, seed)
        c.drawLine(0, 0, 0, cy + rad * 0.4, paint(INK_SOFT, 0.95, stroke=ink * 1.2))
        c.drawPath(crown, paint(LEAF))
        # Shade on the lower right (away from the light), light on the upper left.
        c.save()
        c.clipPath(crown, doAntiAlias=True)
        c.drawCircle(cx + rad * 0.55, cy + rad * 0.55, rad * 0.95, paint(LEAF_DARK, 0.75))
        c.drawCircle(cx - rad * 0.45, cy - rad * 0.5, rad * 0.45, paint(LEAF_LIGHT, 0.7))
        c.restore()
        c.drawPath(crown, paint(INK, 0.9, stroke=ink))
    else:
        cone, h = conifer_path(s, seed)
        c.drawLine(0, 0, 0, -h * 0.12, paint(INK_SOFT, 0.95, stroke=ink * 1.2))
        c.drawPath(cone, paint(NEEDLE))
        c.save()
        c.clipPath(cone, doAntiAlias=True)
        r = skia.Path()
        r.addRect(0, -h * 1.1, s, 0)
        c.drawPath(r, paint(NEEDLE_DARK, 0.7))
        c.restore()
        c.drawPath(cone, paint(INK, 0.9, stroke=ink))
    img = surface.makeImageSnapshot()
    return img, pad, scale


class TreeSprites:
    """A small set of tree sprites per (kind, size), chosen per tree by a hash."""

    VARIANTS = 4

    def __init__(self):
        self.cache = {}

    def get(self, kind, s, variant):
        key = (kind, round(s * 4) / 4, variant)
        if key not in self.cache:
            self.cache[key] = tree_sprite(kind, key[1], 1000 + variant * 17 + (0 if kind == "broadleaf" else 500))
        return self.cache[key]

    def draw(self, canvas, kind, x, y, s, variant):
        img, pad, scale = self.get(kind, s, variant)
        side = img.width() / scale
        dst = skia.Rect.MakeXYWH(x - pad - s / 2, y - pad - s, side, side)
        canvas.drawImageRect(img, dst, skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear))


# ---------------------------------------------------------------- mountains
def _peak(canvas, x, y, w, h, r, snow, stroke, shade_a=0.8):
    """One peak: base centred at (x, y), w wide, h high. Lit face (left), shaded face (right) hatched, outline."""
    lean = r.uniform(-0.1, 0.1) * w
    sx, sy = x + lean, y - h
    ls = (x - w * r.uniform(0.2, 0.3) + lean * 0.3, y - h * r.uniform(0.45, 0.6))
    rs = (x + w * r.uniform(0.18, 0.28) + lean * 0.3, y - h * r.uniform(0.38, 0.55))
    bl, br = (x - w / 2, y), (x + w / 2, y)
    outline = skia.Path()
    outline.moveTo(*bl)
    outline.lineTo(*ls)
    outline.lineTo(sx - w * 0.03, sy + h * 0.07)
    outline.lineTo(sx, sy)
    outline.lineTo(sx + w * 0.06, sy + h * 0.1)
    outline.lineTo(*rs)
    outline.lineTo(*br)
    face = skia.Path(outline)
    face.close()
    canvas.drawPath(face, paint(ROCK_LIGHT, 0.88))
    foot = (x + w * r.uniform(0.0, 0.12), y)
    shade = skia.Path()
    shade.moveTo(sx, sy)
    shade.lineTo(sx + w * 0.06, sy + h * 0.1)
    shade.lineTo(*rs)
    shade.lineTo(*br)
    shade.lineTo(*foot)
    shade.close()
    canvas.drawPath(shade, paint(ROCK_SHADE, shade_a))
    if snow > 0:
        cut = 0.2 + 0.28 * snow
        cap = skia.Path()
        cap.moveTo(sx, sy)
        cap.lineTo(sx + w * 0.06, sy + h * 0.1)
        cap.lineTo(sx + (rs[0] - sx) * cut * 1.7, sy + (rs[1] - sy) * cut * 1.7)
        cap.lineTo(sx + w * 0.03, sy + h * cut * 0.75)
        cap.lineTo(sx - w * 0.05, sy + h * cut * 1.1)
        cap.lineTo(sx + (ls[0] - sx) * cut * 1.6, sy + (ls[1] - sy) * cut * 1.6)
        cap.close()
        canvas.drawPath(cap, paint(SNOW, 0.95))
        capr = skia.Path()
        capr.moveTo(sx, sy)
        capr.lineTo(sx + w * 0.06, sy + h * 0.1)
        capr.lineTo(sx + (rs[0] - sx) * cut * 1.7, sy + (rs[1] - sy) * cut * 1.7)
        capr.lineTo(sx + w * 0.03, sy + h * cut * 0.75)
        capr.close()
        canvas.drawPath(capr, paint(SNOW_SHADE, 0.9))
    # Hatching across the shaded face, parallel to its fall line.
    hatch = skia.Path()
    n = max(2, int(w / 5))
    for i in range(n):
        t = (i + 0.7) / (n + 0.4)
        ax = sx + (br[0] - sx) * t * 0.92 + w * 0.02
        ay = sy + (br[1] - sy) * t * 0.92 + h * 0.08
        if snow > 0 and t < 0.22 + 0.3 * snow:
            continue
        hatch.moveTo(ax, ay)
        hatch.lineTo(ax - w * 0.09, ay + h * 0.24)
    canvas.drawPath(hatch, paint(INK, 0.5, stroke=stroke * 0.65))
    spur = skia.Path()
    spur.moveTo(sx, sy)
    spur.lineTo(foot[0] + w * 0.05, sy + (y - sy) * 0.55)
    spur.lineTo(*foot)
    canvas.drawPath(spur, paint(INK, 0.6, stroke=stroke * 0.75))
    canvas.drawPath(outline, paint(INK, 0.92, stroke=stroke))


def mountain(canvas, x, y, w, seed, snow=0.0, ink=1.0):
    """A mountain whose base is centred at (x, y), `w` px wide: a main peak, often with a lower one behind it to a
    side, drawn back to front; snow (0-1) caps the top."""
    r = rng(seed)
    stroke = max(0.55, w * 0.04) * ink
    h = w * r.uniform(0.55, 0.72)
    side = r.uniform()
    if side < 0.75:
        # A lower shoulder peak behind, to one side.
        d = 1 if r.uniform() < 0.5 else -1
        w2 = w * r.uniform(0.55, 0.75)
        _peak(canvas, x + d * w * r.uniform(0.28, 0.38), y - h * 0.08, w2, h * r.uniform(0.55, 0.75), r, snow * 0.7, stroke * 0.9, 0.7)
    _peak(canvas, x, y, w, h, r, snow, stroke)


def hill(canvas, x, y, w, seed, ink=1.0):
    """A low rounded hill: a single arc with a little shading on its right."""
    r = rng(seed)
    h = w * r.uniform(0.28, 0.38)
    p = skia.Path()
    p.moveTo(x - w / 2, y)
    p.cubicTo(x - w * 0.3, y - h, x + w * 0.15, y - h * 1.05, x + w / 2, y)
    shade = skia.Path()
    shade.moveTo(x + w * 0.05, y - h * 0.72)
    shade.cubicTo(x + w * 0.28, y - h * 0.62, x + w * 0.42, y - h * 0.3, x + w / 2, y)
    shade.lineTo(x + w * 0.12, y)
    shade.close()
    canvas.drawPath(shade, paint(ROCK_SHADE, 0.45))
    canvas.drawPath(p, paint(INK, 0.8, stroke=max(0.55, w * 0.05) * ink))


# ---------------------------------------------------------------- marsh, grass, sand
def marsh(canvas, x, y, s, seed):
    r = rng(seed)
    reeds = skia.Path()
    for dx in (-0.25, 0.0, 0.22):
        hh = s * r.uniform(0.35, 0.55)
        reeds.moveTo(x + dx * s, y)
        reeds.lineTo(x + dx * s + r.uniform(-0.06, 0.06) * s, y - hh)
    canvas.drawPath(reeds, paint(REED, 0.85, stroke=max(0.5, s * 0.07)))
    water = skia.Path()
    water.moveTo(x - s * 0.45, y + s * 0.08)
    water.lineTo(x + s * 0.4, y + s * 0.08)
    water.moveTo(x - s * 0.25, y + s * 0.24)
    water.lineTo(x + s * 0.3, y + s * 0.24)
    canvas.drawPath(water, paint(WATER_INK, 0.7, stroke=max(0.5, s * 0.06)))


def grass(canvas, x, y, s, alpha=0.5):
    p = skia.Path()
    p.moveTo(x - s * 0.25, y - s * 0.3)
    p.lineTo(x, y)
    p.lineTo(x + s * 0.2, y - s * 0.35)
    canvas.drawPath(p, paint(INK_SOFT, alpha, stroke=max(0.45, s * 0.08)))


# ---------------------------------------------------------------- review sheet
def export_svg(out_dir):
    """Write each symbol as an SVG file (vector), for review and reuse."""
    out_dir.mkdir(parents=True, exist_ok=True)
    items = [
        ("tree-broadleaf", lambda c: _draw_tree(c, "broadleaf")),
        ("tree-conifer", lambda c: _draw_tree(c, "conifer")),
        ("mountain", lambda c: mountain(c, 50, 80, 80, 7)),
        ("mountain-snow", lambda c: mountain(c, 50, 80, 80, 11, snow=1.0)),
        ("hill", lambda c: hill(c, 50, 70, 70, 3)),
        ("marsh", lambda c: marsh(c, 50, 60, 60, 5)),
    ]
    for name, fn in items:
        stream = skia.FILEWStream(str(out_dir / f"{name}.svg"))
        canvas = skia.SVGCanvas.Make((100, 100), stream)
        fn(canvas)
        del canvas
        stream.flush()


def _draw_tree(c, kind):
    c.save()
    c.translate(50, 85)
    if kind == "broadleaf":
        crown, (cx, cy, rad) = broadleaf_path(70, 1)
        c.drawLine(0, 0, 0, cy + rad * 0.4, paint(INK_SOFT, 0.95, stroke=6))
        c.drawPath(crown, paint(LEAF))
        c.drawPath(crown, paint(INK, 0.9, stroke=4))
    else:
        cone, h = conifer_path(70, 1)
        c.drawPath(cone, paint(NEEDLE))
        c.drawPath(cone, paint(INK, 0.9, stroke=4))
    c.restore()
