# The painting

`fullmap.png` is the owner's painting of the whole map: the game's frame and the margins seen past its edges, in the
map's projection (painted over `crowns-map-template-extended.png`, which `map.margin` defines: 147°W–93°E,
85°N–72°S; 4175 × 5042 map units). It is 9400 × 11360 px and 157 MB, so it is kept out of git: the owner holds the
original. The game uses the tiles made from it, which are committed (`assets/map/painting`, `src/ui/map/paintingTiles.ts`).

To use a new version: put it here as `fullmap.png` (same proportions as the template, any size; bigger is sharper
close up) and run `npm run painting:build`. The build reads where the painting has land and sea, bends it a few map
units at most so its coasts lie on the game's, fills what still disagrees near a coast, and cuts it into tiles.
`PAINT_DEBUG=<dir> npm run painting:build` writes pictures of the land before and after the fit.

At 2.25 px per map unit it is sharp zoomed out and soft close up: the game's frame (the dashed box on the template)
at twice or more this resolution would be sharp at the zoom the game is played at.
