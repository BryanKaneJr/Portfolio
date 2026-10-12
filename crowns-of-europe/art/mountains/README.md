# Mountain drawings

Ink drawings of mountain ranges, made for this game by its owner. `scripts/build-terrain.ts` (`npm run terrain:build`)
makes them ready for the map in `assets/map/mountains` (cut to what is drawn, made smaller, the ink made to darken
the land under it so the country's colour shows through) and lays them over the real ranges.

Each runs from upper left to lower right, lit from the upper left; a range running the other way gets one mirrored.
More drawings in the same style (ranges running from lower left to upper right, long east–west ranges, small
clusters) can be added here and to `ART` in the build script.

| File | What it is |
| --- | --- |
| `ridge.png` | a single ridge, falling to the lower right |
| `range.png` | a wide range of several ridges, gently falling |
| `steep.png` | a ridge falling steeply |
| `great.png` | a great massif |
| `massif.png` | a massif |
| `scattered.png` | small scattered groups, for low or narrow ranges |
