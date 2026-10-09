"""ShiftTips app icon: a white receipt on ink, its total highlighted yellow.

Usage: python3 tools/make_icon.py ShiftTips/Assets.xcassets/AppIcon.appiconset/AppIcon.png
Needs Pillow. Colors match Theme.swift.
"""
import sys
from PIL import Image, ImageDraw

S, K = 1024, 4
N = S * K
INK = (20, 20, 20)
WHITE = (255, 255, 255)
YELLOW = (255, 214, 10)
GRAY = (204, 203, 196)

img = Image.new("RGB", (N, N), INK)
d = ImageDraw.Draw(img)

# The receipt: rounded top corners, scalloped bottom.
w, h = 600 * K, 740 * K
x0 = (N - w) // 2
y0 = 130 * K
r = 64 * K
scallop = 30 * K
bottom = y0 + h - scallop
d.rounded_rectangle([x0, y0, x0 + w, bottom], radius=r, fill=WHITE)
d.rectangle([x0, bottom - r, x0 + w, bottom], fill=WHITE)
count = round(w / (scallop * 2))
step = w / count
for i in range(count):
    cx = x0 + step * i + step / 2
    d.ellipse([cx - step / 2, bottom - step / 2, cx + step / 2, bottom + step / 2], fill=WHITE)

# Printed lines, rounded.
lx, lw, lh = x0 + 84 * K, w - 168 * K, 40 * K
y = y0 + 120 * K
for frac in (0.5, 0.82, 0.66):
    d.rounded_rectangle([lx, y, lx + lw * frac, y + lh], radius=lh // 2, fill=GRAY)
    y += 92 * K
y += 4 * K
d.rounded_rectangle([lx, y, lx + lw, y + 14 * K], radius=7 * K, fill=INK)
d.rounded_rectangle([lx, y + 30 * K, lx + lw, y + 44 * K], radius=7 * K, fill=INK)

# The total, highlighted.
y += 92 * K
d.rounded_rectangle([lx - 36 * K, y - 26 * K, lx + lw + 36 * K, y + lh + 66 * K], radius=34 * K, fill=YELLOW)
d.rounded_rectangle([lx, y + 8 * K, lx + lw * 0.28, y + lh + 32 * K], radius=lh // 2, fill=INK)
d.rounded_rectangle([lx + lw * 0.42, y + 8 * K, lx + lw, y + lh + 32 * K], radius=lh // 2, fill=INK)

img.resize((S, S), Image.LANCZOS).save(sys.argv[1], "PNG")
