import { describe, it, expect } from "vitest";
import { normalizeColors, isWithinColorIdentity } from "./color-identity.js";

describe("normalizeColors", () => {
  it("orders colors in WUBRG and de-duplicates (positive)", () => {
    expect(normalizeColors(["G", "U", "u", "G"])).toEqual(["U", "G"]);
  });

  it("returns empty for colorless (boundary)", () => {
    expect(normalizeColors([])).toEqual([]);
  });

  it("rejects invalid symbols (negative)", () => {
    expect(() => normalizeColors(["X"])).toThrow(/Invalid color symbol/);
  });
});

describe("isWithinColorIdentity", () => {
  it("accepts a card inside the commander identity (positive)", () => {
    expect(isWithinColorIdentity(["U"], ["W", "U", "B"])).toBe(true);
  });

  it("rejects a card with an off-identity color (negative)", () => {
    expect(isWithinColorIdentity(["R"], ["W", "U"])).toBe(false);
  });

  it("treats a colorless card as always within identity (boundary)", () => {
    expect(isWithinColorIdentity([], [])).toBe(true);
  });
});
