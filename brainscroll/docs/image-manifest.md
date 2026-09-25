# Image list

A small, reusable set of illustrations for BrainScroll, in the same style as the icon generator's first batch. Distinct things get their own image (Mars, Saturn, the Colosseum). Similar concepts share one (ruins cover the fall of Carthage, the sack of Rome and archaeology; one star covers most star-physics levels). Every level in all 16 trees maps to exactly one image below.

**376 distinct images cover all 16 trees (1,600 levels), about four levels per image.** Your library already has some of them: the first batch, plus whatever you approved from the first-round list. The image tool knows which, so let it skip those. The next section shows where a first-round image can stand in for a planned one.

## Style (every image)

- One glossy 3D "clay" object, centered, soft light from the top left, gentle shadow.
- **Transparent background** (PNG with alpha). The app background is now Slate `#131F24`, so a baked-in navy square would show. Images already made on navy `#111827` need their background removed, or regenerating on transparent.
- Warm saturated colors. Gold only on the mastery images (one per tree) and the mastery star.
- One object per image. A mass of identical small things (a stack of coins, a crowd, a cluster of crystals) counts as one object.
- No text, letters or numbers, and no real people's faces.
- 1024 × 1024 PNG named by its ID.

## Already approved? Swap it in

The first-round list (213 images, one per level) had many images that fit a planned image below just as well. If one of these first-round images is already approved, use it and skip generating the planned one. A machine-readable copy is in [`image-substitutes.json`](image-substitutes.json).

| Planned image | First-round image that can stand in |
| --- | --- |
| `astronomy.moon` | `astronomy.moon-craters` |
| `astronomy.icy-moon` | `astronomy.europa` |
| `astronomy.asteroid` | `astronomy.asteroids` |
| `astronomy.uranus-neptune` | `astronomy.tilted-uranus` |
| `astronomy.star-chart` | `astronomy.constellation` |
| `astronomy.orrery` | `astronomy.heliocentric` |
| `astronomy.space-telescope` | `astronomy.webb` |
| `astronomy.black-hole` | `astronomy.event-horizon` |
| `astronomy.exoplanet` | `astronomy.exoplanet-transit` |
| `astronomy.galaxy` | `astronomy.milky-way` |
| `astronomy.galaxy-cluster` | `astronomy.local-group` |
| `astronomy.dying-star` | `astronomy.white-dwarf` |
| `astronomy.nebula` | `astronomy.planetary-nebula` |
| `rome.hills-and-river` | `rome.seven-hills` |
| `rome.pottery` | `rome.etruscan-vase` |
| `rome.forum` | `rome.curia` |
| `rome.farm` | `rome.plough` |
| `rome.city-fire` | `rome.great-fire` |
| `rome.road` | `rome.stone-road`, `rome.milestone-marker` |
| `rome.warship` | `rome.carthage-ship`, `rome.corvus` |
| `rome.legion` | `rome.legion-kit` |
| `rome.broken-chains` | `rome.freedom-cap` |
| `rome.laurel` | `rome.laurel-wreath` |
| `rome.arch` | `rome.triumphal-arch` |
| `rome.calendar` | `rome.calendar-wheel` |
| `rome.wall` | `rome.hadrians-wall` |
| `rome.house` | `rome.domus` |
| `rome.amphora` | `rome.amphora-feast` |
| `rome.dome` | `rome.pantheon` |
| `rome.coins` | `rome.denarius` |
| `rome.chi-rho` | `rome.chi-rho-shield` |
| `rome.ruins` | `rome.crumbling-column` |
| `rome.bronze-tablets` | `rome.citizen-diploma` |
| `rome.temple` | `rome.greek-temple` |
| `nature.volcano` | `rome.vesuvius` |
| `money.capitol` | `rome.capitol-dome` |
| `money.scale` | `rome.scales` |
| `arts.stonehenge` | `astronomy.stone-circle` |
| `arts.candle` | `rome.catacomb-lamp` |
| `object.magnifier` | `rome.archaeology-kit` |
| `ui.review` | `ui.review-clear` |

First-round images that aren't listed here or used by a tree below are still fine to keep in the library for later levels.

## Mascot

Dr. Scroll, a cute, round old genius in a tweed jacket and violet bow tie, has 29 poses: waving, pointing at a card, thinking, cheering, a kind shrug for wrong answers, and one per subject. His look, the rules that keep him an original character, and how to keep him consistent are in [`mascot.md`](mascot.md). Make `mascot.reference` first and generate every pose from it.

## Subjects, skills and app screens

| Image ID | Draw | Used for |
| --- | --- | --- |
| `artifact.roman-helmet` | **existing.** Gold Roman helmet with a red crest | History subject |
| `science.microscope` | **existing.** Blue microscope | Science subject |
| `object.globe` | **existing.** Globe on a stand | Geography subject |
| `architecture.bank` | **existing.** Classical bank building | Money & Economics subject |
| `object.palette` | Painter's palette with paint blobs and a brush | Arts & Culture subject |
| `technology.gears` | Two interlocking gears | How the World Works subject |
| `object.book` | **existing.** Orange book (open works too) | Sign-in screen |
| `plant.tree` | **existing.** Green tree | Daily Knowledge Complete ("go outside") |
| `ui.review` | Stack of cards with a circular refresh arrow | Review tab |
| `ui.mastery-star` | Gold star with a soft halo | Mastery moments |

The two skills reuse level images: Astronomy uses `object.telescope`, Ancient Rome uses `rome.colosseum`.

## Astronomy (34 images)

Checkpoints (every 10th level) reuse their chapter's image, listed with "(checkpoint)".

