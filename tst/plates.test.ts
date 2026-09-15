import { describe, it, expect } from "vitest";
import { calcPlateBreakdown, calcPlateChange, formatPlateBreakdown } from "../lib/plates";

describe("calcPlateBreakdown", () => {
  it("returns an empty bar for exactly the bar weight", () => {
    const result = calcPlateBreakdown(45);
    expect(result).toEqual({ perSide: [], weightOnBar: 45, belowBarWeight: false });
  });

  it("flags a target lighter than an empty bar", () => {
    const result = calcPlateBreakdown(35);
    expect(result.belowBarWeight).toBe(true);
    expect(result.perSide).toEqual([]);
  });

  it("computes 225 lb as two 45s per side", () => {
    const result = calcPlateBreakdown(225);
    expect(result.perSide).toEqual([45, 45]);
    expect(result.weightOnBar).toBe(225);
  });

  it("computes 185 lb as a 45 and a 25 per side", () => {
    const result = calcPlateBreakdown(185);
    expect(result.perSide).toEqual([45, 25]);
    expect(result.weightOnBar).toBe(185);
  });

  it("computes 145 lb as a 45 and a 5 per side", () => {
    const result = calcPlateBreakdown(145);
    expect(result.perSide).toEqual([45, 5]);
    expect(result.weightOnBar).toBe(145);
  });

  it("uses a 2.5 plate for a half-plate-per-side target", () => {
    // 100 lb -> 27.5 lb/side -> 25 + 2.5
    const result = calcPlateBreakdown(100);
    expect(result.perSide).toEqual([25, 2.5]);
    expect(result.weightOnBar).toBe(100);
  });

  it("respects a custom bar weight and plate set", () => {
    const result = calcPlateBreakdown(95, 15, [45, 25, 10, 5]);
    // (95-15)/2 = 40/side -> 25 + 10 + 5
    expect(result.perSide).toEqual([25, 10, 5]);
    expect(result.weightOnBar).toBe(95);
  });
});

describe("calcPlateChange", () => {
  it("breaks down a positive delta with no bar weight involved", () => {
    // going from 80 to 90: delta 10, 5/side -> one 5 plate per side
    expect(calcPlateChange(10)).toEqual([5]);
  });

  it("treats a negative delta the same as its absolute value", () => {
    expect(calcPlateChange(-10)).toEqual([5]);
  });

  it("returns an empty array for zero change", () => {
    expect(calcPlateChange(0)).toEqual([]);
  });

  it("handles a larger delta needing multiple plates per side", () => {
    // delta 30 -> 15/side -> 10 + 5
    expect(calcPlateChange(30)).toEqual([10, 5]);
  });
});

describe("formatPlateBreakdown", () => {
  it("shows 'Bar only' for no plates", () => {
    expect(formatPlateBreakdown([])).toBe("Bar only");
  });

  it("groups repeated plates with a count", () => {
    expect(formatPlateBreakdown([45, 45])).toBe("2x45");
  });

  it("lists distinct plates largest first", () => {
    expect(formatPlateBreakdown([45, 5])).toBe("1x45 + 1x5");
  });

  it("handles a mix of repeated and distinct plates", () => {
    expect(formatPlateBreakdown([45, 45, 10, 2.5])).toBe("2x45 + 1x10 + 1x2.5");
  });
});
