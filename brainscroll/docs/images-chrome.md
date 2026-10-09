# Tab bar icons and the path scene: to make

**Status (2026-10-01): not made yet.** The app uses stand-ins from the existing UI set until these exist:

- **Tab bar:** icons only, no labels (owner, 2026-10-09). Home uses `ui/welcome`, Practice `ui/review`, Leagues `ui/medal`, Social the level art `money.handshake` and Profile `ui/profile` (`app/src/app/(tabs)/_layout.tsx`).
- **Path scene:** Dr. Scroll at his large size beside the road.

These are the highest-impact pieces of art left for the "premium" feel: they show on every screen (the tab bar) or on the main screen (the path).

## 1. Tab bar icons (4)

One icon per tab, in the same style as the UI set: chunky, rounded 3D clay with soft light from the top left. Each should be a single bold object that reads at 30 px.

| File name | Tab | What to draw |
| --- | --- | --- |
| `tab_home.png` | Home (the World Map) | A small globe on a stand, or a folded treasure map with a dotted path |
| `tab_skills.png` | Skills (what you're leveling) | A stack of three books, slightly fanned, with a small star on top |
| `tab_review.png` | Review (bring knowledge back) | Two cards with a circular arrow, like the current `review` art but simpler and bolder |
| `tab_profile.png` | Profile (your character sheet) | Dr. Scroll's bow tie, or a simple shield-shaped badge with a brain on it. **Not a person's face:** the profile belongs to the learner |

**Rules for all four:**
- The same light, angle and saturation, so they read as one set.
- No text or numbers.
- Strong silhouettes: the inactive tabs are shown at half opacity, so each must still be recognisable faded.
- **Transparent background, 1024 × 1024 PNG**, the object filling about 80% of the frame, centered.

## 2. Dr. Scroll beside the path (2)

| File name | What to draw |
| --- | --- |
| `path_drscroll.png` | Dr. Scroll standing on a small grassy mound or a stack of books, looking through his telescope toward the path (his current path pose, as a fuller little scene). Full body, about two thirds of the frame. |
| `path_drscroll_next.png` | The same scene as a flat dark silhouette (one colour, `#2A3A42`), with no details. It's shown beside the next, locked chapter, like a preview of what's ahead. |

The rules match the mascot reference (`docs/mascot-reference.webp`). Use a **transparent background, 1024 × 1024 PNG**, with the figure standing on the bottom edge.

## When they're done

Send the PNGs as they are. They'll be converted to 256 px WebP (tab icons) and 512 px WebP (path scene) and wired in. The stand-ins are then removed.


## Brainpower

The Brainpower images (the header brain, its empty and Unlimited states, the +1 spark) are in [`images-brainpower.md`](images-brainpower.md).
