/**
 * @cc/ai — server-only OpenAI orchestration for the citation-first rules
 * companion (blueprint §7). Nothing here may ever run in the browser.
 *
 * Responsibilities (implemented across Phase 4 — see docs/BACKLOG.md epic CC-AI):
 *  - Own the OpenAI Responses API client behind a testable interface.
 *  - Define narrowly scoped tools that query the app DB (search_cards, get_card,
 *    search_rules, get_rules, get_commander_policy, validate_deck, ...).
 *  - Assemble a compact, token-budgeted evidence package.
 *  - Enforce the structured response contract and validate EVERY citation
 *    server-side against active snapshots before returning to the client.
 *
 * This file exports the stable schema/contract so the API layer can compile.
 */
export * from "./response-contract.js";
