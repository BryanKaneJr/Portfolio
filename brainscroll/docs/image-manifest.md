# Image manifest

Every illustration BrainScroll needs today, for the icon generator. That's **214 images**: 6 subjects, 2 skills, 200 levels (one per level in both trees) and 6 app-state images. The 20 chapters reuse a level icon, so they need no new art.

## House style (every image)

- **Look:** a glossy, soft 3D "clay" icon of **one object**, centered, filling about 70% of the frame, with a gentle drop shadow. The light is soft and comes from the top left.
- **Background:** plain Midnight Navy `#111827` (the app background), with no scene or horizon unless the entry asks for one.
- **Colors:** warm and saturated (orange, blue, green, terracotta, cream). Use Electric Violet `#7C5CFF` only as a small accent. **Gold `#FFC857` appears only on the mastery images** (Level 100 and `ui.mastery-star`).
- **Never:**
  - text, letters or numbers (carved marks may suggest writing, but nothing readable);
  - real people's faces or likenesses: emperors and scientists are shown through their objects;
  - brains, graduation caps, parchment, fantasy shields, gore or cruelty.
- **Output:** a 1024 × 1024 PNG with the ID as the file name (`astronomy.sun.png`).
- **Checkpoints** (every 10th level) get a "summary badge" feel: a small round plinth under the object. **Milestones and Mastery** (Levels 50 and 100) get a slightly grander composition. Only Level 100 uses gold.

Your existing batch fits this already: the telescope, Roman helmet, bank, microscope and globe are used below (marked **existing**).

## Subjects (6)

| Subject | Image ID | Draw |
| --- | --- | --- |
| History | `artifact.roman-helmet` | **existing.** Gold Roman helmet with a red crest |
| Science | `science.microscope` | **existing.** Blue microscope |
| Geography | `object.globe` | **existing.** Globe on a gold stand |
| Money & Economics | `architecture.bank` | **existing.** Classical bank building with a coin in the pediment |
| Arts & Culture | `object.palette` | Painter's palette with paint blobs and a brush |
| How the World Works | `technology.gears` | Two interlocking gears, one orange and one blue |

## Skills (2)

| Skill | Image ID | Draw |
| --- | --- | --- |
| Science · Astronomy | `object.telescope` | **existing.** Blue telescope on a wooden tripod |
| History · Ancient Rome | `rome.colosseum` | The Colosseum, cream stone, one side taller than the other (also Rome Level 56) |

## Chapters (reuse, no new art)

| Astronomy chapter | Uses | Ancient Rome chapter | Uses |
| --- | --- | --- | --- |
| 1 Your Place in the Universe | `astronomy.cosmic-address` | 1 Founding and the Kings | `rome.she-wolf` |
| 2 The Sky Above You | `astronomy.constellation` | 2 The Early Republic | `rome.spqr-standard` |
| 3 How We Figured It Out | `astronomy.galileo-telescope` | 3 Rome Against Carthage | `rome.war-elephant` |
| 4 Light, Telescopes and Spacecraft | `astronomy.webb` | 4 The Republic in Crisis | `rome.rubicon-die` |
| 5 The Planets Up Close | `astronomy.jupiter` | 5 Augustus and the New Empire | `rome.laurel-wreath` |
| 6 The Sun and the Solar System’s Edge | `astronomy.comet` | 6 Emperors Good and Bad | `rome.colosseum` |
| 7 The Lives of Stars | `astronomy.nebula` | 7 Life in the Roman World | `rome.bread-and-circus` |
| 8 Extreme Objects and Other Worlds | `astronomy.black-hole` | 8 How Rome Held an Empire | `rome.aqueduct` |
| 9 Galaxies | `astronomy.milky-way` | 9 Crisis, Christianity and Division | `rome.chi-rho-shield` |
| 10 The Universe | `astronomy.big-bang` | 10 The Fall and the Legacy | `rome.crumbling-column` |

## Astronomy levels (100)

