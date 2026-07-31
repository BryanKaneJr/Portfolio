/**
 * @cc/mtg — pure Magic domain primitives (colors, mana, type lines, name
 * normalization). No I/O, no network, no database. These are the building
 * blocks the deterministic deck validator and card services compose.
 */
export * from "./color-identity.js";
export * from "./normalize-name.js";
