# Mascot: Dr. Scroll

A small, round, cheerful old genius who shows up throughout BrainScroll: waving on the sign-in screen, pointing at the key idea on a card, cheering a level-up, shrugging kindly at a wrong answer. His name is **Dr. Scroll**.

## He is our own character, not Einstein

He's inspired by the "wild-haired genius professor" idea, but he must not be Albert Einstein or look like him. Einstein's name and likeness are licensed commercially, and a lookalike would also clash with our "no real people" image rule.

- Never put "Einstein" in a prompt, a file name or app copy.
- Avoid Einstein's signatures: the big droopy mustache, the tongue-out pose, the sweater-and-no-socks look, and chalkboard equations.
- His own signatures, below, should be what people recognize.

## Look (every image)

He's deliberately simple, because the image model redraws small details differently every time. Only these five things define him, and every pose must keep all five:

1. **A round toy-like body.** His head is a bit under half his height, with short arms and legs and simple mitten-like hands.
2. **A bald crown with two white cloud tufts** of hair at the sides, and simple white eyebrows. No mustache or beard.
3. **Thin dark round glasses** over small black oval eyes, with a round nose and a gentle smile.
4. **A plain brown jacket** over a cream shirt, with brown trousers and shoes. The jacket has no buttons, patches, pockets or texture.
5. **A violet bow tie**, his signature.

Nothing else. **No pencil, no elbow patches, no buttons**, and no badges, pens or pocket items. The first reference image had a pencil, patches and buttons; those are dropped.

- **Style:** soft matte 3D clay, smooth and slightly velvety, with soft even light and a gentle shadow under his feet.
- **Background:** transparent, so he can sit on top of cards and screens.
- **Rules:** he's the only character in the image, holding **at most one prop**. No text, letters or numbers anywhere, and no gold except in `mascot.mastery`.

## Personality (for copy written next to him)

- Delighted by facts: "Oh, this one's good."
- Warm and never condescending. He's excited to share, not showing off.
- Gentle with mistakes. He shrugs, smiles and moves on, and he never scolds.
- Short lines. He's a sidekick, not a lecturer. The cards carry the teaching.

## Making him consistent

A character only works if he looks like the same person in every image.

1. **Remake `mascot.reference` in the simplified look first.** Edit the approved image ([`mascot-reference.webp`](mascot-reference.webp)) to remove the pencil, the elbow patches and the jacket buttons, and change nothing else. Approve that edit, then replace `mascot-reference.webp` with it. Every pose is made from the simplified version, never the old one.
2. Make every pose **from that reference image**, using the image model's reference or edit input, not text alone. The prompt should say "the same character" and describe only the pose and prop.
3. Review the poses side by side. Check the five signatures in each one, and reject any where they drift or where extra details appear.

## Poses

### Everywhere

| Image ID | Pose | Used for |
| --- | --- | --- |
| `mascot.reference` | Standing front view, hands at his sides, friendly smile | The master image every pose is made from; also the app's "about" and profile spots |
| `mascot.wave` | Waving hello with one hand | Sign-in screen, first open of the day |
| `mascot.pointing` | Pointing to one side with a finger, looking that way | Next to a key idea on a lesson card ("look at this") |
| `mascot.thinking` | Hand on chin, eyes up, pondering | Question screens, "think about it" moments |
| `mascot.idea` | One finger raised, eyebrows up, a small glowing spark above his head | "Aha" moments, key takeaways |
| `mascot.explaining` | Both palms open, mid-sentence | Explanation cards, onboarding |
| `mascot.chalkboard` | Holding up a small blank chalkboard | Lesson intros, recaps |
| `mascot.reading` | Reading an open book, delighted | Sources and "read more" |
| `mascot.magnifier` | Holding up a magnifying glass, looking through it | "Look closer" cards, fact-check and source notes |
| `mascot.surprised` | Eyebrows up, mouth in a round "oh!" | "Did you know?" surprising facts |
| `mascot.whisper` | Hand beside his mouth, leaning in | Fun facts and asides |
| `mascot.waiting` | Checking a pocket watch | Loading states |
| `mascot.tangled` | Scratching his head with a sheepish smile | Errors and offline |

