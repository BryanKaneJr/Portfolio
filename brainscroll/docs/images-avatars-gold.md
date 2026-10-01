# Gold profile avatars: one per tree, for mastering it

**Status (2026-10-01): made by the owner and in the app** (`app/assets/images/avatars/<skill slug>-gold.webp`). They came out as fully gold coins, backdrop included, which reads as the gold tier at a glance. Each tree's regular avatar ([`images-avatars.md`](images-avatars.md)) is unlocked from the start. Its gold version unlocks when the learner **masters that tree (Level 100)**, the same moment as its mastery trophy. In a league list or the feed, a gold avatar should be the rarest, most noticeable thing on screen.

## How to make them

- **Make each one as an edit of its regular avatar**, so the frame, the object, its angle and the part that pops out stay exactly where they were. The upgrade should read as "the same, but legendary."
- **The object becomes solid polished gold**, matching the existing gold trophies (`trophy_master-of-all.png`, the mastery emblems):
  - rich yellow gold, warm highlights and soft light from the top left;
  - crisp reflections, so it clearly reads as **metal**, not yellow paint.
  - Small parts that need to stay readable (a flame's glow, a bubble, a paint blob) may keep a hint of their colour under the gold sheen, but gold must dominate.
- **The ring becomes gold too**, with a fine **laurel wreath engraved** around it, and a small raised **gold star** set into the bottom of the rim (the mastery star ★). The star sits at the bottom so it never fights with the pop-out at the top.
- **The backdrop stays the subject's colour**, but deeper and richer than the regular version, so the gold pops against it. Add a soft radial glow behind the object.
- **A few small sparkles:** two or three four-point glints on the gold, no more. It should feel precious, not glittery.
- **One legendary touch per tree** (the table below): a small extra detail that only the gold version has, in gold.
- **The same rules as the regular set:** no text, letters or numbers; no real people's faces; no symbol of any one faith; readable at 32 px.
- **Canvas:** transparent background, 1024 × 1024 PNG, framed exactly like its regular version, so the two can be swapped without anything jumping.

## The 26 gold avatars

| File name | Tree | Gold version, and its legendary touch |
| --- | --- | --- |
| `avatar_astronomy-gold.png` | Astronomy | The gold ringed planet, its ring still breaking out on both sides. **Touch:** tiny gold stars set into the ring like jewels. |
| `avatar_chemistry-gold.png` | Chemistry | The gold flask. Its liquid glows gold, and the bubbles rising out of the frame are little gold spheres. **Touch:** one bubble is a tiny gold atom with orbiting rings. |
| `avatar_animals-gold.png` | The Animal Kingdom | The lion's head in gold, its mane spilling over the rim. **Touch:** a small gold crown resting on the mane, the king of the kingdom. |
| `avatar_human_body-gold.png` | The Human Body | The heart in gold, with a gold stethoscope over the rim. **Touch:** a faint gold heartbeat line engraved across the backdrop behind it. |
| `avatar_ancient_rome-gold.png` | Ancient Rome | The legionary helmet in gold. Its crest rising out of the top is now deep red with gold edges. **Touch:** a gold laurel wreath around the helmet's brow, the general's honour. |
| `avatar_ancient_egypt-gold.png` | Ancient Egypt | The pyramid in gold against a blazing gold sun, with the gold scarab on the rim. **Touch:** the scarab holds up a small gold sun disc. |
| `avatar_ancient_greece-gold.png` | Ancient Greece | The column capital and the owl, both in gold. **Touch:** the owl wears a tiny olive wreath. |
| `avatar_middle_ages-gold.png` | The Middle Ages | The castle tower in gold, its pennant streaming out of the frame in gold cloth. **Touch:** a small gold crown on top of the tower. |
| `avatar_us_history-gold.png` | US History | The raised torch in gold, its flame rising out of the top. **Touch:** the flame itself is cast in gold, like a statue's. |
| `avatar_world_geography-gold.png` | World Geography | The globe on its stand in gold, the continents raised and polished. **Touch:** a gold compass rose engraved on the base of the stand. |
| `avatar_oceans-gold.png` | The Oceans | The wave and the whale tail in gold. **Touch:** a few gold droplets flying off the tail as it flips out of the frame. |
| `avatar_earth_climate-gold.png` | Earth, Weather & Climate | The storm cloud in gold, the lightning bolt striking out the bottom in bright gold. **Touch:** a small gold rainbow arcing behind the cloud. |
| `avatar_art_history-gold.png` | Art History | The palette and brush in gold. The paint blobs keep a hint of their colours under the gold. **Touch:** a tiny ornate gold picture frame hanging from the brush tip. |
| `avatar_music-gold.png` | Music | The trumpet in gold, with gold notes bursting out of the frame. **Touch:** a gold conductor's baton crossing behind the trumpet. |
| `avatar_architecture-gold.png` | Architecture | The arch in gold blocks, the keystone lifting out of the top. **Touch:** the keystone carries a small engraved star. |
| `avatar_literature-gold.png` | Literature | The open book in gold, its pages fluttering out of the frame as gold leaf. **Touch:** a gold quill resting in the open spine. |
| `avatar_film_tv-gold.png` | Film & TV | The clapperboard in gold, its arm snapping open out of the frame. **Touch:** a gold star on the board's face, like a walk of fame. |
| `avatar_philosophy-gold.png` | Philosophy | The question mark in gold marble with gold veins, its olive sprig in gold. **Touch:** the dot of the question mark is a small glowing gold orb. |
| `avatar_logic-gold.png` | Logic & Critical Thinking | The jigsaw in gold, the lifting piece in bright polished gold. **Touch:** the lifting piece has a tiny engraved star in its middle. |
| `avatar_probability-gold.png` | Probability & Statistics | The two dice in gold with deep-set pips, one bouncing out of the frame. **Touch:** both dice land showing six. |
| `avatar_psychology-gold.png` | Psychology | The brain in gold inside a gold thought bubble, the trailing bubbles in gold. **Touch:** a soft halo of light around the brain. |
| `avatar_religions-gold.png` | World Religions | The lantern in gold, its glow warm gold, the curl of light rising out of the top. **Touch:** the light curl ends in a few small gold sparks. No symbol of any one faith. |
| `avatar_money-gold.png` | How Money Works | The coin stack in brighter, richer gold than the regular version, one coin flipping out of the frame. **Touch:** the flipping coin is larger and has a small engraved star. |
| `avatar_government-gold.png` | How Government Works | The ballot box in gold, the ballot sticking out of the top in gold foil. **Touch:** a gold seal stamped on the front of the box. |
| `avatar_everyday_technology-gold.png` | Everyday Technology | The lightbulb in gold glass, glowing warm, its top breaking out of the frame. **Touch:** a gold filament shaped like a tiny star. |
| `avatar_computers-gold.png` | Computers & the Internet | The laptop in gold, the Wi-Fi arcs rising out of the frame in gold. **Touch:** the screen shows a small gold star. |

## Rules for the set

- **Side by side with the regular set:** place each gold avatar next to its regular one. Everything except the material, the ring, the star and the touch should line up exactly.
- **One family:** the same gold, the same laurel ring, the same star size and the same number of sparkles on all 26.
- **Distinct from the regular set at 32 px:** at small sizes, the gold ring alone should make a gold avatar unmistakable in a list.

## When they're done

Send the PNGs as they are. They'll be converted to 256 px WebP. A learner who masters a tree will then be able to pick its gold avatar, and it shows wherever their avatar does. The server checks the unlock, so it can't be worn without the mastery.
