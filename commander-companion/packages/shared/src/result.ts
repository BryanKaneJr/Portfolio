/**
 * A tiny explicit Result type. Deterministic services return these instead of
 * throwing for expected/validation failures, so callers must handle both paths.
 */
export type Result<T, E = string> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Narrow a Result to its success value or throw. Use only at trust boundaries/tests. */
export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw new Error(`unwrap() on error result: ${String(r.error)}`);
}
