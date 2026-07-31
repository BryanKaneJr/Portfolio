/**
 * Shared domain-agnostic types. Card/rule/deck-specific types live in their
 * owning packages (@cc/mtg, @cc/deck-validator) to keep this layer thin.
 */

/** Severity levels for deterministic validation output (blueprint §8.3). */
export type Severity = "error" | "warning" | "information" | "unresolved";

/** A source-backed citation attached to an answer or validation finding. */
export interface Citation {
  readonly kind: "rule" | "card" | "ruling" | "policy";
  /** Rule number, Oracle ID, or policy key depending on `kind`. */
  readonly ref: string;
  /** Human-readable claim this citation supports. */
  readonly claim?: string;
  /** Active source snapshot version this citation was validated against. */
  readonly sourceVersion?: string;
}

/** ISO-8601 timestamp string. */
export type Iso8601 = string;
