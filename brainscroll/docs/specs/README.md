# BrainScroll product documentation

These Markdown files are intended to be the repo-friendly working documents for BrainScroll.

## Active documents

- `PRODUCT_ROADMAP.md` — product rules, curriculum architecture, monetization, launch plan.
- `BUILD_ORDER.md` — engineering sequence, schemas, dependencies, acceptance gates.
- `VISUAL_DIRECTION.md` — current visual identity and UI direction.
- `SOCIAL_REWARDS.md` — post-MVP rewards, profiles, friends, leaderboards, challenges, and related systems.
- `CURRENT_PRODUCT_DECISIONS.md` — decisions made after portions of the DOCX specs were authored; treat these as overrides until they are merged into the four active documents.

## Archive

- `archive/VISUAL_DIRECTION_ORIGINAL.md` — the earlier "Neon Academia" visual draft. It is retained for history only and should not be used as an active implementation spec.

## Editing rule

For ongoing development, edit Markdown first. Treat Markdown as the working source of truth in version control. DOCX files can remain polished presentation/reference snapshots and can be regenerated from the current Markdown when needed.

## Important sync note

The conversion files preserve the uploaded DOCX content rather than silently rewriting it. Some uploaded DOCX text predates later BrainScroll decisions made during development, especially the finalized question counts, correction flow, first-attempt XP bands, review correction rules, and mastery behavior. Those newer rules are captured in `CURRENT_PRODUCT_DECISIONS.md` and should be merged into the active specs before the Markdown set is considered fully consolidated.