| # | Level | Image ID | Draw |
| --- | --- | --- | --- |
| 1 | Your Cosmic Address | `astronomy.cosmic-address` | Earth with a small violet location pin on it, tiny Moon nearby |
| 2 | The Sun, Up Close | `astronomy.sun` | Glowing orange-yellow Sun with a few soft flares |
| 3 | The Rocky Four | `astronomy.rocky-planets` | Four small rocky planets in a row: grey, cream, blue-green, red |
| 4 | Giants of the Outer Dark | `astronomy.gas-giants` | Banded Jupiter with ringed Saturn just behind it |
| 5 | Why We Have Seasons | `astronomy.seasons` | Tilted Earth on a stand beside a small glowing sun lamp |
| 6 | The Moon's Changing Face | `astronomy.moon-phases` | Four Moon phases in a row, crescent to full |
| 7 | Eclipses and a Cosmic Coincidence | `astronomy.eclipse` | Dark Moon disc covering the Sun, with a glowing corona around it |
| 8 | Light-Years: Measuring the Unmeasurable | `astronomy.light-year` | A beam of light streaking from a small star, over a tape measure |
| 9 | The Life of a Star | `astronomy.star-life` | Three stars in a row: yellow, big red giant, tiny white dwarf |
| 10 | Checkpoint: Your Place in the Universe | `astronomy.checkpoint-address` | Tiny Earth inside a small spiral galaxy, on a round plinth |
| 11 | Why the Sky Turns | `astronomy.star-trails` | Circular star trails around one bright center star |
| 12 | A Year Around the Sun | `astronomy.orbit` | Earth on an oval orbit ring around a small Sun |
| 13 | Connect the Dots: Constellations | `astronomy.constellation` | Bright stars joined by thin lines into an Orion-like shape, on a dark tile |
| 14 | The North Star | `astronomy.north-star` | One bright star above a brass compass pointing up |
| 15 | The Ecliptic: The Planets’ Highway | `astronomy.ecliptic` | Tilted band ring with small planet beads along it |
| 16 | Wanderers: How Planets Move Across the Sky | `astronomy.planet-loop` | A red planet tracing a small loop-the-loop path arrow |
| 17 | Tides: The Moon’s Pull on the Ocean | `astronomy.tides` | Ocean wave bulging up toward a small Moon |
| 18 | Where the Moon Came From | `astronomy.giant-impact` | Two rocky spheres colliding in a burst of glowing debris |
| 19 | Craters and Seas on the Moon | `astronomy.moon-craters` | Grey Moon with craters and dark smooth patches |
| 20 | Checkpoint: Reading the Sky | `astronomy.checkpoint-sky` | Round star-chart wheel (planisphere) on a plinth |
| 21 | The First Sky-Watchers | `astronomy.stone-circle` | Ring of standing stones with the Sun rising through a gap |
| 22 | Eratosthenes Measures the Earth | `astronomy.eratosthenes` | Stone well with a sunbeam straight down, and a stick casting a shadow beside it |
| 23 | An Earth-Centered Universe | `astronomy.geocentric` | Brass armillary sphere with Earth at its center |
| 24 | Copernicus Moves the Sun | `astronomy.heliocentric` | Brass orrery with the Sun at the center and planets on arms |
| 25 | Galileo’s Telescope | `astronomy.galileo-telescope` | Long early telescope of wood and leather on a stand |
| 26 | Kepler’s Ellipses | `astronomy.ellipse` | Oval drawn with two pins and a loop of string |
| 27 | Newton’s Gravity | `astronomy.newton-apple` | Red apple falling, with a small Moon behind it |
| 28 | Measuring the Solar System | `astronomy.measuring-tape` | Tape measure stretched from a small Sun to Earth |
| 29 | New Planets: Uranus and Neptune | `astronomy.uranus-neptune` | Pale cyan Uranus and deep blue Neptune side by side |
| 30 | Checkpoint: How We Know | `astronomy.checkpoint-how-we-know` | Open notebook with orbit sketches and a pencil, on a plinth |
| 31 | More Than Meets the Eye: The Spectrum | `astronomy.prism` | Glass prism splitting a white beam into a rainbow |
| 32 | Starlight’s Fingerprints | `astronomy.spectrum-lines` | Rainbow strip crossed by thin dark vertical lines |
| 33 | How Telescopes Work | `astronomy.reflector` | White reflecting telescope, cut away to show its curved mirror |
| 34 | Why Put Telescopes in Space? | `astronomy.space-telescope` | Hubble-style space telescope with two solar panels |
| 35 | Listening to the Sky: Radio Astronomy | `astronomy.radio-dish` | Big white radio dish on a mount |
| 36 | Seeing Heat: Infrared and Webb | `astronomy.webb` | Gold hexagon-mirror telescope on a silver layered sunshield |
| 37 | Getting to Orbit | `astronomy.rocket` | White rocket lifting off on a soft plume |
| 38 | Robot Explorers | `astronomy.rover` | Six-wheeled Mars rover with a mast camera |
| 39 | Humans on the Moon | `astronomy.moon-boot` | Astronaut boot print in grey dust beside a small lunar lander |
| 40 | Checkpoint: The Tools of Astronomy | `astronomy.checkpoint-tools` | Toolbox holding a mini telescope, satellite and prism, on a plinth |
| 41 | Mercury: The Scorched Survivor | `astronomy.mercury` | Small cratered grey planet beside the glowing edge of the Sun |
| 42 | Venus: Earth’s Evil Twin | `astronomy.venus` | Yellow planet wrapped in swirling thick clouds |
| 43 | Earth: The Planet We Know Best | `astronomy.earth` | Blue Earth with white cloud swirls |
| 44 | Mars: A Planet That Lost Its Water | `astronomy.mars` | Rusty red planet with a dry winding riverbed |
| 45 | The Asteroid Belt | `astronomy.asteroids` | Cluster of lumpy grey asteroids of different sizes |
| 46 | Jupiter’s Storms and Moons | `astronomy.jupiter` | Banded Jupiter with its Great Red Spot and four small moons |
| 47 | Ocean Worlds: Europa and Enceladus | `astronomy.europa` | Icy cracked moon with a cutaway showing a blue ocean inside |
| 48 | Titan: A World of Methane Lakes | `astronomy.titan` | Hazy orange moon with dark lakes showing through |
| 49 | The Tilted and the Windy: Uranus and Neptune | `astronomy.tilted-uranus` | Uranus tipped on its side with upright rings, a wind swirl beside it |
| 50 | Milestone: The Solar System | `astronomy.milestone-solar-system` | Grand orrery of eight planets around the Sun, slightly larger and more detailed |
| 51 | Pluto and the Dwarf Planets | `astronomy.pluto` | Small beige world with a pale heart-shaped patch |
| 52 | The Kuiper Belt | `astronomy.kuiper-belt` | Ring of small icy bodies, with a tiny distant Sun |
| 53 | Comets: Dirty Snowballs | `astronomy.comet` | Icy comet nucleus with a two-part glowing tail |
| 54 | Shooting Stars and Meteorites | `astronomy.meteorite` | Dark pitted meteorite with a shooting-star streak above it |
| 55 | The Oort Cloud | `astronomy.oort-cloud` | Faint sphere of icy dots around a tiny Sun |
| 56 | Inside the Sun | `astronomy.sun-cutaway` | Sun sliced open to show glowing layers down to the core |
| 57 | Sunspots and the Solar Cycle | `astronomy.sunspots` | Orange Sun with a few dark spots |
| 58 | Solar Storms and Auroras | `astronomy.aurora` | Green and violet aurora curtain over a small snowy hill |
| 59 | How the Solar System Formed | `astronomy.planet-disk` | Swirling disk of dust around a young star |
| 60 | Checkpoint: The Sun’s Domain | `astronomy.checkpoint-sun-domain` | Sun inside a faint bubble boundary, on a plinth |
| 61 | Parallax: Measuring the Stars | `astronomy.parallax` | Raised thumb with two sight lines to a distant star |
| 62 | Bright or Close? Luminosity | `astronomy.luminosity` | Two stars, one bright and far, one dim and near, with glow rings |
| 63 | The H–R Diagram | `astronomy.hr-diagram` | Chart tile with a diagonal band of colored star dots |
| 64 | The Main Sequence | `astronomy.main-sequence` | Row of stars from small red to large blue |
| 65 | Star Partners: Binary Stars | `astronomy.binary-stars` | Two stars circling each other on linked orbits |
| 66 | Stellar Nurseries | `astronomy.nebula` | Tall glowing gas pillar with tiny young stars |
| 67 | Red Giants and Planetary Nebulae | `astronomy.planetary-nebula` | Glowing ring nebula with a tiny white center |
| 68 | White Dwarfs | `astronomy.white-dwarf` | Tiny brilliant white star inside a faint outline of its old size |
| 69 | Supernovae and Star Stuff | `astronomy.supernova` | Star exploding in a bright burst with an expanding shell |
| 70 | Checkpoint: The Lives of Stars | `astronomy.checkpoint-stars` | Ring of stars showing the life cycle, on a plinth |
| 71 | Neutron Stars | `astronomy.neutron-star` | Small dense glowing sphere with magnetic field loops |
| 72 | Pulsars: Cosmic Lighthouses | `astronomy.pulsar` | Spinning star sending two light beams, like a lighthouse |
| 73 | Black Holes | `astronomy.black-hole` | Black sphere with a glowing orange disk around it |
| 74 | The Event Horizon | `astronomy.event-horizon` | Black circle with a bright ring of bent light at its edge |
| 75 | The Black Hole at Our Center | `astronomy.galactic-center` | Soft glowing orange ring around a dark center |
| 76 | Gravitational Waves | `astronomy.gravitational-waves` | Two black holes circling on a rippling grid |
| 77 | Finding Exoplanets | `astronomy.exoplanet-transit` | Star with a small planet crossing in front, and a dipping light line below |
| 78 | The Habitable Zone | `astronomy.habitable-zone` | Star with red, green and blue rings, and a planet in the green one |
| 79 | The Search for Life | `astronomy.search-for-life` | Radio dish pointed at a small blue-green planet |
| 80 | Checkpoint: Extreme Objects and Other Worlds | `astronomy.checkpoint-extreme` | Black hole and a small exoplanet together, on a plinth |
| 81 | Kinds of Galaxies | `astronomy.galaxy-types` | Spiral, elliptical and irregular galaxies side by side |
| 82 | Inside the Milky Way | `astronomy.milky-way` | Barred spiral galaxy with a small violet "you are here" dot |
| 83 | When Galaxies Collide | `astronomy.galaxy-collision` | Two spiral galaxies merging, with stretched tails |
| 84 | The Local Group | `astronomy.local-group` | Two big spirals with small dwarf galaxies scattered around |
| 85 | Dark Matter | `astronomy.dark-matter` | Galaxy inside a faint, see-through halo sphere |
| 86 | Galaxy Clusters and Gravitational Lenses | `astronomy.gravitational-lens` | Magnifying glass bending a galaxy's light into an arc |
| 87 | Quasars and Active Galaxies | `astronomy.quasar` | Galaxy core blazing with two opposite jets |
| 88 | Hubble’s Expanding Universe | `astronomy.expanding-balloon` | Balloon with galaxy dots spreading apart as it inflates |
| 89 | Redshift | `astronomy.redshift` | Light wave stretching out from blue to red |
| 90 | Checkpoint: A Universe of Galaxies | `astronomy.checkpoint-galaxies` | Stack of three galaxy cards, on a plinth |
| 91 | The Big Bang | `astronomy.big-bang` | Bright burst of light and particles from a single point |
| 92 | The Afterglow: Cosmic Microwave Background | `astronomy.cmb` | Oval mottled blue-and-orange map in a small frame |
| 93 | The First Stars and Galaxies | `astronomy.first-stars` | A few big blue stars lighting up darkness |
| 94 | Dark Energy | `astronomy.dark-energy` | Galaxies being pushed apart by outward arrows |
| 95 | How Big Is the Observable Universe? | `astronomy.observable-universe` | Sphere full of galaxies, with a tiny Earth dot at the center |
| 96 | Integration: From Atoms to Galaxies | `astronomy.atoms-to-galaxies` | Atom model and spiral galaxy, joined by a glowing line |
| 97 | Integration: How We Know What We Know | `astronomy.how-we-know` | Telescope and magnifying glass over a star chart |
| 98 | Integration: Futures of the Sun, Earth and Universe | `astronomy.futures` | Hourglass with stars and a red giant inside |
| 99 | Integration: The Big Open Questions | `astronomy.open-questions` | Question mark made of stars (a shape, not a letter) |
| 100 | Mastery Challenge: Astronomy | `astronomy.mastery` | Grand telescope trimmed in gold under a gold star (gold allowed) |