| Image ID | Draw | Levels |
| --- | --- | --- |
| `astronomy.earth` | Blue Earth with white cloud swirls | 1, 5, 12, 22, 43, 10 (checkpoint) |
| `astronomy.sun` | Glowing orange-yellow Sun with a few soft flares | 2, 56, 57, 60 (checkpoint) |
| `astronomy.moon` | Grey cratered Moon | 6, 17, 18, 19, 39 |
| `astronomy.eclipse` | Dark Moon disc covering the Sun, glowing corona around it | 7 |
| `astronomy.rocky-planets` | Small grey rocky planet with craters | 3 |
| `astronomy.saturn` | Saturn with its rings | 4 |
| `astronomy.jupiter` | Banded Jupiter with the Great Red Spot | 46 |
| `astronomy.mercury` | Small cratered grey planet | 41 |
| `astronomy.venus` | Yellow planet wrapped in thick swirling clouds | 42 |
| `astronomy.mars` | Rusty red planet | 44 |
| `astronomy.uranus-neptune` | Pale cyan ice giant tipped on its side | 29, 49 |
| `astronomy.icy-moon` | Icy moon with cracks, a hint of blue ocean below | 47, 48 |
| `astronomy.pluto` | Small beige world with a pale heart-shaped patch | 51 |
| `astronomy.asteroid` | Lumpy grey space rocks | 45, 52, 54 |
| `astronomy.comet` | Icy comet with a glowing two-part tail | 53, 55 |
| `astronomy.star` | One bright star with soft glow rings | 8, 9, 14, 61, 62, 63, 64, 65 |
| `astronomy.star-chart` | Round star chart with a few constellations joined by lines | 11, 13, 15, 16, 20 (checkpoint) |
| `object.telescope` | **existing.** Blue telescope on a wooden tripod | 25, 33, 97 |
| `astronomy.orrery` | Brass solar system model: planets on arms around a Sun | 21, 23, 24, 26, 27, 28, 50, 30 (checkpoint) |
| `astronomy.prism` | Glass prism splitting white light into a rainbow | 31, 32, 89 |
| `astronomy.space-telescope` | Space telescope with solar panels | 34, 36, 40 (checkpoint) |
| `astronomy.radio-dish` | Big white radio dish | 35 |
| `astronomy.rocket` | White rocket lifting off on a soft plume | 37 |
| `astronomy.rover` | Six-wheeled Mars rover | 38 |
| `astronomy.aurora` | Green and violet aurora over a small snowy hill | 58 |
| `astronomy.nebula` | Glowing colorful gas cloud with tiny young stars | 59, 66, 67, 70 (checkpoint) |
| `astronomy.dying-star` | Swollen red giant star | 68, 98 |
| `astronomy.supernova` | Star exploding in a bright burst | 69, 71, 72 |
| `astronomy.black-hole` | Black sphere with a glowing orange disk around it | 73, 74, 75, 76, 87, 80 (checkpoint) |
| `astronomy.exoplanet` | Blue-green planet lit on one side by its star | 77, 78, 79 |
| `astronomy.galaxy` | Spiral galaxy seen at an angle | 81, 82, 85, 99, 90 (checkpoint) |
| `astronomy.galaxy-cluster` | Glowing cluster of many tiny galaxies forming one soft cloud | 83, 84, 86 |
| `astronomy.big-bang` | Bright burst of light and particles from a single point | 88, 91, 92, 93, 94, 95, 96, 100 (checkpoint) |
| `astronomy.mastery` | Gold-trimmed telescope under a gold star | 100 (Mastery Challenge) |

## Ancient Rome (30 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `rome.ruins` | Broken marble columns | 3, 28, 91, 93, 94, 98, 100 (checkpoint) |
| `rome.she-wolf` | Bronze she-wolf statue on a stone base | 2, 10 (checkpoint) |
| `rome.hills-and-river` | Green hills along a winding blue river | 4, 39 |
| `rome.pottery` | Black and terracotta painted vase | 5 |
| `rome.temple` | Roman temple with columns and a triangular roof | 7, 27, 45, 46, 87 |
| `rome.forum` | Classical civic building with steps and columns | 11, 13, 14, 16, 36, 37, 75, 20 (checkpoint) |
| `rome.fasces` | Bundle of rods with an axe (fasces) | 6, 9, 12, 82 |
| `rome.bronze-tablets` | Bronze tablets with engraved lines | 15, 76, 77 |
| `rome.farm` | Wooden plough in a green field | 17, 31 |
| `rome.city-fire` | Row of city buildings with flames rising | 18, 54 |
| `rome.road` | Paved Roman road with a milestone | 19, 71 |
| `rome.warship` | Roman warship with oars and a sail | 21, 22, 42, 43, 53, 30 (checkpoint) |
| `rome.war-elephant` | War elephant in snowy mountains | 23 |
| `rome.crossed-swords` | Two crossed Roman swords | 24, 25, 26, 40, 89, 92, 40 (checkpoint) |
| `rome.legion` | Red curved legion shield | 29, 32, 33, 38, 49 |
| `rome.broken-chains` | Broken iron chain | 34, 62 |
| `rome.laurel` | Green laurel wreath | 35, 41, 44, 51, 52, 55 |
| `rome.arch` | Roman triumphal arch | 1, 50, 58, 99 |
| `rome.scroll` | Rolled scroll on a wooden rod | 47, 68 |
| `rome.calendar` | Round stone calendar wheel | 48, 97 |
| `rome.colosseum` | The Colosseum, one side taller than the other | 56, 63, 64, 65, 60 (checkpoint) |
| `nature.volcano` | **existing.** Erupting volcano | 57 |
| `rome.wall` | Stone frontier wall with a fort tower | 59, 79 |
| `rome.house` | Roman house with an open courtyard | 8, 61, 69, 70 (checkpoint) |
| `rome.aqueduct` | Arched aqueduct carrying water | 66, 72, 80 (checkpoint) |
| `rome.amphora` | Clay amphora | 67 |
| `rome.dome` | Great domed building with a beam of light through the top | 73, 74, 86, 95, 96 |
| `rome.coins` | Small pile of silver coins | 78, 81 |
| `rome.chi-rho` | Round shield marked with the Chi-Rho symbol | 83, 84, 85, 88, 90 (checkpoint) |
| `rome.mastery` | Gold laurel wreath | 100 (Mastery Challenge) |

## World Geography, How Money Works, Art History and Everyday Technology

