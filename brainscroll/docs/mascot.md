# Mascot: Dr. Scroll

A small, round, cheerful old genius who shows up throughout BrainScroll: waving on the sign-in screen, pointing at the key idea on a card, cheering a level-up, shrugging kindly at a wrong answer. His name is **Dr. Scroll**.

## He is our own character, not Einstein

He's inspired by the "wild-haired genius professor" idea, but he must not be Albert Einstein or look like him. Einstein's name and likeness are licensed commercially, and a lookalike would also clash with our "no real people" image rule.

- Never put "Einstein" in a prompt, a file name or app copy.
- Avoid Einstein's signatures: the big droopy mustache, the tongue-out pose, the sweater-and-no-socks look, and chalkboard equations.
- His own signatures, below, should be what people recognize.

## Look (every image)

**The approved reference is [`mascot-reference.webp`](mascot-reference.webp)** (it becomes `mascot.reference`). When this text and the image disagree, the image wins. Every pose must match it:

- **Shape:** short and round, like a toy. His head is a bit under half his height. He has short arms and legs and simple mitten-like hands.
- **Hair:** a bald, smooth crown with two fluffy white clouds of hair at the sides, and thick white rounded eyebrows. He's clean-shaven, with no mustache or beard.
- **Face:** thin dark round glasses, small black oval eyes, a round nose, soft warm cheeks and a gentle closed smile.
- **Clothes:** a plain brown jacket with two buttons and faint elbow patches, matching brown trousers and shoes, a cream shirt and a **violet bow tie**, his signature. A yellow pencil is tucked into the hair above his right ear (his right, the viewer's left).
- **Style:** soft matte 3D clay, smooth and slightly velvety. It's softer than the glossy object icons, and that's fine for a character. Soft even light, with a gentle shadow under his feet.
- **Background:** transparent. The reference has a transparent background, so keep every pose transparent to sit on top of cards and screens.
- **Rules:** he's the only character in the image, with no text, letters or numbers anywhere, and no gold except in `mascot.mastery`.

## Personality (for copy written next to him)

- Delighted by facts: "Oh, this one's good."
- Warm and never condescending. He's excited to share, not showing off.
- Gentle with mistakes. He shrugs, smiles and moves on, and he never scolds.
- Short lines. He's a sidekick, not a lecturer. The cards carry the teaching.

## Making him consistent

A character only works if he looks like the same person in every image.

1. `mascot.reference` is done and approved: [`mascot-reference.webp`](mascot-reference.webp).
2. Make every pose **from that reference image**, using the image model's reference or edit input, not text alone. The prompt should say "the same character" and describe only the pose and prop.
3. Review the poses side by side. Reject any where the hair, glasses, bow tie or proportions drift.

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
| `mascot.chalkboard` | Holding chalk beside a small blank chalkboard | Lesson intros, recaps |
| `mascot.reading` | Reading an open book, delighted | Sources and "read more" |
| `mascot.magnifier` | Peering through a magnifying glass, one big eye | "Look closer" cards, fact-check and source notes |
| `mascot.surprised` | Eyebrows shot up, mouth in a round "oh!", glasses slipping | "Did you know?" surprising facts |
| `mascot.whisper` | Hand beside his mouth, leaning in | Fun facts and asides |
| `mascot.waiting` | Checking a pocket watch | Loading states |
| `mascot.tangled` | Tangled up in a loop of wire, smiling sheepishly | Errors and offline |

### Feedback

| Image ID | Pose | Used for |
| --- | --- | --- |
| `mascot.thumbs-up` | Big thumbs-up and a grin | Correct answer |
| `mascot.oops` | Gentle shrug with a kind smile | Wrong answer (never mocking) |
| `mascot.encourage` | Small fist pump, "you've got this" | Try again, review prompts |
| `mascot.clapping` | Clapping, eyes closed with joy | Finishing a level |
| `mascot.celebrate` | Both arms up, bouncing, with confetti | Level up |

### Progress and the day

| Image ID | Pose | Used for |
| --- | --- | --- |
| `mascot.checkpoint` | Holding a clipboard with a big check mark | Checkpoint levels |
| `mascot.review` | Shuffling a small stack of cards | Review tab |
| `mascot.mastery` | Holding up a gold star, beaming (the only gold) | Mastery Challenge, mastery moments |
| `mascot.go-outside` | Walking off with a walking stick toward a small tree, waving back | Daily Knowledge Complete ("go touch grass") |
| `mascot.sleeping` | Dozing in an armchair with a book on his belly | "Come back tomorrow", empty states |

### Subjects (one per subject, for tree headers and chapter intros)

| Image ID | Pose | Subject |
| --- | --- | --- |
| `mascot.history` | Unrolling a long scroll | History |
| `mascot.science` | Holding up a bubbling flask | Science |
| `mascot.geography` | Spinning a small globe on one finger | Geography |
| `mascot.money` | Balancing a coin on his fingertip | Money & Economics |
| `mascot.arts` | Holding a paintbrush and palette | Arts & Culture |
| `mascot.world-systems` | Holding a big wrench beside a gear | How the World Works |

That's 29 images. Start with the reference and about 5 core poses (wave, pointing, thinking, thumbs-up, oops). Check that he stays consistent, then do the rest.

## In the app (later)

Nothing shows him yet. Once the images exist:

- **Lessons:** an optional `mascot` field on a card (pose plus a one-line aside) lets the content writer drop him in where he helps. Most cards won't have him, so he stays special.
- **Fixed spots:**
  - sign-in (`wave`), answer feedback (`thumbs-up` and `oops`), level complete (`clapping`), level up (`celebrate`);
  - checkpoints (`checkpoint`), mastery (`mastery`), Daily Complete (`go-outside`), loading (`waiting`), errors (`tangled`), empty states (`sleeping`).
- **Quiet in lessons, loud in progress:** inside a lesson he uses calm poses only (pointing, thinking, idea, explaining, magnifier, whisper, thumbs-up, oops), matching the design rule that learning mode stays quiet. The big poses (celebrate, clapping, mastery) belong on the progress screens.
- **Motion:** a small bounce when he appears, no more. He should never block the content or slow a lesson down.

## Name

**Dr. Scroll**, chosen by the owner. It echoes BrainScroll and his scroll in `mascot.history`. In copy he's "Dr. Scroll", never shortened to "Scroll" on its own, so he isn't confused with scrolling the feed. Image IDs stay `mascot.*`.
