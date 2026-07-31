/**
 * Scryfall Oracle/printing bulk importer (blueprint §6.2).
 *
 * Contract (implemented in Phase 2 — docs/BACKLOG.md CC-CARD-001):
 *  1. Fetch current bulk metadata; download the appropriate dataset.
 *  2. Verify content-type, size, and checksum before processing.
 *  3. Load into a STAGING schema — never overwrite the active dataset directly.
 *  4. Normalize layouts, faces, legalities, keywords, identifiers, images.
 *  5. Run integrity checks; produce a change report.
 *  6. Atomically promote and record the active version; invalidate affected caches.
 *
 * Idempotent. Must send a descriptive User-Agent (SCRYFALL_USER_AGENT) and honor
 * Scryfall rate limits / caching guidance (validate exact terms in Phase 0).
 */
async function main(): Promise<void> {
  throw new Error("import-scryfall is not implemented yet (Phase 2: CC-CARD-001).");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
