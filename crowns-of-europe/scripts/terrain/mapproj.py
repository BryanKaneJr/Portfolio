"""
The game's map projection, exactly as scripts/build-map.ts and scripts/lib/geo.ts define it, and the canonical
pixel grids the terrain pipeline warps every dataset onto.

The game projects lon/lat (WGS84 degrees, treated as spherical coordinates) with spherical Mercator, scaled so the
map is `width` units from `west` to `east`, with y = 0 at `north`:

    x = (lon - west) * RAD * S                         S = width / ((east - west) * RAD)   (units per radian)
    y = (-ln(tan(pi/4 + lat*RAD/2)) - top) * S         top = -ln(tan(pi/4 + north*RAD/2))

EPSG:3857 (Web Mercator) is the same spherical Mercator with radius R = 6378137 m:

    X = R * lon * RAD,   Y = R * ln(tan(pi/4 + lat*RAD/2))

so map units are an exact affine transform of EPSG:3857 metres:

    x = X * S / R - west * RAD * S,    y = -Y * S / R - top * S

That is what lets GDAL warp any lon/lat dataset straight onto the game's grid: a grid of `ppu` pixels per map unit
whose top-left corner is map point (x0, y0) is an EPSG:3857 grid with the geotransform from `grid_transform`.
"""
import json
import math
from dataclasses import dataclass

from affine import Affine

from config import MAP_JSON

RAD = math.pi / 180
R = 6378137.0  # EPSG:3857 sphere radius, metres

_map = json.loads(MAP_JSON.read_text())
W = _map["width"]
H = _map["height"]
WEST = _map["projection"]["west"]
EAST = _map["projection"]["east"]
NORTH = _map["projection"]["north"]
assert _map["projection"]["type"] == "mercator", _map["projection"]
S = W / ((EAST - WEST) * RAD)  # map units per radian
TOP = -math.log(math.tan(math.pi / 4 + (NORTH * RAD) / 2))
MARGIN_X, MARGIN_Y = _map["margin"]


def to_map(lon, lat):
    """lon/lat (degrees) to map units. Works on floats or numpy arrays."""
    import numpy as np

    lat = np.clip(lat, -85.05112878, 85.05112878)
    x = (np.asarray(lon) - WEST) * RAD * S
    y = (-np.log(np.tan(math.pi / 4 + (lat * RAD) / 2)) - TOP) * S
    return x, y


def to_lonlat(x, y):
    """Map units to lon/lat (degrees)."""
    import numpy as np

    lon = WEST + np.asarray(x) / S / RAD
    lat = (2 * np.arctan(np.exp(-(np.asarray(y) / S + TOP))) - math.pi / 2) / RAD
    return lon, lat


def map_to_3857(x, y):
    return (x + WEST * RAD * S) * R / S, -(y + TOP * S) * R / S


def from_3857(X, Y):
    return X * S / R - WEST * RAD * S, -Y * S / R - TOP * S


@dataclass(frozen=True)
class Grid:
    """A pixel grid in map units: `ppu` pixels per unit, top-left corner at map point (x0, y0)."""

    x0: float
    y0: float
    ppu: float
    width: int
    height: int

    @property
    def transform(self) -> Affine:
        """The grid's geotransform in EPSG:3857 metres (pixel corner convention)."""
        X0, Y0 = map_to_3857(self.x0, self.y0)
        m = R / (S * self.ppu)  # metres per pixel in EPSG:3857
        return Affine(m, 0.0, X0, 0.0, -m, Y0)

    def pixel_to_map(self, col, row):
        return self.x0 + col / self.ppu, self.y0 + row / self.ppu

    def map_to_pixel(self, x, y):
        return (x - self.x0) * self.ppu, (y - self.y0) * self.ppu

    def sub(self, x0, y0, x1, y1, ppu=None):
        """The sub-grid covering map box [x0, x1) x [y0, y1) at `ppu` (default: this grid's)."""
        p = ppu or self.ppu
        return Grid(x0, y0, p, int(round((x1 - x0) * p)), int(round((y1 - y0) * p)))


def region_grid(region, margin, ppu) -> Grid:
    x0, y0, x1, y1 = region
    return Grid(x0 - margin, y0 - margin, ppu, int((x1 - x0 + 2 * margin) * ppu), int((y1 - y0 + 2 * margin) * ppu))


def km_per_unit(lat):
    """Ground distance of one map unit at a latitude (km, on the WGS84 mean sphere). Floats or numpy arrays."""
    import numpy as np

    return 6371.0088 / S * np.cos(np.asarray(lat) * RAD)
