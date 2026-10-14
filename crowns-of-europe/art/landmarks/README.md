# Landmark paintings

Paintings of the fifteen landmarks (`src/content/landmarks.json`), made for this game by its owner: warm gold and
sepia, each building alone on a transparent ground, 1024 x 1024 px. They are the landmarks' pictures everywhere, on
the map beside the region's town and on the region sheet, and are shown as painted (never recoloured).

Each file is named after its landmark's id. `scripts/build-landmarks.ts` (`npm run landmarks:build`) cuts each to what
is painted (ignoring the faint speckle round the edges), makes it smaller so its longer side is 192 px (area-averaged,
in premultiplied colour), writes it to `assets/landmarks/<id>.png` as a 256-colour PNG with transparency (about 20 KB
each), and lists it with its size and where it stands in `src/ui/map/landmarkArt.ts`. A new landmark needs its
painting here under its id, then the build; `npm run validate` checks that every landmark has one.

| File | Landmark |
| --- | --- |
| `hagia_sophia.png` | Hagia Sophia (Constantinople) |
| `st_peters.png` | St Peter's (Rome) |
| `duomo.png` | The Duomo (Tuscany) |
| `dome_of_rock.png` | Dome of the Rock (Palestine) |
| `notre_dame.png` | Notre-Dame (Île-de-France) |
| `st_stephens.png` | St Stephen's (Austria) |
| `westminster.png` | Westminster (London) |
| `alhambra.png` | The Alhambra (Granada) |
| `kremlin.png` | The Kremlin (Moscow) |
| `arsenal.png` | The Arsenal (Veneto) |
| `pyramids.png` | The Pyramids (Cairo) |
| `templo_mayor.png` | Templo Mayor (Anáhuac) |
| `djinguereber.png` | Djinguereber (Timbuktu) |
| `charles_bridge.png` | Charles Bridge (Bohemia) |
| `giralda.png` | The Giralda (Andalusia) |
