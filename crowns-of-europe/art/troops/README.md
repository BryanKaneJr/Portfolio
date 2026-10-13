# Troop drawings

Soldiers drawn for this game by its owner, used for the armies on the map. `scripts/build-units.ts`
(`npm run units:build`) cuts each to what is drawn, makes it smaller (192 px tall) into `assets/units`, and lists it in
`src/ui/map/unitArt.ts`. The map draws a lone soldier for a small army (one of the two, by the army), four men from 4
regiments and five from 10 (`troopArt` in `src/ui/map/MapView.tsx`), each under its realm's banner.

Each stands on its bottom edge, on a transparent ground. More drawings in the same style can be added here and to `ART`
in the build script.

| File | What it is |
| --- | --- |
| `soldier-a.png` | a lone halberdier |
| `soldier-b.png` | a lone halberdier, slashed sleeves |
| `squad-4.png` | four pikemen |
| `squad-5.png` | five men, pikes and a halberd |
