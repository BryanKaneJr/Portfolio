/**
 * @cc/shared — cross-cutting types, constants, and helpers with no runtime
 * dependency on the database, OpenAI, or the web framework. Anything imported
 * here must be safe to use from every other package.
 */

export * from "./types.js";
export * from "./result.js";

/** Application-wide constants. */
export const SUPPORTED_FORMATS = ["commander"] as const;
export type Format = (typeof SUPPORTED_FORMATS)[number];

/** Standard Commander deck size, excluding the command zone. */
export const COMMANDER_DECK_SIZE = 100;
