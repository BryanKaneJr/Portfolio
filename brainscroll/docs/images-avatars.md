# Profile avatars: one per tree, to make

**Status (2026-10-01): concepts only, not made yet.** Every tree's avatar is unlocked from the start (owner: "I like variety right off the rip"), so a new learner can pick any of the 26 on day one. Until these exist, Social shows each learner's initial on a coloured circle.

## The look

A **circular frame with the object inside it, breaking out of the frame**: part of it pokes past the rim (usually out the top, sometimes a side), so it looks like it's popping out at you in 3D.

- **Style:** the same chunky, rounded 3D clay as the rest of the app's art, lit softly from the top left, with saturated colour and no fine detail.
- **The frame:** a thick round ring, like a medallion rim, with a soft inner backdrop in the **tree's subject colour**:

  | Subject | Colour |
  | --- | --- |
  | History | terracotta |
  | Science | blue |
  | Geography | teal |
  | Arts & Culture | pink |
  | How the World Works | lavender |
  | Mind & Reasoning | green |

  The ring itself is a neutral warm grey, so the gold mastery version can swap it for gold later.
- **The pop-out:**
  - About a quarter to a third of the object breaks past the rim, and the rest stays inside the circle.
  - The part outside the rim overlaps the ring, so it's clearly in front of it.
  - Add a soft contact shadow where it crosses the ring.
- **Readable small:** it has to work at 32 px in a league list. One bold object, a strong silhouette, nothing thin.
- **No text, letters or numbers.** No real people's faces. No religious symbol of any one faith.
- **Canvas:** 1024 × 1024 PNG with a transparent background.
  - The circle takes about 75% of the width, centered low enough that the pop-out has room above it.
  - The whole image, pop-out included, stays inside the canvas.

## Mastery version (later)

Each avatar gets a **gold version** for mastering its tree (Level 100): the same scene in polished gold, with an engraved laurel ring, a mastery star and one small "legendary touch." See [`images-avatars-gold.md`](images-avatars-gold.md).

## The 26 avatars

| File name | Tree | What's inside, and what pops out |
| --- | --- | --- |
| `avatar_astronomy.png` | Astronomy | A ringed planet, tilted. Its ring breaks out past the frame on both sides, like it's too big for the circle. |
| `avatar_chemistry.png` | Chemistry | A round-bottom flask of bright bubbling liquid. Bubbles float up and out over the top of the rim. |
| `avatar_animals.png` | The Animal Kingdom | A friendly lion's head, front on. Its big mane spills over the rim all around the top. |
| `avatar_human_body.png` | The Human Body | A cute, simplified heart (the classic red shape with a little depth), with a stethoscope draped over the rim. Its chest piece dangles outside the frame. |
| `avatar_ancient_rome.png` | Ancient Rome | A Roman legionary helmet, side on. Its tall red crest rises up and out of the top of the frame. |
| `avatar_ancient_egypt.png` | Ancient Egypt | A pyramid against a big setting sun. A golden scarab crawls over the front of the rim. |
| `avatar_ancient_greece.png` | Ancient Greece | The top of an Ionic column (the scroll capital), with a small owl perched on it. The owl pokes out over the top of the frame. |
| `avatar_middle_ages.png` | The Middle Ages | A round castle tower with battlements. A long pennant flag streams out of the top and off to one side. |
| `avatar_us_history.png` | US History | A raised torch with a big glowing flame. The hand and the flame rise out of the top of the frame. |
| `avatar_world_geography.png` | World Geography | A globe on its stand, tilted. The top of the globe breaks out above the rim. |
| `avatar_oceans.png` | The Oceans | A curling wave inside the circle. A whale's tail flips up out of it and out the top. |
| `avatar_earth_climate.png` | Earth, Weather & Climate | A puffy storm cloud filling the circle. A chunky lightning bolt strikes down and out the bottom of the frame. |
| `avatar_art_history.png` | Art History | A painter's palette with fat blobs of paint. A paintbrush sticks out diagonally past the rim. |
| `avatar_music.png` | Music | A trumpet, bell facing us. Two or three chunky music notes burst out of the bell and over the rim. |
| `avatar_architecture.png` | Architecture | A stone arch. Its keystone pops up and out of the top of the frame, mid-lift. |
| `avatar_literature.png` | Literature | An open book. Two or three pages lift and flutter up out of the top of the frame. |
| `avatar_film_tv.png` | Film & TV | A clapperboard. Its striped top arm snaps open, up and out of the frame. |
| `avatar_philosophy.png` | Philosophy | A marble question mark with a small olive sprig. Its curl rises out of the top of the frame. |
| `avatar_logic.png` | Logic & Critical Thinking | A chunky jigsaw puzzle. One bright piece lifts up out of it and out of the frame. |
| `avatar_probability.png` | Probability & Statistics | Two big dice tumbling. One is mid-bounce, out of the top of the frame. Pips are rounded dots, not numbers. |
| `avatar_psychology.png` | Psychology | A soft pink brain inside a thought bubble. Two small trailing bubbles float out over the rim. |
| `avatar_religions.png` | World Religions | A warm oil lantern, its glow filling the circle. A curl of light or smoke rises out of the top. No symbol of any one faith. |
| `avatar_money.png` | How Money Works | A stack of gold coins. One coin flips up out of the frame, caught mid-spin. |
| `avatar_government.png` | How Government Works | A ballot box. A ballot is halfway in, sticking up out of the top of the frame. |
| `avatar_everyday_technology.png` | Everyday Technology | A big glowing lightbulb. Its rounded top breaks out above the rim, with a few rays of light. |
| `avatar_computers.png` | Computers & the Internet | A small laptop, lid open. Wi-Fi arcs rise out of the screen and up past the rim. |

## Rules for the set

- **One family:** the same rim thickness, the same lighting, the same amount of pop-out (roughly) and the same saturation on all 26. Lay them out in a grid before calling it done: none should look heavier or flatter than the rest.
- **Distinct at a glance:** in a league list of 20, two learners with different avatars should never be mistaken for each other. The silhouettes above were picked to differ (round planet, tall crest, flame, bolt, coin...).
- **No overlap with Dr. Scroll:** he's the app's mascot, not an avatar, so none of these include him.

## When they're done

Send the PNGs as they are. They'll be converted to 256 px WebP and wired in:

- an avatar picker on your profile, with all 26 unlocked;
- the avatar shown in leagues, the feed, friend lists and profiles;
- the server storing which one you picked.