## Ancient Rome levels (100)

| # | Level | Image ID | Draw |
| --- | --- | --- | --- |
| 1 | Rome in One Level | `rome.triumphal-arch` | Roman triumphal arch with a laurel wreath on top |
| 2 | Romulus and Remus | `rome.she-wolf` | Bronze she-wolf statue on a stone base |
| 3 | What the Ground Remembers | `rome.excavation` | Trowel and brush beside a pottery shard in soil |
| 4 | Seven Hills and a River | `rome.seven-hills` | Seven green hills along a winding blue river |
| 5 | The Etruscans Next Door | `rome.etruscan-vase` | Black and terracotta Etruscan vase |
| 6 | The Seven Kings | `rome.curule-chair` | Folding ivory seat of office (curule chair) |
| 7 | Gods of the Household and the State | `rome.lararium` | Small household shrine with a flickering flame |
| 8 | The Roman Family | `rome.domus` | Roman house with an open atrium and a pool |
| 9 | The Last King | `rome.fallen-throne` | Toppled royal seat on stone steps |
| 10 | Checkpoint: How Rome Began | `rome.checkpoint-founding` | Small she-wolf on seven little hills, on a plinth |
| 11 | A Republic Is Born | `rome.spqr-standard` | Tall standard topped with a wreath and a small eagle |
| 12 | Two Consuls, One Year | `rome.fasces` | Two fasces (rod bundles with axes) side by side |
| 13 | The Senate | `rome.curia` | Senate house: plain brick building with a bronze door |
| 14 | Patricians and Plebeians | `rome.two-tunics` | Two folded garments, one with a purple stripe and one plain |
| 15 | The Twelve Tables | `rome.bronze-tablets` | Stack of bronze tablets with engraved lines |
| 16 | Tribunes of the Plebs | `rome.raised-hand` | Raised open hand in a stop gesture, simple bronze |
| 17 | Cincinnatus and the Citizen Ideal | `rome.plough` | Wooden plough with a folded toga laid over it |
| 18 | The Gauls Sack Rome | `rome.geese` | Two white geese honking on temple steps |
| 19 | Conquering Italy | `rome.stone-road` | Paved stone road running into the distance |
| 20 | Checkpoint: How the Republic Worked | `rome.checkpoint-republic` | Balance scale with three small weights, on a plinth |
| 21 | Carthage, Queen of the Sea | `rome.carthage-ship` | Carthaginian warship with purple sails |
| 22 | The First Punic War | `rome.corvus` | Roman warship with a raised spiked boarding bridge |
| 23 | Hannibal Crosses the Alps | `rome.war-elephant` | War elephant in snowy mountains |
| 24 | Disaster at Cannae | `rome.pincer` | Battle-map arrows closing around a block, like a pincer |
| 25 | Fabius the Delayer | `rome.hourglass-shield` | Hourglass leaning against a Roman shield |
| 26 | Scipio and Zama | `rome.palm-wreath` | Victory laurel wreath hung on a palm tree |
| 27 | Rome Turns East | `rome.greek-temple` | Small Greek temple with a Roman eagle perched on it |
| 28 | Carthage Must Be Destroyed | `rome.ruins` | Broken columns with a wisp of smoke |
| 29 | The Legion | `rome.legion-kit` | Red curved shield with a short sword and a javelin |
| 30 | Checkpoint: Master of the Mediterranean | `rome.checkpoint-mediterranean` | Mediterranean-shaped sea basin with a small eagle, on a plinth |
| 31 | The Gracchi Brothers | `rome.boundary-stone` | Farm fields with a carved boundary stone |
| 32 | Marius Remakes the Army | `rome.aquila` | Silver eagle standard (aquila) on a pole |
| 33 | Sulla Marches on Rome | `rome.city-gate` | City gate with a legion standard in front of it |
| 34 | Spartacus | `rome.broken-chains` | Broken iron chain beside a short gladiator sword |
| 35 | Pompey the Great | `rome.pirate-ship` | Small pirate ship with a snapped mast |
| 36 | Cicero Against Catiline | `rome.rostra` | Speaker's platform with a rolled scroll on it |
| 37 | The First Triumvirate | `rome.three-rings` | Three interlocking gold-brown rings (not gold-bright) |
| 38 | Caesar in Gaul | `rome.gallic-torc` | Celtic neck ring (torc) on a round Gallic shield |
| 39 | Crossing the Rubicon | `rome.rubicon-die` | Small river with a die tumbling in the air above it |
| 40 | Checkpoint: The Ides of March | `rome.checkpoint-ides` | Laurel wreath with one leaf fallen, on a plinth |
| 41 | Octavian, Caesar's Heir | `rome.signet-ring` | Signet ring with a laurel engraving |
| 42 | Antony and Cleopatra | `rome.cobra-diadem` | Egyptian cobra diadem beside a Roman helmet |
| 43 | Actium | `rome.warships-clash` | Two warships ramming on stylized waves |
| 44 | Augustus, First Emperor | `rome.laurel-wreath` | Green laurel wreath on a marble pedestal |
| 45 | The Pax Romana | `rome.olive-branch` | Olive branch across a closed temple door |
| 46 | A City of Marble | `rome.ara-pacis` | White marble altar with carved friezes |
| 47 | Virgil and the Aeneid | `rome.aeneid` | Rolled scroll on a wooden rod beside a small burning tower |
| 48 | Months Named for Emperors | `rome.calendar-wheel` | Round stone calendar wheel with month markers |
| 49 | Teutoburg Forest | `rome.dark-forest` | Dark pine forest with a fallen Roman helmet |
| 50 | Milestone: From Republic to Empire | `rome.milestone-empire` | Eagle standard rising from a column, grander composition (no gold) |
| 51 | Tiberius | `rome.capri` | Rocky island with a white villa on top |
| 52 | Caligula | `rome.caliga` | Small hobnailed soldier's sandal-boot |
| 53 | Claudius Conquers Britain | `rome.white-cliffs` | Roman ship landing below white cliffs |
| 54 | Nero and the Great Fire | `rome.great-fire` | Row of city buildings with flames rising |
| 55 | The Year of the Four Emperors | `rome.four-wreaths` | Four laurel wreaths in a row |
| 56 | The Flavians and the Colosseum | `rome.colosseum` | The Colosseum (same image as the skill icon) |
| 57 | Pompeii and Vesuvius | `rome.vesuvius` | Volcano erupting above a small town (can reuse your **existing** volcano style) |
| 58 | Trajan's Empire at Its Largest | `rome.trajans-column` | Tall column with a spiral carved band |
| 59 | Hadrian and His Wall | `rome.hadrians-wall` | Stone wall with a small fort tower over green hills |
| 60 | Checkpoint: The Five Good Emperors | `rome.checkpoint-good-emperors` | Five laurel wreaths in a circle, on a plinth |
| 61 | A Day in the City | `rome.insula` | Tall Roman apartment block with shops at street level |
| 62 | Slavery in Rome | `rome.freedom-cap` | Opened iron shackle beside a felt freedman's cap |
| 63 | Bread and Circuses | `rome.bread-and-circus` | Round Roman loaf in front of a racetrack arena |
| 64 | Gladiators | `rome.gladiator-kit` | Gladiator helmet with a trident and net |
| 65 | Chariot Racing | `rome.chariot` | Four-horse racing chariot, mid-gallop |
| 66 | The Baths | `rome.baths` | Steaming bath pool framed by columns |
| 67 | What Romans Ate | `rome.amphora-feast` | Amphora with olives, bread and grapes |
| 68 | Latin, the Language That Lived On | `rome.carved-stone` | Stone slab with carved (unreadable) letter shapes |
| 69 | Roman Women | `rome.jewelry` | Ornate hairpin and necklace on a small table |
| 70 | Checkpoint: Everyday Rome | `rome.checkpoint-everyday` | Loaf, bath bucket and amphora grouped on a plinth |
| 71 | All Roads Lead to Rome | `rome.milestone-marker` | Roadside milestone beside a paved road |
| 72 | Aqueducts | `rome.aqueduct` | Arched aqueduct with water flowing on top |
| 73 | Roman Concrete | `rome.concrete` | Trowel and a bucket of grey concrete with volcanic ash |
| 74 | The Pantheon | `rome.pantheon` | The Pantheon, domed, with a beam of light through the oculus |
| 75 | Running the Provinces | `rome.wax-seal` | Wax seal pressed on a folded letter |
| 76 | Becoming Roman | `rome.citizen-diploma` | Two small bronze tablets tied together (a military diploma) |
| 77 | Roman Law | `rome.scales` | Balance scales beside a bound law book |
| 78 | Money and Trade | `rome.denarius` | Small pile of silver coins |
| 79 | Life on the Frontier | `rome.frontier-fort` | Wooden watchtower fort with a thin writing tablet |
| 80 | Checkpoint: How Rome Held an Empire | `rome.checkpoint-empire` | Road stone, coin and shield together, on a plinth |
| 81 | The Crisis of the Third Century | `rome.cracked-coins` | Cracked, dull coins spilling over |
| 82 | Diocletian Divides the Empire | `rome.four-pillars` | Four purple stone pillars in a square |
| 83 | The First Christians | `rome.fish-symbol` | Simple fish symbol carved on stone |
| 84 | Persecution | `rome.catacomb-lamp` | Clay oil lamp glowing in a stone niche |
| 85 | Constantine | `rome.chi-rho-shield` | Round shield marked with the Chi-Rho symbol |
| 86 | Constantinople | `rome.constantinople` | Domed city on a strait between two shores |
| 87 | Julian the Apostate | `rome.altar-flame` | Small stone altar with a flame and olive leaves |
| 88 | A Christian Empire | `rome.basilica` | Early basilica church with a long roof |
| 89 | Disaster at Adrianople | `rome.fallen-standard` | Roman standard fallen by a horse's hoofprints |
| 90 | Checkpoint: A Changed Empire | `rome.checkpoint-changed` | Coin split in two halves, eagle and cross, on a plinth |
| 91 | The Sack of Rome, 410 | `rome.broken-gate` | Broken wooden city gate |
| 92 | Attila and the Huns | `rome.hunnic-bow` | Curved composite bow with a horse beside it |
| 93 | 476: The Last Western Emperor | `rome.fallen-eagle` | Imperial eagle standard lying on the ground |
| 94 | Why Did Rome Fall? | `rome.crumbling-column` | Crumbling column with pieces falling away |
| 95 | The Empire That Didn't Fall | `rome.hagia-sophia` | Great domed church (Hagia Sophia style) |
| 96 | Integration: Rome in Our Laws and Governments | `rome.capitol-dome` | Modern domed capitol building with columns |
| 97 | Integration: Rome in Our Words, Calendars and Cities | `rome.grid-city` | Small city laid out on a grid, with a calendar page |
| 98 | Integration: How We Know About Rome | `rome.archaeology-kit` | Magnifying glass over a coin and a carved stone |
| 99 | Integration: The Arc of Roman History | `rome.history-arc` | Roman arch with a ribbon timeline running through it |
| 100 | Mastery Challenge: Ancient Rome | `rome.mastery` | Gold laurel wreath around a gold eagle standard (gold allowed) |

## App states (6)

| Where | Image ID | Draw |
| --- | --- | --- |
| Sign-in screen hero | `ui.welcome` | **existing book**, open, with small stars rising from the pages |
| Daily Knowledge Complete ("go outside") | `ui.daily-complete` | Tree on a small hill under a sunset sky (can reuse your **existing** tree) |
| Review tab | `ui.review` | Stack of cards with a circular refresh arrow |
| Review empty ("nothing due") | `ui.review-clear` | Neat stack of cards with a small check mark |
| Mastery star | `ui.mastery-star` | Gold five-point star with a soft halo (gold allowed) |
| Empty trophy slot | `ui.trophy-empty` | Empty stone pedestal with a faint outline where a trophy will go |

## Totals

- **New images:** 214. That's 6 subjects, 2 skills, 200 levels and 6 app states, of which 5 subject/skill icons and 2 app states can reuse your existing batch.
- **Chapters:** reuse level icons (20 banners, no new art).
- **Not needed from this batch:** your smartphone and factory icons don't map to current content. Keep them for future trees (How the World Works, Money & Economics).
- **Wiring:** each level's image will go into `content/assets.json` with alt text, licence and dimensions (the `Asset` schema), then onto the level's hook card. That's a separate step once the images exist.
