# Handoff notes

Context for anyone (or any Claude Code session) picking this tool up. See README.md for how it works.

## Status

- Tool is complete and tested in mock mode (`npm run mock`). It has never been run against the real OpenAI API.
- Registry and asset folders are empty. Nothing real has been generated or approved.
- It was built in the Portfolio repo only as a staging spot. Its intended home is `tools/asset-factory/` in the BrainScroll repo. The folder is self-contained; copy it as is.

## Decisions already made

- Categories: object, animal, plant, food, nature, place, vehicle, science, technology, person, clothing, architecture, artifact, symbol, tool (rules in `CATEGORY_GUIDE`, `src/normalize.ts`).
- Buildings use `architecture` (e.g. `architecture.bank`); historical objects use `artifact` (e.g. `artifact.roman-helmet`); `place` is for location types that are not a single building. Owner still to confirm these boundaries.
- Image model is configurable through `OPENAI_IMAGE_MODEL` (and `OPENAI_IMAGE_PARAMS`); do not hardcode a model.
- Style spec `config/brainscroll-core-v1.txt`: STYLE CANDIDATES (outline, lighting, palette) are open for tuning; FIXED RULES are required and were verified against the owner's checklist.
- BrainScroll text never uses em dashes.

## Next steps, in order

1. Put `OPENAI_API_KEY` in `.env` (never commit it). Keep `CONCURRENCY=1`.
2. Run ONLY the 10-item style test (Style tab, "Save and Run Style Test"). Do not generate a large batch.
3. Review the ten together. Adjust STYLE CANDIDATES and rerun until all ten clearly belong to one visual system.
4. Only after the owner approves the style: start real batches.
