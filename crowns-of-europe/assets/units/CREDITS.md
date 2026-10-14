# Unit sprites: credits

The armies (`soldier-a.png`, `soldier-b.png`, `squad-4.png`, `squad-5.png`) and fleets (`ship.png`, `fleet.png`) are
the owner's own drawings, made for the game (`art/troops`, `art/ships`), cut and made smaller by `scripts/build-units.ts`
(`npm run units:build`).

The towns on the map are rendered by `scripts/build-models.mjs` (`npm run models:build`) from free 3D models, arranged
there into villages, towns and cities, each also inside town walls.
All of them are public domain under CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/): no attribution is
required, but we credit the authors with thanks. The build script checks each pack's licence file before using it.
The colours are muted and the outlines and shadows are added by the script.

| Sprite | Models | Author | Source | Licence |
| --- | --- | --- | --- | --- |
| `town-village.png` | `building_home_A`, `building_home_B`, `tree_single_B` (Medieval Hexagon Pack 1.0) | Kay Lousberg (KayKit) | https://kaylousberg.itch.io/kaykit-medieval-hexagon, files from https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 | CC0 1.0 |
| `town-town.png` | `building_church`, `building_home_A`, `building_home_B`, `tree_single_B` | Kay Lousberg (KayKit) | as above | CC0 1.0 |
| `town-city.png` | `building_tower_B`, `building_church`, `building_market`, `building_home_A`, `building_home_B` | Kay Lousberg (KayKit) | as above | CC0 1.0 |
| `town-*-walled.png` | as the unwalled one, inside `wall_straight`, `wall_straight_gate` and `building_tower_base` | Kay Lousberg (KayKit) | as above | CC0 1.0 |

Kay Lousberg: www.kaylousberg.com.
