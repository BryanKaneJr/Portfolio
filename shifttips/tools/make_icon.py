"""ShiftTips app icon: a white receipt on ink, its total highlighted.

Usage: python3 tools/make_icon.py ShiftTips/Assets.xcassets/AppIcon.appiconset/AppIcon.png
Needs Pillow. Colors match Theme.swift.
"""
import sys
from PIL import Image, ImageDraw

S, K = 1024, 4
N = S * K
INK = (14, 14, 14)
WHITE = (255, 255, 255)
VOLT = (212, 255, 58)
GRAY = (196, 196, 190)

img = Image.new("RGB", (N, N), INK)
d = ImageDraw.Draw(img)
w, h = 600 * K, 760 * K
x0 = (N - w) // 2
y0 = 120 * K
tooth, depth = 60 * K, 36 * K
pts = [(x0, y0), (x0 + w, y0), (x0 + w, y0 + h - depth)]
n = round(w / tooth)
step = w / n
for i in range(n):
    right = x0 + w - i * step
    pts.append((right - step / 2, y0 + h))
    pts.append((right - step, y0 + h - depth))
d.polygon(pts, fill=WHITE)

lx, lw, lh = x0 + 84 * K, w - 168 * K, 40 * K
y = y0 + 120 * K
for frac in (0.5, 0.82, 0.66):
    d.rectangle([lx, y, lx + lw * frac, y + lh], fill=GRAY)
    y += 92 * K
y += 4 * K
d.rectangle([lx, y, lx + lw, y + 14 * K], fill=INK)
d.rectangle([lx, y + 30 * K, lx + lw, y + 44 * K], fill=INK)
y += 92 * K
d.rectangle([lx - 36 * K, y - 26 * K, lx + lw + 36 * K, y + lh + 66 * K], fill=VOLT)
d.rectangle([lx, y + 8 * K, lx + lw * 0.28, y + lh + 32 * K], fill=INK)
d.rectangle([lx + lw * 0.42, y + 8 * K, lx + lw, y + lh + 32 * K], fill=INK)

img.resize((S, S), Image.LANCZOS).save(sys.argv[1], "PNG")
