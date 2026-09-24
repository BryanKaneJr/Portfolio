# Mascot: the Professor

A small, round, cheerful old genius who shows up throughout BrainScroll: waving on the sign-in screen, pointing at the key idea on a card, cheering a level-up, shrugging kindly at a wrong answer. His name is still to be chosen (see the end); "the Professor" is a placeholder.

## He is our own character, not Einstein

He's inspired by the "wild-haired genius professor" idea, but he must not be Albert Einstein or look like him. Einstein's name and likeness are licensed commercially, and a lookalike would also clash with our "no real people" image rule.

- Never put "Einstein" in a prompt, a file name or app copy.
- Avoid Einstein's signatures: the big droopy mustache, the tongue-out pose, the sweater-and-no-socks look, and chalkboard equations.
- His own signatures, below, should be what people recognize.

## Look (every image)

- **Shape:** short and round, like a toy or a chibi figure. His head is about 40% of his height. He has a small round belly and short arms and legs.
- **Hair:** a fluffy white cloud of hair on the sides and back, a shiny bald crown, and bushy white eyebrows. He's clean-shaven or has only a tiny tidy white mustache, never a big droopy one.
- **Face:** big round glasses, twinkling kind eyes, rosy cheeks and a warm smile.
- **Clothes:** a brown tweed jacket with elbow patches, a cream shirt and a **violet bow tie** in `#7C5CFF`, the brand accent and his signature. A yellow pencil is tucked behind one ear.
- **Style:** the same glossy 3D "clay" look as every other BrainScroll image. Soft light from the top left and a gentle shadow.
- **Background:** transparent PNG if the image tool supports it, because he'll sit on top of cards and screens. Otherwise use plain Midnight Navy `#111827`.
- **Rules:** he's the only character in the image, with no text, letters or numbers anywhere, and no gold except in `mascot.mastery`.

## Personality (for copy written next to him)

- Delighted by facts: "Oh, this one's good."
- Warm and never condescending. He's excited to share, not showing off.
- Gentle with mistakes. He shrugs, smiles and moves on, and he never scolds.
- Short lines. He's a sidekick, not a lecturer. The cards carry the teaching.

## Making him consistent

A character only works if he looks like the same person in every image.

1. Generate `mascot.reference` first: a front view, standing, neutral and friendly. Iterate until it's right, then approve it.
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
- **Motion:** a small bounce when he appears, no more. He should never block the content or slow a lesson down.

## Name ideas (owner to choose)

Professor Quill, Professor Pip, Doc Wiggleby, Professor Noodle. The name should be original, easy to say, and not a real scientist's.
