# BrainScroll Asset Factory

A small local tool for building BrainScroll's reusable illustration library: paste concepts, generate them in one locked style, decide KEEP / TRY AGAIN / TRASH, and get a searchable, richly labeled registry.

The library holds simple visual nouns (telescope, crown, volcano, horse). Abstract ideas (democracy, inflation, gravity) are flagged instead of generated.

## Install and run

Requires Node.js 22.18 or newer (TypeScript runs natively, no build step, no runtime dependencies).

```bash
cd brainscroll-asset-factory
cp .env.example .env        # then set OPENAI_API_KEY=sk-...
npm start                   # http://localhost:4321
```

- `npm run mock` runs the whole workflow with placeholder images and no API calls.
- `npm install && npm run typecheck` type-checks the server (optional).

Optional `.env` settings: `OPENAI_IMAGE_MODEL` (default `gpt-image-1`), `OPENAI_IMAGE_QUALITY` (`medium`), `OPENAI_TEXT_MODEL` (default `gpt-4.1-mini`, used for concept checks and metadata; must support image input), `CONCURRENCY` (1 to 3, default 2), `PORT`.

## Where things live

| Path | Contents |
| --- | --- |
| `assets/generated/` | Every generation attempt (`object_telescope__<time>.png`). Previous attempts are kept. |
| `assets/approved/` | Canonical approved assets, named from the ID: `object.telescope` becomes `object_telescope.png`. |
| `assets/rejected/` | Rejected attempts, kept for reference only. Never searchable. |
| `data/asset-registry.json` | The registry: one entry per approved asset, with semantic and visual metadata. |
| `data/aliases.json` | Normalized phrase to asset ID lookup used for duplicate detection. |
| `data/queue.json` | Working state of the current batch (not committed). |
| `config/brainscroll-core-v1.txt` | The locked style specification. |
| `config/style-test.txt` | The style test concepts. |

The code is in `src/`. All image generation is in `src/image-provider.ts`, so the provider or model can be swapped in one place.

## Batches

1. **Batch** tab: paste one concept per line (up to about 100), optionally add a category such as `Astronomy`, and click **Check Concepts**. The category is tagging context only; a telescope in an Astronomy batch still becomes `object.telescope`.
2. Every line is processed before anything is generated (see duplicate detection below). Rows appear as `PROPOSED`, `EXISTING`, or `TOO ABSTRACT`. Label, ID, and subject can be edited inline.
3. **Generate Selected** generates the checked rows. **Generate Pending** generates every proposed or pending row, and resumes work interrupted by a restart. Generation runs 1 to 3 at a time with a `37 / 100 processed` counter. Failed rows can be retried.

`EXISTING` and `TOO ABSTRACT` rows have an **Override** button. When overriding an existing asset, change the ID if you want a separate asset; keeping the same ID replaces the existing one on approval.

## Duplicate detection

Lightweight and practical, no vector database:

1. Trim, lowercase, strip list bullets and articles, singularize the head noun (`Telescopes` becomes `telescope`).
2. Exact matches against `aliases.json`, registry canonical concepts, registry aliases, and ID names. These resolve to `EXISTING` with no model call.
3. Remaining concepts go to the text model together with the list of existing assets. It proposes the canonical concept, ID, label, and subject; spots aliases (`astronomical telescope` is `telescope`, but `Roman helmet` is not `helmet`); and flags abstract concepts.
4. Everything that resolves to the same ID, in the batch or already in the queue, merges into one row. The merged phrasings become aliases on approval.

Without an API key, step 3 falls back to simple rules.

## Review and approval

**Review** tab: a grid of image, label, ID, and status. Click **Approve**, **Regenerate**, or **Reject**, or hover a card and press `A`, `R`, or `X`. Click an image for details and earlier attempts. The **Checkerboard** toggle shows transparency; the default background is BrainScroll navy. Cards warn when an image has no real transparency (checked by decoding the PNG alpha channel). Backgrounds are never removed automatically.

Approving:

1. copies the image to `assets/approved/<id>.png`,
2. creates or updates the registry entry for that ID,
3. generates metadata in the background, and
4. adds its aliases to `aliases.json`.

Regenerating keeps the same concept, ID, and style and makes a fresh attempt. It never creates a new asset.

## Automatic metadata

After approval, the text model receives the approved image plus the concept, label, ID, and batch contexts. It describes what is actually visible, not just what was requested, and writes: `description`, `subcategory`, `tags`, `aliases`, `related_concepts`, `concepts_supported` (lesson topics that could use the image, intentionally broader than the object), `not_for` (only obvious traps, such as a radio telescope for a generic telescope), `visual_features`, `specificity` (`generic`, `specific`, or `named`), `orientation`, and `subject_count`. If the model thinks the image does not match the concept, a note is added.

Metadata never changes the image. Edit any field in the **Library** tab by clicking an asset, or click **Regenerate Metadata**. Changing the canonical ID renames the approved file and updates aliases.

## Search

The **Library** tab searches approved assets by label, concept, ID, tags, aliases, related concepts, and concepts supported. Plain text scoring, no embeddings.

## Editing the style and running the style test

The style spec controls HOW things look; each concept only says WHAT to depict. Every prompt is:

```
[brainscroll-core-v1]
<contents of config/brainscroll-core-v1.txt>

SUBJECT:
Optical telescope mounted on a tripod.

Depict one isolated telescope.
Transparent background. No environment or scenery. No text. ...
```

Edit the spec in the **Style** tab (or the file directly). Changes apply to the next generation, no restart needed.

To check consistency, click **Generate Style Test** (Batch tab) or **Save and Run Style Test** (Style tab). It generates the ten deliberately unrelated concepts from `config/style-test.txt` (telescope, Roman helmet, volcano, bank building, smartphone, microscope, globe, factory, tree, book) and opens the **Style test** filter. Adjust the spec and rerun until all ten look like one visual system, then run large batches. Each run replaces the previous unapproved style test rows.

For a new style version, copy the spec to `config/<name>.txt` and set `STYLE_VERSION=<name>`. Each registry entry records the `style_version` it was made with.

## Writing rule

BrainScroll text never uses em dashes. The tool strips them from generated metadata and manual edits, and the prompts tell the models not to use them.