World Geography, How Money Works, Art History and Everyday Technology are planned to 100 levels (chapter and level titles in each skill's `syllabus.json`), so their images can be made now. Level numbers below are per tree. Mastery images are level 100.

**117 new images** cover all 400 levels. They also reuse 16 images from the lists above (the globe, the Sun, the Roman coins and so on), noted under each tree.

### Shared by several trees

| Image ID | Draw | Levels |
| --- | --- | --- |
| `geo.lighthouse` | Red and white lighthouse on rocks | Geography 24, 63; Money 53 |
| `geo.mountains` | Snow-capped mountain range | Geography 7, 17, 47, 55, 62, 66, 70 (checkpoint), 72, 84; Art 53 |
| `geo.oil-derrick` | Oil pump jack nodding over the ground | Geography 59, 97; Technology 13 |
| `geo.people` | Crowd of small faceless figures packed into one rounded group | Geography 91, 95, 98; Money 87 |
| `geo.pyramids` | Egyptian pyramids on sand | Geography 53, 60 (checkpoint); Art 12, 13, 20 (checkpoint) |
| `geo.rocks` | Layered red rock formation | Geography 18, 82; Art 87 |
| `geo.skyline` | Cluster of modern skyscrapers | Geography 57, 92; Technology 81, 82 |
| `geo.speech-bubbles` | Speech bubble, no text | Geography 94; Technology 92 |
| `geo.wave` | Large curling ocean wave | Geography 16, 22, 23, 30 (checkpoint); Art 51, 71, 72 |
| `money.container-ship` | Cargo ship stacked with colorful containers | Money 73, 76, 80 (checkpoint); Technology 34 |
| `money.price-tag` | Paper price tag on a string | Money 16, 74, 89; Art 89 |
| `nature.lightning` | Storm cloud with a lightning bolt | Geography 37; Technology 3 |
| `nature.thermometer` | Glass thermometer with rising red liquid | Geography 39; Technology 19, 75 |
| `nature.water-drop` | Single clear blue water drop | Geography 28; Technology 73, 74, 80 (checkpoint) |
| `nature.wheat` | Bundle of golden-brown wheat stalks | Geography 96; Art 54 |
| `object.magnifier` | Magnifying glass | Art 91, 96; Technology 66 |
| `object.padlock` | Closed padlock | Money 19; Technology 68, 69 |
| `technology.camera` | Classic camera with a big lens | Art 55, 86; Technology 46 |
| `technology.chip` | Microchip with silver pins | Money 9; Technology 53, 54, 60 (checkpoint), 97 |
| `technology.factory` | Factory with a sawtooth roof and chimneys | Money 84, 98; Technology 23, 86 |
| `technology.lightbulb` | Glowing light bulb | Money 82; Art 85; Technology 4, 5, 10 (checkpoint), 52, 99 |
| `technology.printing-press` | Wooden printing press | Art 39; Technology 41 |
| `technology.robot` | Friendly round robot arm | Money 88; Technology 88, 91 |
| `technology.satellite` | Satellite with solar panel wings | Geography 9; Technology 37, 98 |
| `technology.smartphone` | Smartphone with a glowing blank screen | Art 98; Technology 48, 49 |

### World Geography (16 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `geo.map` | Folded paper map with a winding route and a location pin | 2, 6, 8, 10 (checkpoint) |
| `geo.earth-layers` | Earth cut open to show crust, mantle and glowing core | 11, 12, 13, 14, 20 (checkpoint) |
| `geo.canyon` | Deep red canyon with a thin river at the bottom | 19, 54, 71, 75, 80 (checkpoint) |
| `nature.rain-cloud` | Rain cloud with falling drops | 21, 31, 34, 35, 40 (checkpoint) |
| `geo.river` | River winding through green land | 25, 26, 29, 49, 67, 73 |
| `geo.glacier` | Floating iceberg with blue ice below the water | 27, 46, 74, 87, 88 |
| `nature.hurricane` | Spiral storm seen from above | 36, 77 |
| `geo.rainforest` | Dense jungle leaves with a small bright frog | 42, 56, 78, 79 |
| `geo.desert` | Sand dunes with a single cactus | 43, 52, 58, 81 |
| `geo.savanna` | Flat-topped acacia tree on golden grass | 44, 51 |
| `geo.pine-forest` | Cluster of snowy pine trees | 45, 64 |
| `geo.coral` | Colorful coral with a small striped fish | 48, 83 |
| `geo.pagoda` | Tiered East Asian pagoda | 65, 68 |
| `geo.island` | Small tropical island with a palm tree | 85, 86, 90 (checkpoint) |
| `object.flag` | Plain colored flag on a pole, no symbols | 89, 93 |
| `geo.mastery` | Gold-trimmed compass | 100 |

Also uses, from earlier lists: `object.globe` (1, 3, 4, 5, 33, 38, 50 (milestone), 61); `nature.volcano` (15, 69, 76); `astronomy.sun` (32); `plant.tree` (41, 99).

And from the shared table: `geo.mountains`, `technology.satellite`, `geo.wave`, `geo.rocks`, `geo.lighthouse`, `nature.water-drop`, `nature.lightning`, `nature.thermometer`, `geo.pyramids`, `geo.skyline`, `geo.oil-derrick`, `geo.people`, `geo.speech-bubbles`, `nature.wheat`.

### How Money Works (23 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `money.handshake` | Two hands shaking | 2, 28, 34, 71 |
| `money.shells` | Small pile of cowrie shells | 3 |
| `money.banknote` | Short stack of green banknotes, no text | 5, 6, 57, 63, 75 |
| `money.credit-card` | Payment card with a chip | 8, 17, 25 |
| `money.wallet` | Brown leather wallet with a note peeking out | 11, 20 (checkpoint), 86, 99 |
| `money.receipt` | Long curled paper receipt with blank lines | 12, 18, 51, 83 |
| `money.piggy-bank` | Pink piggy bank with a coin going in | 13, 31 |
| `money.shopping-cart` | Shopping cart with groceries | 14, 43, 62 |
| `money.scale` | Balance scale with two pans | 15, 32, 44, 49, 52, 72, 94, 97 |
| `money.coin-plant` | Green sprout growing from a small stack of silver coins | 23, 24, 38 |
| `money.chart-up` | Bar chart with a rising arrow | 26, 33, 35, 40 (checkpoint), 65 |
| `money.house-key` | House-shaped key ring with a key | 27, 39 |
| `money.chart-down` | Bar chart with a falling red arrow | 29, 69 |
| `money.eggs-basket` | Egg carton holding eggs of different colors | 36, 37 |
| `money.market-stall` | Market stall with a striped awning and fruit | 41, 42, 45, 46, 50 (milestone) |
| `money.chess-king` | Chess king piece | 47, 96 |
| `money.carrot` | Carrot dangling from a stick | 48, 95 |
| `money.capitol` | Domed government building with columns | 54, 58, 59, 60 (checkpoint), 79, 93 |
| `money.balloon` | Inflating balloon with a silver coin inside | 61, 64, 68 |
| `money.rollercoaster` | Rollercoaster track with ups and downs and one small car | 66, 70 (checkpoint) |
| `money.briefcase` | Brown briefcase | 67, 81, 90 (checkpoint) |
| `arts.quill` | Feather quill in an ink pot | 91, 92 |
| `money.mastery` | Gold coin with a small green sprout growing from it | 100 |

Also uses, from earlier lists: `object.globe` (77, 78); `rome.coins` (1, 4, 10 (checkpoint)); `architecture.bank` (7, 21, 22, 30 (checkpoint), 55, 56); `technology.gears` (85).

And from the shared table: `geo.lighthouse`, `geo.people`, `technology.chip`, `money.price-tag`, `object.padlock`, `money.container-ship`, `technology.lightbulb`, `technology.factory`, `technology.robot`.

### Art History (26 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `arts.frame` | Empty ornate wooden picture frame | 2, 47, 48, 68, 94, 97 |
| `arts.brushes` | Jar of paintbrushes | 3, 38, 59, 65, 78, 95 |
| `arts.cave-hand` | Cave wall with a red handprint | 5, 6, 9, 10 (checkpoint), 76 |
| `arts.clay-figure` | Small carved clay figure, simple and rounded | 7, 19 |
| `arts.stonehenge` | Ring of standing stones with a lintel | 8 |
| `arts.step-pyramid` | Stepped stone pyramid with a small temple on top | 11, 77 |
| `arts.marble-block` | Marble block half carved into a hand, with a chisel | 15, 36, 43 |
| `arts.mosaic` | Mosaic tile panel in blues and golds | 18, 21 |
| `arts.pattern-tile` | Geometric star-pattern tile in blue and white | 22, 23 |
| `arts.cathedral` | Gothic cathedral with pointed towers | 25, 26, 30 (checkpoint) |
| `arts.stained-glass` | Round stained glass window glowing with color | 27, 64 |
| `arts.easel` | Wooden easel with a canvas | 28, 35, 37, 40 (checkpoint), 46, 58, 79 |
| `arts.ink-brush` | Chinese ink brush | 29, 73 |
| `arts.perspective` | Checkered floor running to a vanishing point | 32, 92 |
| `arts.candle` | Candle lighting a dark space | 41, 42, 44, 52 |
| `arts.still-life` | Fruit bowl with a lemon and grapes | 45, 61, 93 |
| `arts.lily-pond` | Water lilies on a pond | 56, 57, 60 (checkpoint) |
| `arts.sunflowers` | Vase of sunflowers | 62 |
| `arts.cubes` | Faceted shapes of a guitar broken into angles | 66, 70 (checkpoint) |
| `arts.shapes` | Primary-color circle, square and triangle | 67, 84 |
| `arts.melting-clock` | Soft clock melting over a branch, no numbers | 69 |
| `arts.mask` | Carved wooden mask, not a real person | 74, 75 |
| `arts.paint-splatter` | Canvas covered in paint drips and splatters | 81, 90 (checkpoint) |
| `arts.soup-can` | Bright tin can with a blank colored label | 82, 83 |
| `arts.spray-can` | Spray paint can with a colorful burst | 88 |
| `arts.mastery` | Ornate gold picture frame around a small painted landscape | 100 |

Also uses, from earlier lists: `object.globe` (80 (checkpoint)); `rome.coins` (34); `object.palette` (1, 4, 50 (milestone), 63, 99); `rome.pottery` (14); `rome.temple` (16, 49); `rome.arch` (17); `object.book` (24); `rome.dome` (31, 33).

And from the shared table: `geo.mountains`, `geo.wave`, `geo.rocks`, `geo.pyramids`, `nature.wheat`, `money.price-tag`, `technology.lightbulb`, `technology.printing-press`, `technology.camera`, `object.magnifier`, `technology.smartphone`.

### Everyday Technology (27 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `technology.battery` | Battery with a green charge level | 6, 18 |
| `technology.magnet` | Red horseshoe magnet | 7, 8 |
| `technology.power-pylon` | Steel power line tower | 9, 11, 20 (checkpoint) |
| `technology.power-plant` | Power plant with cooling towers and steam | 12 |
| `technology.atom` | Atom with orbiting electrons | 14, 96 |
| `technology.dam` | Concrete dam with water rushing out | 15 |
| `technology.wind-turbine` | White wind turbine | 16 |
| `technology.solar-panel` | Tilted blue solar panel | 17 |
| `technology.train` | Steam locomotive with a puff of steam | 22, 33 |
| `technology.piston` | Engine piston and crankshaft | 24, 30 (checkpoint) |
| `technology.car` | Small rounded car | 25, 26, 38, 39, 87 |
| `technology.crane` | Yellow construction crane | 28, 85, 90 (checkpoint) |
| `technology.plane` | Passenger jet | 31, 32, 40 (checkpoint) |
| `technology.telephone` | Old rotary telephone | 42, 43 |
| `technology.radio` | Retro radio with an antenna and signal waves | 44, 64 |
| `technology.tv` | Old boxy television | 45, 47 |
| `technology.laptop` | Open laptop | 51, 55, 56, 58, 59 |
| `technology.network` | Globe wrapped in glowing connected dots | 61, 62, 63, 65, 67, 70 (checkpoint) |
| `technology.fridge` | Rounded retro fridge (covers kitchen appliances) | 71, 72 |
| `technology.x-ray` | X-ray film of a hand | 77 |
| `technology.plastic-bottle` | Clear plastic bottle | 79 |
| `technology.bridge` | Suspension bridge | 83 |
| `technology.3d-printer` | 3D printer building a small object | 89 |
| `technology.vr-headset` | VR headset | 93 |
| `technology.drone` | Four-rotor drone | 94 |
| `technology.dna` | DNA double helix | 95 |
| `technology.mastery` | Gold gear with a soft glow | 100 |

Also uses, from earlier lists: `astronomy.sun` (2); `technology.gears` (1, 21, 27, 29, 50 (milestone), 57); `rome.dome` (84); `astronomy.radio-dish` (35); `astronomy.rocket` (36); `science.microscope` (76, 78).

And from the shared table: `technology.satellite`, `nature.water-drop`, `nature.lightning`, `nature.thermometer`, `geo.skyline`, `geo.oil-derrick`, `geo.speech-bubbles`, `technology.chip`, `object.padlock`, `money.container-ship`, `technology.lightbulb`, `technology.factory`, `technology.robot`, `technology.printing-press`, `technology.camera`, `object.magnifier`, `technology.smartphone`.

## The Human Body, The Middle Ages, Music and The Animal Kingdom

The Human Body, The Middle Ages, Music and The Animal Kingdom are planned to 100 levels (chapter and level titles in each skill's `syllabus.json`), so their images can be made now. Level numbers below are per tree. Mastery images are level 100.

**102 new images** cover all 400 levels. They also reuse 48 images from the lists above (the Moon, the Pantheon dome, the DNA helix, the cathedral and so on), noted under each tree.

### Shared by several of these trees

| Image ID | Draw | Levels |
| --- | --- | --- |
| `body.bone` | Single white bone | Body 11, 12, 13, 17, 19; Animals 3 |
| `body.ear` | Stylized ear with sound waves | Body 65, 66; Music 42 |
| `body.germ` | Round microbe with little spikes, cute not scary | Body 72, 79, 80 (checkpoint); Middle Ages 82, 83, 90 (checkpoint); Animals 59 |
| `body.heart` | Rounded anatomical heart in soft red | Body 21, 22, 23, 29, 30 (checkpoint), 59, 94, 98; Music 93 |
| `body.neuron` | Glowing nerve cell with branching arms | Body 51, 52, 53, 54, 55, 60 (checkpoint); Music 91 |
| `medieval.camel` | Camel with trade bundles | Middle Ages 68, 95; Animals 65 |
| `medieval.caravel` | Wooden sailing ship with square sails | Middle Ages 93, 94; Animals 81 |
| `medieval.horse` | Horse with a saddle | Middle Ages 67; Animals 91 |
| `music.lute` | Lute (also works for the oud) | Middle Ages 59; Music 26, 28, 30 (checkpoint), 55 |
| `object.hourglass` | Wooden hourglass with sand running | Body 85, 86; Middle Ages 98; Animals 94 |

### The Human Body (17 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `body.figure` | Wooden artist's mannequin figure, no face | 1, 50 (milestone), 61, 84, 88 |
| `body.cell` | Round cell with a visible nucleus | 2, 3, 4, 10 (checkpoint), 81 |
| `body.muscle` | Flexed arm showing the bicep, no face | 15, 16, 20 (checkpoint) |
| `body.dumbbell` | Dumbbell | 18, 92 |
| `body.blood-cells` | Red disc-shaped blood cell | 24, 25, 73 |
| `body.stethoscope` | Stethoscope | 26, 39, 97 |
| `body.bandage` | Adhesive bandage | 28, 68, 71 |
| `body.lungs` | Pair of pink lungs | 31, 32, 33, 35, 37, 38, 40 (checkpoint) |
| `body.stomach` | Soft pink stomach and coiled intestines | 41, 43, 44, 45 |
| `body.tooth` | Shiny white tooth | 42 |
| `body.food-plate` | Plate with vegetables, grains and fish | 47, 48, 49, 67, 91 |
| `body.eye` | Stylized eyeball with a blue iris | 62, 69, 70 (checkpoint) |
| `body.glasses` | Pair of glasses | 64 |
| `body.syringe` | Syringe | 75, 76 |
| `body.soap` | Bar of soap with bubbles | 78 |
| `body.pill` | Two-color capsule pill | 96 |
| `body.mastery` | Gold heart with a soft glow | 100 |

Also uses, from earlier lists: `technology.dna` (5, 6, 82, 83, 90 (checkpoint)); `nature.water-drop` (7, 46); `science.microscope` (8, 9, 77); `technology.x-ray` (14); `arts.quill` (27); `geo.speech-bubbles` (34); `geo.mountains` (36); `technology.lightbulb` (56); `astronomy.moon` (57, 58, 93); `object.palette` (63); `nature.thermometer` (74); `arts.cave-hand` (87); `astronomy.sun` (89, 95); `object.magnifier` (99).

And from the shared table: `body.bone`, `body.heart`, `body.neuron`, `body.ear`, `body.germ`, `object.hourglass`.

### The Middle Ages (16 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `medieval.castle` | Stone castle with towers and a flag | 1, 23, 24, 30 (checkpoint), 43, 50 (milestone), 99 |
| `medieval.crown` | Jeweled silver crown | 6, 9, 11, 12, 21, 32, 45, 72, 79 |
| `medieval.viking-ship` | Viking longship with a striped sail | 13, 14, 20 (checkpoint) |
| `medieval.shield` | Shield with a simple heraldic pattern | 16, 17, 28, 29, 41, 46 |
| `medieval.trebuchet` | Wooden trebuchet | 25 |
| `medieval.helmet` | Knight's steel helmet with a visor | 26, 27 |
| `medieval.scallop` | Scallop shell (pilgrim badge) | 34 |
| `medieval.town` | Row of half-timbered houses | 51, 55, 60 (checkpoint), 84 |
| `medieval.anvil` | Blacksmith anvil and hammer | 53 |
| `medieval.windmill` | Wooden windmill | 56 |
| `medieval.herbs` | Mortar and pestle with herbs | 57, 64 |
| `medieval.astrolabe` | Brass astrolabe | 62, 63, 70 (checkpoint) |
| `medieval.longbow` | Longbow and arrows | 75, 76, 78 |
| `medieval.cannon` | Old bronze cannon | 86, 87 |
| `medieval.rose` | Rose with red and white petals | 88 |
| `medieval.mastery` | Gold crown with a soft glow | 100 |

Also uses, from earlier lists: `arts.quill` (36, 58); `object.book` (2, 7, 19, 35, 37, 61, 65); `rome.ruins` (3, 10 (checkpoint)); `rome.dome` (4, 5, 92); `arts.pattern-tile` (8, 48, 89); `geo.map` (15, 69); `rome.crossed-swords` (18, 42, 44); `rome.farm` (22); `arts.cathedral` (31, 33, 40 (checkpoint)); `arts.mosaic` (38); `arts.candle` (39); `rome.city-fire` (47); `money.market-stall` (49, 52); `rome.amphora` (54); `geo.pagoda` (66); `rome.scroll` (71, 80 (checkpoint)); `money.scale` (73, 74); `object.flag` (77); `nature.wheat` (81); `rome.broken-chains` (85); `technology.printing-press` (91); `rome.wall` (96); `arts.step-pyramid` (97).

And from the shared table: `body.germ`, `object.hourglass`, `music.lute`, `medieval.horse`, `medieval.camel`, `medieval.caravel`.

### Music (26 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `music.notes` | Pair of musical notes | 1, 5, 9, 10 (checkpoint), 25, 34, 61 |
| `music.sound-wave` | Speaker cone sending out ripple waves | 2 |
| `music.tuning-fork` | Tuning fork with vibration lines | 3, 98 |
| `music.metronome` | Wooden metronome | 4, 97 |
| `music.piano` | Grand piano | 6, 7, 8, 16, 38, 41, 44, 63, 67 |
| `music.violin` | Violin and bow | 11, 12, 20 (checkpoint), 33, 39, 45 |
| `music.flute` | Silver flute | 13, 21, 56 |
| `music.trumpet` | Brass trumpet | 14, 64, 65, 70 (checkpoint) |
| `music.drum` | Hand drum | 15, 54, 58 |
| `music.guitar` | Acoustic guitar | 17, 57, 59, 62 |
| `music.organ` | Pipe organ pipes | 18, 31, 32 |
| `music.microphone` | Classic stage microphone | 19, 76, 83 |
| `music.harp` | Harp | 22 |
| `music.gong` | Bronze gong on a stand | 23, 53 |
| `music.stage` | Stage with red curtains and a spotlight | 35, 43, 46, 47, 49, 77 |
| `music.baton` | Conductor's baton over a music stand | 36, 37, 40 (checkpoint), 50 (milestone) |
| `music.sitar` | Sitar | 52 |
| `music.saxophone` | Saxophone | 66, 68, 69 |
| `music.vinyl` | Vinyl record | 71, 75, 80 (checkpoint) |
| `music.electric-guitar` | Red electric guitar | 73, 74, 78 |
| `music.turntable` | DJ turntable | 81, 82, 90 (checkpoint) |
| `music.synth` | Synthesizer keyboard with knobs | 84, 85 |
| `music.speaker` | Big speaker cabinet | 86 |
| `music.headphones` | Headphones | 88, 92, 99 |
| `music.game-controller` | Game controller | 95 |
| `music.mastery` | Gold trumpet with a soft glow | 100 |

Also uses, from earlier lists: `arts.cathedral` (24, 27); `money.scale` (96); `object.flag` (48); `technology.printing-press` (29); `object.globe` (51, 60 (checkpoint), 87); `technology.radio` (72); `technology.tv` (79); `technology.smartphone` (89); `technology.camera` (94).

And from the shared table: `body.heart`, `body.neuron`, `body.ear`, `music.lute`.

### The Animal Kingdom (33 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `animals.paw` | Paw print | 1, 2, 10 (checkpoint), 11, 50 (milestone), 71, 96 |
| `animals.lion` | Lion | 6, 12 |
| `animals.whale` | Blue whale | 9, 14, 88 |
| `animals.elephant` | Elephant | 13, 20 (checkpoint) |
| `animals.bat` | Bat with open wings | 15 |
| `animals.kangaroo` | Kangaroo with a joey in its pouch | 16, 76 |
| `animals.egg` | Eggs in a nest | 17, 23 |
| `animals.chimp` | Chimpanzee | 18, 77 |
| `animals.wolf` | Grey wolf | 19, 74, 79, 80 (checkpoint) |
| `animals.eagle` | Eagle in flight | 21, 22, 24, 30 (checkpoint), 95 |
| `animals.owl` | Owl | 25, 68 |
| `animals.penguin` | Penguin | 26, 66 |
| `animals.hummingbird` | Hummingbird at a flower | 27 |
| `animals.parrot` | Colorful parrot | 28, 75 |
| `animals.turtle` | Sea turtle | 31, 34, 40 (checkpoint), 67 |
| `animals.snake` | Coiled green snake | 32, 33 |
| `animals.crocodile` | Crocodile | 35 |
| `animals.chameleon` | Chameleon on a branch | 36, 61, 62, 70 (checkpoint) |
| `animals.dinosaur` | Dinosaur skeleton fossil | 39, 83, 84, 85, 90 (checkpoint) |
| `animals.shark` | Shark | 42, 69 |
| `animals.anglerfish` | Deep-sea anglerfish with a glowing lure | 43 |
| `animals.octopus` | Octopus | 44, 78 |
| `animals.jellyfish` | Glowing jellyfish | 45 |
| `animals.crab` | Red crab | 48, 58 |
| `animals.bee` | Honeybee | 51, 53, 73 |
| `animals.ant` | Ant | 52 |
| `animals.butterfly` | Butterfly | 54, 60 (checkpoint), 63, 89 |
| `animals.spider` | Spider on a web | 55 |
| `animals.snail` | Snail | 56 |
| `animals.bear` | Brown bear | 64 |
| `animals.finch` | Small finch | 82 |
| `animals.panda` | Giant panda eating bamboo | 93, 97 |
| `animals.mastery` | Gold paw print with a soft glow | 100 |

Also uses, from earlier lists: `geo.speech-bubbles` (72); `technology.lightbulb` (99); `nature.thermometer` (5); `object.book` (4); `rome.farm` (57, 92); `object.globe` (29); `geo.savanna` (7); `geo.rainforest` (8, 37, 38); `geo.coral` (41, 46); `geo.river` (47, 87); `geo.wave` (49); `astronomy.asteroid` (86); `astronomy.rocket` (98).

And from the shared table: `body.bone`, `body.germ`, `object.hourglass`, `medieval.horse`, `medieval.camel`, `medieval.caravel`.

## Ancient Egypt, Ancient Greece, Chemistry, Architecture, How Government Works and The Oceans

Ancient Egypt, Ancient Greece, Chemistry, Architecture, How Government Works and The Oceans are planned to 100 levels (chapter and level titles in each skill's `syllabus.json`), so their images can be made now. Level numbers below are per tree. Mastery images are level 100.

**63 new images** cover all 600 levels. These trees were written to lean on what exists: they reuse 130 images from the lists above and 20 from your first-round list (the curia, the rostra, the chariot and so on), noted under each tree.

### Shared by several of these trees

| Image ID | Draw | Levels |
| --- | --- | --- |
| `chem.crystal` | Cluster of white salt crystals | Chemistry 43, 46; Oceans 5 |
| `chem.molecule` | Ball-and-stick molecule model | Chemistry 41, 44, 48, 49, 50 (milestone), 73; Oceans 37 |
| `egypt.house` | Flat-roofed mud-brick house | Egypt 51, 59, 60 (checkpoint); Architecture 44 |
| `egypt.temple` | Egyptian temple gateway with tall columns | Egypt 34, 63, 70 (checkpoint), 72, 73, 76, 82; Architecture 14 |

### Ancient Egypt (13 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `egypt.boat` | Reed boat with a white sail | 5, 68 |
| `egypt.headdress` | Pharaoh's striped headdress on a stand, no face | 6, 8, 11, 20 (checkpoint), 71, 80 (checkpoint) |
| `egypt.crook-flail` | Pharaoh's crook and flail crossed | 12 |
| `egypt.scribe-palette` | Scribe's palette with reed pens | 13, 43, 54 |
| `egypt.obelisk` | Stone obelisk | 18, 65, 94 |
| `egypt.sledge` | Stone block on a wooden sledge | 26 |
| `egypt.sphinx` | The Great Sphinx | 27 |
| `egypt.ankh` | Ankh symbol in blue faience | 31, 33, 40 (checkpoint) |
| `egypt.canopic-jar` | Canopic jar with a jackal-head lid | 35, 79, 95 |
| `egypt.cat` | Sitting Egyptian cat statue | 38, 56 |
| `egypt.scarab` | Blue scarab beetle charm | 39 |
| `egypt.papyrus` | Papyrus reeds | 42 |
| `egypt.mastery` | Gold scarab with a soft glow | 100 |

From your first-round list (probably already approved; make them only if not):

| Image ID | Draw | Levels |
| --- | --- | --- |
| `rome.chariot` | Racing chariot with one horse | 15, 61, 62, 74 |
| `rome.cobra-diadem` | Egyptian cobra diadem | 17, 67, 77 |
| `rome.jewelry` | Ornate jeweled necklace | 19, 49, 53 |
| `rome.carved-stone` | Stone slab with carved, unreadable signs | 41, 44, 69, 78, 91, 92 |

Also uses, from earlier lists: `geo.pyramids` (1, 23, 24, 30 (checkpoint), 50 (milestone), 75, 83, 99); `geo.river` (2, 10 (checkpoint)); `geo.desert` (3); `nature.wheat` (4, 14, 88); `rome.pottery` (7, 58); `object.hourglass` (9); `money.scale` (16, 36, 55); `arts.step-pyramid` (21, 22); `geo.people` (25); `rome.amphora` (28, 52); `geo.canyon` (29, 64); `astronomy.sun` (32, 66); `rome.scroll` (37); `rome.calendar` (45); `medieval.herbs` (46); `astronomy.star` (47); `arts.brushes` (48); `music.harp` (57); `rome.warship` (81); `rome.crossed-swords` (84); `rome.laurel` (85); `geo.lighthouse` (86); `rome.coins` (87); `rome.chi-rho` (89); `rome.ruins` (90 (checkpoint)); `object.magnifier` (93, 98); `technology.satellite` (96); `arts.frame` (97).

And from the shared table: `egypt.temple`, `egypt.house`.

### Ancient Greece (9 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `greece.labyrinth` | Stone maze seen from above | 3, 48 |
| `greece.helmet` | Bronze Greek helmet with a crest, no face | 4, 31, 36, 40 (checkpoint), 81 |
| `greece.trojan-horse` | Wooden horse on wheels | 5, 10 (checkpoint) |
| `greece.shield` | Round bronze hoplite shield | 16, 32, 35 |
| `greece.torch` | Flaming torch | 18, 93 |
| `greece.geometry` | Drawing compass over a triangle | 53, 61, 70 (checkpoint) |
| `greece.cup` | Plain clay drinking cup | 55 |
| `greece.mask` | Theater mask, not a real person | 71, 72, 73, 80 (checkpoint) |
| `greece.mastery` | Gold olive wreath with a soft glow | 100 |

From your first-round list (probably already approved; make them only if not):

| Image ID | Draw | Levels |
| --- | --- | --- |
| `rome.carved-stone` | Stone slab with carved, unreadable signs | 8 |
| `rome.altar-flame` | Small stone altar with a flame | 19 |
| `rome.raised-hand` | Raised open bronze hand | 23, 24, 30 (checkpoint), 92 |
| `rome.rostra` | Speaker's stone platform | 27 |
| `rome.catacomb-lamp` | Clay oil lamp with a flame | 45, 59 |
| `rome.olive-branch` | Olive branch | 58 |
| `rome.baths` | Steaming bath pool framed by columns | 62 |
| `astronomy.eratosthenes` | Stone well with a sunbeam shining straight down | 63 |
| `astronomy.geocentric` | Brass armillary sphere | 64 |

Also uses, from earlier lists: `rome.pottery` (25, 77); `money.scale` (26); `geo.people` (14, 29); `rome.scroll` (6, 22, 79); `medieval.herbs` (66); `music.harp` (74); `rome.warship` (9, 37, 49); `rome.crossed-swords` (39); `rome.laurel` (33, 86); `geo.lighthouse` (88); `rome.coins` (17, 38); `rome.ruins` (7); `rome.temple` (1, 11, 20 (checkpoint), 28, 50 (milestone), 78, 99); `geo.mountains` (2, 41); `money.market-stall` (12); `medieval.crown` (13, 34, 87); `rome.broken-chains` (15); `animals.owl` (21, 44); `nature.lightning` (42); `geo.wave` (43, 52); `animals.lion` (46); `animals.snake` (47); `object.book` (51, 57, 60 (checkpoint), 82, 97); `geo.speech-bubbles` (54, 91); `arts.candle` (56); `technology.gears` (65, 69); `technology.atom` (67, 96); `geo.map` (68, 84); `arts.quill` (75); `arts.marble-block` (76, 98); `medieval.horse` (83, 90 (checkpoint)); `animals.elephant` (85); `rome.arch` (89); `architecture.bank` (94); `technology.camera` (95).

And from the shared table: .

### Chemistry (10 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `chem.flask` | Glass flask with bubbling colored liquid | 1, 6, 7, 51, 56, 64, 84, 86, 88 |
| `chem.ice-cube` | Ice cube melting into a puddle | 3, 4, 8, 10 (checkpoint) |
| `chem.flame` | Bunsen burner with a blue flame | 9, 26, 53, 60 (checkpoint) |
| `chem.element-grid` | Grid of colored tiles, no letters | 21, 22, 23, 30 (checkpoint), 40 (checkpoint) |
| `chem.diamond` | Cut diamond | 33, 34 |
| `chem.rusty-nail` | Rusty nail | 54 |
| `chem.fireworks` | Firework burst | 58, 59 |
| `chem.lemon` | Sliced lemon | 61, 63, 70 (checkpoint) |
| `chem.test-tubes` | Rack of test tubes with colored liquids | 65, 92, 95 |
| `chem.mastery` | Gold-trimmed glass flask with a soft glow | 100 |

Also uses, from earlier lists: `object.hourglass` (17, 55); `money.scale` (52, 93); `rome.amphora` (82); `astronomy.sun` (31); `medieval.herbs` (79, 91); `rome.coins` (36); `object.magnifier` (13, 99); `nature.lightning` (5); `technology.atom` (2, 11, 12, 14, 15, 16, 19, 20 (checkpoint), 28, 94); `science.microscope` (18); `medieval.anvil` (24, 35, 45); `money.balloon` (25); `nature.water-drop` (27, 42); `astronomy.supernova` (29); `body.lungs` (32, 76); `music.gong` (37); `arts.soup-can` (38); `technology.chip` (39); `technology.plastic-bottle` (47, 87, 97); `nature.thermometer` (57); `body.soap` (62, 83, 90 (checkpoint)); `nature.rain-cloud` (66); `geo.coral` (67); `technology.battery` (68); `body.stomach` (69, 77); `technology.dna` (71, 80 (checkpoint), 96); `body.food-plate` (72, 74, 81); `plant.tree` (75, 98); `body.pill` (78); `object.palette` (85); `geo.oil-derrick` (89).

And from the shared table: `chem.molecule`, `chem.crystal`.

### Architecture (11 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `arch.blueprint` | Rolled blueprint with a pencil | 1, 9, 50 (milestone), 98 |
| `arch.brick` | Red brick | 2, 6, 58 |
| `arch.taj` | White marble domed mausoleum with minarets | 36 |
| `arch.igloo` | Igloo | 42 |
| `arch.yurt` | Round felt yurt | 43 |
| `arch.stilt-house` | Wooden house on stilts over water | 45 |
| `arch.modern-house` | Modern house with flat roofs and big windows | 49, 72, 73, 80 (checkpoint) |
| `arch.iron-tower` | Iron lattice tower | 53 |
| `arch.hard-hat` | Yellow hard hat | 68 |
| `arch.opera-house` | White building with sail-shaped roofs | 76, 77 |
| `arch.mastery` | Gold-trimmed rolled blueprint | 100 |

From your first-round list (probably already approved; make them only if not):

| Image ID | Draw | Levels |
| --- | --- | --- |
| `rome.concrete` | Bucket of grey concrete with a trowel | 7, 78 |
| `rome.hagia-sophia` | Great domed church with small domes around it | 21 |
| `rome.insula` | Tall Roman apartment block with shops below | 48, 88 |
| `rome.grid-city` | Small city laid out on a street grid | 82 |

Also uses, from earlier lists: `geo.pyramids` (13, 20 (checkpoint)); `arts.step-pyramid` (12, 26, 28, 81); `geo.lighthouse` (15, 57); `rome.ruins` (97); `object.magnifier` (99); `arts.frame` (79); `rome.temple` (16); `geo.mountains` (38); `money.market-stall` (85); `medieval.crown` (33, 37); `rome.arch` (4, 10 (checkpoint)); `plant.tree` (84, 92, 93); `arts.stonehenge` (3, 11); `rome.dome` (5, 19, 29); `geo.skyline` (8, 61, 62, 63, 65, 66, 69, 70 (checkpoint), 75, 90 (checkpoint)); `rome.colosseum` (17); `rome.aqueduct` (18); `arts.pattern-tile` (22, 35); `arts.cathedral` (23, 24, 30 (checkpoint)); `arts.stained-glass` (25); `geo.pagoda` (27, 34); `medieval.castle` (31, 39, 40 (checkpoint)); `rome.wall` (32, 83); `rome.house` (41, 46); `medieval.town` (47); `technology.bridge` (51, 52, 60 (checkpoint)); `technology.crane` (54, 67); `technology.dam` (55); `money.container-ship` (56); `geo.earth-layers` (59); `nature.hurricane` (64); `arts.mosaic` (71); `arts.shapes` (74); `technology.train` (86); `technology.car` (87); `money.capitol` (89); `technology.solar-panel` (91); `technology.3d-printer` (94); `geo.island` (95); `astronomy.moon` (96).

And from the shared table: `egypt.temple`, `egypt.house`.

### How Government Works (7 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `gov.gavel` | Judge's wooden gavel | 4, 51, 52, 55, 57, 60 (checkpoint), 87 |
| `gov.newspaper` | Folded newspaper with blank columns | 28, 95 |
| `gov.megaphone` | Megaphone | 29, 65, 96 |
| `gov.dove` | White dove with an olive sprig | 34, 35, 86 |
| `gov.ballot-box` | Ballot box with a paper going in | 37, 38, 61, 62, 63, 68, 70 (checkpoint) |
| `gov.badge` | Plain silver badge, no text | 58 |
| `gov.mastery` | Gold gavel with a soft glow | 100 |

From your first-round list (probably already approved; make them only if not):

| Image ID | Draw | Levels |
| --- | --- | --- |
| `rome.altar-flame` | Small stone altar with a flame | 15 |
| `rome.raised-hand` | Raised open bronze hand | 16, 30 (checkpoint), 45, 67 |
| `rome.rostra` | Speaker's stone platform | 42 |
| `rome.curule-chair` | Folding ivory seat of office | 14, 43 |
| `rome.curia` | Plain brick senate house with a bronze door | 17, 23 |
| `rome.wax-seal` | Red wax seal on a folded letter | 22, 83 |

Also uses, from earlier lists: `money.scale` (25, 26, 50 (milestone), 53, 54, 92); `geo.people` (27, 88); `rome.scroll` (2, 31, 32, 40 (checkpoint), 41); `rome.ruins` (19); `object.magnifier` (69, 98); `rome.temple` (21); `medieval.crown` (11, 12, 20 (checkpoint)); `rome.broken-chains` (39, 48); `object.book` (46, 56, 73); `geo.speech-bubbles` (93, 99); `geo.map` (18, 64); `arts.quill` (33); `nature.water-drop` (5); `nature.thermometer` (89); `medieval.town` (47, 97); `technology.bridge` (76); `money.capitol` (1, 8, 10 (checkpoint), 24, 71); `rome.fasces` (3, 13); `money.receipt` (6, 72, 80 (checkpoint)); `money.handshake` (7, 44, 82, 94); `object.flag` (9, 81, 85, 91); `object.padlock` (36, 59); `object.globe` (49, 84, 90 (checkpoint)); `money.chart-up` (66); `body.stethoscope` (74); `money.piggy-bank` (75); `money.banknote` (77); `money.chart-down` (78); `rome.legion` (79).

And from the shared table: .

### The Oceans (9 images)

| Image ID | Draw | Levels |
| --- | --- | --- |
| `ocean.submersible` | Round deep-sea submersible with lights | 9, 14, 51, 87, 88, 90 (checkpoint) |
| `ocean.kelp` | Tall kelp fronds | 42 |
| `ocean.dolphin` | Leaping dolphin | 46 |
| `ocean.seal` | Seal on a rock | 47, 77 |
| `ocean.anchor` | Ship anchor | 66, 78 |
| `ocean.oyster` | Open oyster with a pearl | 68 |
| `ocean.diving-helmet` | Brass diving helmet | 85, 86 |
| `ocean.fishing-net` | Fishing net with floats | 91, 92 |
| `ocean.mastery` | Gold anchor with a soft glow | 100 |

From your first-round list (probably already approved; make them only if not):

| Image ID | Draw | Levels |
| --- | --- | --- |
| `rome.pirate-ship` | Small pirate ship | 97 |

Also uses, from earlier lists: `geo.river` (63); `astronomy.sun` (8); `geo.lighthouse` (26, 69); `object.magnifier` (59); `technology.satellite` (89); `geo.wave` (1, 19, 21, 22, 23, 30 (checkpoint)); `geo.map` (3, 11, 12, 84); `science.microscope` (41, 75); `nature.water-drop` (7, 99); `technology.plastic-bottle` (39, 95); `nature.thermometer` (6, 34, 36, 79); `geo.coral` (43, 44, 50 (milestone), 96); `technology.dam` (28); `money.container-ship` (93); `geo.earth-layers` (13, 18, 20 (checkpoint)); `nature.hurricane` (29, 35); `geo.island` (65, 70 (checkpoint)); `astronomy.moon` (24, 25); `object.globe` (2, 10 (checkpoint), 31, 32, 33, 40 (checkpoint)); `astronomy.comet` (4); `nature.volcano` (15, 16, 57, 64); `geo.rocks` (17, 62); `animals.crab` (27); `geo.glacier` (38, 71, 72, 73, 80 (checkpoint)); `animals.turtle` (45); `animals.eagle` (48); `animals.shark` (49); `animals.jellyfish` (52); `animals.anglerfish` (53, 55, 60 (checkpoint)); `animals.octopus` (54, 58, 98); `animals.whale` (56, 76); `medieval.scallop` (61, 67); `animals.penguin` (74); `medieval.caravel` (81, 83); `astronomy.star-chart` (82); `technology.wind-turbine` (94).

And from the shared table: `chem.molecule`, `chem.crystal`.

## Putting images in the app

Every level already knows its image: the `art` field on each level and syllabus entry is the image ID from this list (all 1,600 levels are filled in).

1. Save the finished image as `app/assets/images/art/<image ID>.png` (or `.webp`), e.g. `astronomy.mars.png`. Transparent background, 1024 × 1024.
2. Run `npm run art:sync` from `brainscroll/`. It regenerates the app's image registry; `npm run check` fails if you forget.
3. That's it: every level using that ID shows it at the top of the lesson and on Home's "Continue learning" card. Levels whose image isn't made yet simply show none.

Dr. Scroll's images are wired separately; see [`mascot.md`](mascot.md), "Spots".

## Adding more later

New levels should reuse an image from this list when the concept is close enough, and only add one when the subject is genuinely new (a new planet, a new landmark). 
