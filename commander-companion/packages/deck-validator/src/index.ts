/**
 * @cc/deck-validator — the deterministic Commander rules engine (blueprint §8).
 *
 * ZERO dependency on OpenAI. Every check is pure and fully testable against
 * fixtures, producing source-backed findings with a {@link Severity}. The AI
 * layer may *explain* these findings but must never *compute* them.
 *
 * The concrete checks (deck/commander count, singleton, color identity,
 * legality, bans, brackets) are implemented in Phase 5 — see docs/BACKLOG.md
 * epic CC-DECK. This module currently defines the stable public contract so
 * dependents can compile against it.
 */
import type { Severity, Citation } from "@cc/shared";

/** A single deterministic finding produced by the validator. */
export interface ValidationFinding {
  readonly severity: Severity;
  readonly code: string; // stable machine code, e.g. "SINGLETON_VIOLATION"
  readonly message: string; // plain-English explanation
  readonly citations: readonly Citation[];
  /** Card names / rows this finding relates to, when applicable. */
  readonly subjects?: readonly string[];
}

/** Normalized input to the validator. Produced by the deck parser, not the LLM. */
export interface ValidatableDeck {
  readonly commanderOracleIds: readonly string[];
  readonly cards: readonly { oracleId: string; name: string; quantity: number }[];
}

export interface ValidationReport {
  readonly ok: boolean; // false if any finding has severity "error"
  readonly findings: readonly ValidationFinding[];
  /** Active source snapshot versions the checks ran against. */
  readonly sourceVersions: Readonly<Record<string, string>>;
}

/**
 * Run all deterministic Commander checks. Implementation lands in Phase 5.
 * @throws never — validation failures are returned as findings, not exceptions.
 */
export function validateCommanderDeck(_deck: ValidatableDeck): ValidationReport {
  // See docs/BACKLOG.md: CC-DECK-003..010. Intentionally unimplemented here.
  throw new Error("validateCommanderDeck is not implemented yet (Phase 5: CC-DECK).");
}
