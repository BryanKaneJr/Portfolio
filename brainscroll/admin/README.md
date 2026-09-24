# Content Admin v1

An internal, local-only tool for the curriculum in `content/`. It isn't customer-facing and needs no credentials or database.

```bash
npm run admin          # from brainscroll/ → http://127.0.0.1:4321
ADMIN_PORT=5000 npm run admin
CONTENT_ROOT=/path/to/content npm run admin   # point it at another copy
```

## What it does

| Area | What you can do |
|---|---|
| **Curriculum** | Browse each skill by syllabus chapter. Each level shows its status and counts of errors and non-verification warnings. |
| **Edit** | Level metadata (title, objective, summary, status, revision, sources, prerequisites); level concepts (teach/reinforce/recall and weight); cards (text, fact, timeline, comparison, image, checkpoint; add, reorder, delete; mcq↔recall); questions (purpose, difficulty, prompt, options with correct answer and rationales, explanation, concepts, source cards). Every text field shows its character budget, read from `@brainscroll/core`. |
| **Preview** | A phone-width rendering in the app's colors. Tap options to walk the answer flow: a wrong answer shows its rationale and the "Take another look" source cards, and the answer is never revealed. |
| **JSON** | Edit the raw level for anything the form doesn't cover, then apply it. |
| **Issues** | Validation issues for this level, or all issues (with filters). **Run validation** re-runs the full validator. |
| **Concepts / Sources** | Read-only. Concepts show their claims, each claim's verification status per source, the cards stating it, and the levels using the concept. Sources show license, verified flag and claims verified. |

## Rules it enforces

- It runs the same `validateContent` as `npm run validate:content`, including the revision baseline from `app/src/content/bundle.json`.
- A save that fails the schema is refused, and so is a level number that doesn't match its file. Nothing is written.
- **Draft/published control:** a `draft` can be saved even with validation errors, so work in progress isn't lost. Saving as `in_review` or `published` is refused while the level has any errors of its own. Today that includes every unverified claim and source, so nothing can be published until verification is recorded (`npm run verify:record`).
- Writes are atomic (temp file + rename) and pretty-printed like the rest of `content/`.
- The server binds to 127.0.0.1, rejects other `Host` headers (DNS rebinding), and requires an `x-brainscroll-admin` header plus a JSON body on writes (cross-site requests).

After editing, run `npm run content:build` and `npm run check`, then commit the JSON as usual.

## Not in v1

- Editing concepts, claims or sources: use the JSON files and the `verify:*` scripts.
- Asset upload, and creating new levels or skills: copy a level file.
- Revision history: it's git.
- A content-report inbox: see `docs/analytics.md`.
- Auth or multi-user editing: it's a local tool. A hosted version would need Supabase auth with an admin role.
