# admin/ (Stage 7, not started)

An internal content tool. It is **not** customer-facing. It will cover:

- a subject/skill tree manager with published-level counts
- level, concept, question and asset editors (with licence, attribution and alt text)
- a validation panel (reusing `@brainscroll/core` `validateContent`)
- a mobile preview that renders exactly like the app
- publish and revision history, and a content-report inbox

Build it only after the Golden 10 levels and the lesson player have proven the schema. Until then, author JSON in `content/` and run `npm run validate:content`.
