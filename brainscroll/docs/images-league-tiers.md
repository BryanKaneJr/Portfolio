# League tier images: to make

**Status (2026-10-08): to make.** The app draws a simple stand-in for each tier in code (`app/src/components/LeagueTier.tsx`) until these arrive.

Leagues come in eight tiers (owner, 2026-10-08: "we just do gems and then crown as the top"). Each tier is one object, so each image is one object: seven gems and a crown.

## Where they show (and how small)

- **Profile and friends' profiles:** beside the league's name, at about **20 px**.
- **The League screen:** top right, beside the title, at about **36 px**.
- **Social, after moving up:** on the "Welcome to the Sapphire League!" card, at about **44 px**.

They have to read at 20 px, so keep each shape bold and simple: the outline and the colour do the work, not fine detail.

## Style for all of them

- The same chunky, rounded 3D look as the trophies and the Brainpower brain (`app/assets/images/ui/`), with soft light from the top left and a gentle shadow. Glossy and faceted is fine, but they should stay in the app's soft, friendly style, not photoreal.
- **One cut for all seven gems:** the same shape, angle, size and position, so they read as a set. Only the colour changes. A classic brilliant cut seen from the front (flat top, pointed bottom), like a gem icon, works best at small sizes.
- **Transparent background, 1024 × 1024 PNG**, the object filling about 80% of the frame, centered.
- **No text, numbers or letters.**
- **Not gold** anywhere (gold means mastery in BrainScroll). That includes the crown, unless you decide otherwise: a gold crown would be an owner exception, like the Unlimited brain.

## The eight images (bottom tier first)

| File name | League | What to draw | Colour (top to bottom of the gem) |
| --- | --- | --- | --- |
| `league_quartz.png` | Quartz League (where everyone starts) | The gem, in pale rose quartz: soft, a little milky | `#F7E4EC` → `#B98FA0` |
| `league_amethyst.png` | Amethyst League | The same gem, in clear purple | `#DDBDFF` → `#7A3FC8` |
| `league_aquamarine.png` | Aquamarine League | The same gem, in sea-glass aqua | `#B8F4EF` → `#2BA3AE` |
| `league_sapphire.png` | Sapphire League | The same gem, in deep blue | `#9CCBFF` → `#1F4FB8` |
| `league_emerald.png` | Emerald League | The same gem, in rich green | `#93F2B6` → `#13874A` |
| `league_ruby.png` | Ruby League | The same gem, in deep red (crimson, not orange) | `#FF9EAE` → `#B3133A` |
| `league_diamond.png` | Diamond League | The same gem, clear and icy, with bright white sparkle highlights. This is the most brilliant of the seven | `#FFFFFF` → `#9CD3F0` |
| `league_crown.png` | Crown League (the top) | A small, friendly crown with three points and a band, set with pearls. Royal violet, not gold. It should feel like the prize at the top of the gem set, so a gem or two set in the band ties it to the others | `#CDBEFF` → `#5A35D6`, pearls `#FFF6FB` |

**Rule for the set:** put all eight side by side before sending. The seven gems should look like the same gem in seven colours, and the crown should look like it belongs with them.

## When they're done

Send the eight PNGs as they are (a Dropbox folder link is fine). They'll be converted to WebP, saved as `app/assets/images/ui/league-<name>.webp` (for example `league-sapphire.webp`), and wired in `app/src/components/ui/uiArt.ts` in place of the code-drawn emblems.
