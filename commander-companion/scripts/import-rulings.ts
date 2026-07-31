/**
 * Official card rulings importer (blueprint §6.2 step 5).
 *
 * Contract (Phase 2 — docs/BACKLOG.md CC-CARD-004):
 *  - Fetch/update rulings per permitted API behavior and cache policy.
 *  - Associate each ruling with its Oracle ID and a source_document version.
 *  - Confirm best source (Scryfall vs Gatherer) and precedence in Phase 0 research.
 */
async function main(): Promise<void> {
  throw new Error("import-rulings is not implemented yet (Phase 2: CC-CARD-004).");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
