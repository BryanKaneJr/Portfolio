"""Frames the App Store screenshots with headlines.

Usage: python3 tools/frame_screenshots.py ATTACHMENTS_DIR OUT_DIR

ATTACHMENTS_DIR is the output of `xcrun xcresulttool export attachments`
(a manifest.json plus files), or any folder of PNGs whose names start
with the attachment names in ShiftTipsUITests/AppStoreScreenshots.swift
("store-01-review", ...). Writes OUT_DIR/NN-key.png, 1320 x 2868 (the
6.9-inch iPhone size App Store Connect asks for), and the unframed
screenshots to OUT_DIR/raw. Needs Pillow. Uses SF Pro Rounded where the
system has it (macOS), otherwise a fallback font, for previews.
"""
import glob
import json
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

W, H = 1320, 2868
YELLOW = (255, 214, 10)
INK = (20, 20, 20)
PAPER = (242, 241, 236)

# key: (headline, subline, dark background)
CAPTIONS = {
    "review": ("Every cent, accounted for.", "Splits reconcile to the cent, every time.", False),
    "new-shift": ("Tips and hours. Done.", "Save your crew once. Close out in a minute.", False),
    "saved": ("Save it. Share it.", "A clear breakdown for the whole crew, as text or PDF.", False),
    "totals": ("Pay-period totals in a tap.", "Each person's tips for the week or the month.", False),
    "history": ("Every shift, kept.", "Saved shifts never change, and stay on your iPhone.", False),
    "tip-out": ("Tip-outs, worked out.", "Percent of tips or sales, shared by hours.", False),
    "styles": ("Run it your way.", "Pools, points or tip-outs. Every number is yours.", False),
    "dark": ("Easy on the eyes at close.", "Full dark mode for the back office.", True),
    "points": ("Points by role, built in.", "Hours times points, set from your house policy.", False),
    "welcome": ("Simple or Advanced.", "No account, no ads. Everything stays on your iPhone.", False),
}

FONT_PATHS = [
    "/System/Library/Fonts/SFNSRounded.ttf",
    "/System/Library/Fonts/SFNS.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def font(size, weight):
    for path in FONT_PATHS:
        if not os.path.exists(path):
            continue
        face = ImageFont.truetype(path, size)
        try:
            axes = face.get_variation_axes()
            face.set_variation_by_axes([weight if "eight" in str(a.get("name", "")) else a["default"] for a in axes])
        except Exception:
            pass
        return face
    return ImageFont.load_default()


def wrap(draw, text, face, width):
    """Wraps to the fewest lines, then balances two lines so neither ends
    with a lone word."""
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=face) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    lines.append(line)
    if len(lines) == 2:
        words = text.split()
        best = None
        for cut in range(1, len(words)):
            first, second = " ".join(words[:cut]), " ".join(words[cut:])
            longest = max(draw.textlength(first, font=face), draw.textlength(second, font=face))
            if longest <= width and (best is None or longest < best[0]):
                best = (longest, [first, second])
        if best:
            lines = best[1]
    return lines


def screenshots(folder):
    """Yields (number, key, path) for every store screenshot in folder."""
    found = {}
    manifest = os.path.join(folder, "manifest.json")
    if os.path.exists(manifest):
        with open(manifest) as handle:
            for test in json.load(handle):
                for item in test.get("attachments", []):
                    name = item.get("suggestedHumanReadableName", "")
                    match = re.match(r"store-(\d+)-([a-z-]+?)(?:_\d+)?(?:_[0-9A-F-]+)?\.png$", name)
                    if match:
                        found[match.group(1)] = (match.group(2), os.path.join(folder, item["exportedFileName"]))
    for path in glob.glob(os.path.join(folder, "store-*.png")):
        match = re.match(r"store-(\d+)-([a-z-]+?)(?:_.*)?\.png$", os.path.basename(path))
        if match:
            found.setdefault(match.group(1), (match.group(2), path))
    for number in sorted(found):
        yield number, found[number][0], found[number][1]


def frame(shot, headline, subline, dark):
    background, ink = (INK, PAPER) if dark else (YELLOW, INK)
    canvas = Image.new("RGB", (W, H), background)
    draw = ImageDraw.Draw(canvas)

    # The phone: the screenshot with rounded corners in an ink bezel.
    phone_w = 960
    screen = shot.convert("RGB").resize((phone_w, round(shot.height * phone_w / shot.width)), Image.LANCZOS)
    radius = 110
    mask = Image.new("L", screen.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, screen.width - 1, screen.height - 1], radius=radius, fill=255)
    bezel = 22
    phone_h = screen.height + bezel * 2
    top = H - phone_h - 110
    left = (W - (phone_w + bezel * 2)) // 2
    edge = (60, 60, 60) if dark else INK
    draw.rounded_rectangle([left, top, left + phone_w + bezel * 2, top + phone_h], radius=radius + bezel, fill=edge)
    canvas.paste(screen, (left + bezel, top + bezel), mask)

    # The words, centered in the space above the phone.
    title_face = font(104, 850)
    sub_face = font(50, 500)
    width = W - 180
    title_lines = wrap(draw, headline, title_face, width)
    sub_lines = wrap(draw, subline, sub_face, width)
    title_h, sub_h, gap = 122, 66, 34
    block = len(title_lines) * title_h + gap + len(sub_lines) * sub_h
    y = max(110, (top - block) // 2)
    for line in title_lines:
        draw.text((W / 2, y), line, font=title_face, fill=ink, anchor="ma")
        y += title_h
    y += gap
    sub_ink = tuple(int(c * 0.78 + b * 0.22) for c, b in zip(ink, background))
    for line in sub_lines:
        draw.text((W / 2, y), line, font=sub_face, fill=sub_ink, anchor="ma")
        y += sub_h
    return canvas


def main():
    source, out = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.join(out, "raw"), exist_ok=True)
    count = 0
    for number, key, path in screenshots(source):
        shot = Image.open(path)
        shot.convert("RGB").save(os.path.join(out, "raw", f"{number}-{key}.png"))
        headline, subline, dark = CAPTIONS.get(key, (key.replace("-", " ").title(), "", False))
        frame(shot, headline, subline, dark).save(os.path.join(out, f"{number}-{key}.png"))
        count += 1
        print(f"{number}-{key}.png from {os.path.basename(path)} ({shot.width} x {shot.height})")
    if count == 0:
        sys.exit("No store screenshots found in " + source)


if __name__ == "__main__":
    main()