### Feedback

| Image ID | Pose | Used for |
| --- | --- | --- |
| `mascot.thumbs-up` | Big thumbs-up and a grin | Correct answer |
| `mascot.oops` | Gentle shrug with a kind smile | Wrong answer (never mocking) |
| `mascot.encourage` | Small fist pump, "you've got this" | Try again, review prompts |
| `mascot.clapping` | Clapping, eyes closed with joy | Finishing a level |
| `mascot.celebrate` | Both arms up, jumping for joy | Level up |

### Progress and the day

| Image ID | Pose | Used for |
| --- | --- | --- |
| `mascot.checkpoint` | Holding a clipboard with a big check mark | Checkpoint levels |
| `mascot.review` | Holding a small stack of cards | Review tab |
| `mascot.mastery` | Holding up a gold star, beaming (the only gold) | Mastery Challenge, mastery moments |
| `mascot.go-outside` | Walking away, looking back and waving goodbye | Daily Knowledge Complete ("go touch grass") |
| `mascot.sleeping` | Standing asleep, eyes closed, head tilted | "Come back tomorrow", empty states |

### Subjects (one per subject, for tree headers and chapter intros)

| Image ID | Pose | Subject |
| --- | --- | --- |
| `mascot.history` | Unrolling a long scroll | History |
| `mascot.science` | Holding up a bubbling flask | Science |
| `mascot.geography` | Spinning a small globe on one finger | Geography |
| `mascot.money` | Balancing a coin on his fingertip | Money & Economics |
| `mascot.arts` | Holding up a paintbrush | Arts & Culture |
| `mascot.world-systems` | Holding a big wrench | How the World Works |

That's 29 images. Start with the simplified reference and 5 core poses (wave, pointing, thinking, thumbs-up, oops). Check that he stays consistent, then do the rest.

## In the app (later)

**Built so far:**

- `DrScroll` and `DrScrollSays` in `app/src/components/ui/mascot.tsx`: Dr. Scroll on his own, or with a speech bubble beside him (`row`) or below him (`stack`). The image is decorative; screen readers hear "Dr. Scroll says: ..." instead. Until each pose image is approved, every pose shows the reference image (`app/assets/images/mascot/reference.webp`); add poses to `POSE_ART` as they arrive.
- His lines, poses and the calm in-lesson poses live in `packages/core/src/mascot.ts`.
- **Onboarding intro:** the first onboarding screen after sign-in is Dr. Scroll saying hello (screenshot: `docs/ui/dr-scroll-intro.png`), then pick a skill, then the deal.

**Still to build:**

- **Voice split:** he speaks at fun, low-stakes moments (onboarding, first-time tips, answer reactions, rewards, empty states). Sign-in, accounts, data errors, payments, deletion and legal text stay in the plain app voice. He never guilt-trips.
- **Lessons:** an optional `mascot` field on a card (pose plus a one-line aside) lets the content writer drop him in where he helps. Most cards won't have him, so he stays special.
- **Fixed spots:**
  - sign-in (`wave`), answer feedback (`thumbs-up` and `oops`), level complete (`clapping`), level up (`celebrate`);
  - checkpoints (`checkpoint`), mastery (`mastery`), Daily Complete (`go-outside`), loading (`waiting`), errors (`tangled`), empty states (`sleeping`).
- **Quiet in lessons, loud in progress:** inside a lesson he uses calm poses only (pointing, thinking, idea, explaining, magnifier, whisper, thumbs-up, oops), matching the design rule that learning mode stays quiet. The big poses (celebrate, clapping, mastery) belong on the progress screens.
- **Motion:** a small bounce when he appears, no more. He should never block the content or slow a lesson down.

## Name

**Dr. Scroll**, chosen by the owner. It echoes BrainScroll and the scroll he holds in `mascot.history`. In copy he's "Dr. Scroll", never shortened to "Scroll" on its own, so he isn't confused with scrolling the feed. Image IDs stay `mascot.*`.
