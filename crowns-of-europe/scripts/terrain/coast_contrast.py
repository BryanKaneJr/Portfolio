"""Colour difference (CIELAB ΔE76) between the sea and the land along the coast, measured on the in-game screenshots.

The game's own land outline is rasterised into each screenshot's pixels (camera centre at the screen centre, k from
the view, 3x). In 90 x 90 px blocks (30 x 30 pt) that hold both, the median colour of the sea 4-24 px off the coast is
compared with the median colour of the land 4-24 px inside it. The top bar and the dock are left out.
Run from scripts/terrain with the pipeline's Python, after npm run screens:terrain (views and cameras are in
scripts/screens-terrain.mjs):
  python coast_contrast.py ../../docs/terrain/screens/adriatic-play-after.jpg,2000,935,1.7 ...
Prints, per screenshot, the number of blocks, the median and 10th-percentile ΔE, and the share of blocks under 10."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
import prepare, mapproj as mp  # noqa: E402

W, H, DPR = 390, 844, 3


def lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def measure(path, cx, cy, k, geoms):
    img = np.asarray(Image.open(path).convert('RGB'), np.float32)
    g = mp.Grid(cx - W / 2 / k, cy - H / 2 / k, k * DPR, W * DPR, H * DPR)
    land = prepare.coverage(geoms, g) > 127
    d_sea = ndimage.distance_transform_edt(~land)
    d_land = ndimage.distance_transform_edt(land)
    sea_band = (~land) & (d_sea >= 4) & (d_sea <= 24)
    land_band = land & (d_land >= 4) & (d_land <= 24)
    keep = np.zeros_like(land); keep[330:2150, :] = True
    sea_band &= keep; land_band &= keep
    L = lab(img)
    des = []
    B = 90
    for y in range(0, land.shape[0] - B + 1, B):
        for x in range(0, land.shape[1] - B + 1, B):
            s = sea_band[y:y + B, x:x + B]; l = land_band[y:y + B, x:x + B]
            if s.sum() < 300 or l.sum() < 300:
                continue
            ls = np.median(L[y:y + B, x:x + B][s], 0); ll = np.median(L[y:y + B, x:x + B][l], 0)
            des.append(float(np.linalg.norm(ls - ll)))
    des = np.array(des)
    return {'blocks': len(des), 'median': round(float(np.median(des)), 1), 'p10': round(float(np.percentile(des, 10)), 1),
            'min': round(float(des.min()), 1), 'share_under_10': round(float((des < 10).mean()), 3)}


if __name__ == '__main__':
    geoms = prepare.game_land_geoms()
    for spec in sys.argv[1:]:
        path, cx, cy, k = spec.split(',')
        print(path.split('/')[-2] + '/' + path.split('/')[-1], measure(path, float(cx), float(cy), float(k), geoms))
