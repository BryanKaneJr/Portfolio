# Ship drawings

Ships drawn for this game by its owner, used for the fleets on the map. `scripts/build-units.ts` (`npm run units:build`)
cuts each to what is drawn, makes it smaller (192 px tall) into `assets/units`, notes where its tallest mast stands (the
realm's banner flies from it), and lists it in `src/ui/map/unitArt.ts`. The map draws the lone ship for a fleet of up to
4 ships and the group from 5 (`shipArt` in `src/ui/map/MapView.tsx`).

| File | What it is |
| --- | --- |
| `ship.png` | a lone ship, three masts |
| `fleet.png` | five ships sailing together |
