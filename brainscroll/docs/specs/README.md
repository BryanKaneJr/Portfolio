# BrainScroll product documentation

These Markdown files are intended to be the repo-friendly working documents for BrainScroll.

## Active documents

- `PRODUCT_ROADMAP.md`: product rules, curriculum architecture, monetization, launch plan.
- `BUILD_ORDER.md`: engineering sequence, schemas, dependencies, acceptance gates.
- `VISUAL_DIRECTION.md`: current visual identity and UI direction.
- `SOCIAL_REWARDS.md`: post-MVP rewards, profiles, friends, leaderboards, challenges, and related systems.
- `CURRENT_PRODUCT_DECISIONS.md`: the decision record for choices made after the DOCX specs were first authored. **Merged into the four active documents on 2026-09-23**; kept as a concise record. If it and an active document ever disagree, fix the disagreement rather than picking one silently.

## Archive

- `archive/VISUAL_DIRECTION_ORIGINAL.md`: the earlier "Neon Academia" visual draft. It is retained for history only and should not be used as an active implementation spec.

## Editing rule

For ongoing development, edit Markdown first. Treat Markdown as the working source of truth in version control. DOCX files can remain polished presentation/reference snapshots and can be regenerated from the current Markdown when needed.

## Sync status

**Consolidated.** The four active documents now include every later decision: the locked question counts (3 / 5 / 7 / 10), the correction flow, first-attempt XP bands, review corrections and +10 review XP, the mastery star, Weekly Knowledge Quests, the Chronicle and "Daily Knowledge Complete". Each file's front matter has a `merged_decisions` line. The verbatim conversions are preserved in git history (the commit that first added this folder).

## How this folder relates to the rest of the repo

- `docs/specs/*.md` (this folder): the full product specs, and the working source of truth for product intent. Edit these first.
- `docs/source/*.docx`: presentation/reference snapshots of the same specs. They match these files as of 2026-09-23; regenerate or update them from the Markdown when needed.
- `docs/product-rules.md`, `docs/content-guide.md`, `docs/build-order.md`, `docs/visual-direction.md`, `docs/social-expansion.md`: short engineering digests that map the specs onto the code (`packages/core/src/constants.ts`, SQL migrations). When a product rule changes, update the spec here and the matching digest and code together.
