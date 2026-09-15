import { describe, it, expect } from "vitest";
import { calcSetInol, calcTotalInol, getInolTier, INOL_TIER_LABEL } from "../lib/inol";

describe("calcSetInol", () => {
  it("matches the standard per-exercise formula when summed across equal sets", () => {
    // 4 sets x 4 reps @ 85% -> (4x4)/15 = 1.0667, or 4 x (4/15) summed the same way
    const perSet = calcSetInol(4, 85);
    expect(perSet * 4).toBeCloseTo(1.0667, 3);
  });

  it("computes a single set's contribution", () => {
    // 5 reps @ 65% -> 5/35
    expect(calcSetInol(5, 65)).toBeCloseTo(5 / 35, 5);
  });

  it("returns 0 for a nonsensical >=100% intensity rather than dividing by zero/negative", () => {
    expect(calcSetInol(5, 100)).toBe(0);
    expect(calcSetInol(5, 110)).toBe(0);
  });
});

describe("calcTotalInol", () => {
  it("sums only completed sets with a known intensity", () => {
    const total = calcTotalInol([
      { actualReps: 5, intensityPercentage: "65.00", completedAt: new Date() },
      { actualReps: 5, intensityPercentage: "75.00", completedAt: new Date() },
      { actualReps: 5, intensityPercentage: "85.00", completedAt: new Date() },
    ]);
    const expected = 5 / 35 + 5 / 25 + 5 / 15;
    expect(total).toBeCloseTo(expected, 5);
  });

  it("skips sets that aren't completed yet", () => {
    const total = calcTotalInol([
      { actualReps: 5, intensityPercentage: "65.00", completedAt: new Date() },
      { actualReps: null, intensityPercentage: "85.00", completedAt: null },
    ]);
    expect(total).toBeCloseTo(5 / 35, 5);
  });

  it("skips accessory sets with no intensity percentage", () => {
    const total = calcTotalInol([
      { actualReps: 12, intensityPercentage: null, completedAt: new Date() },
    ]);
    expect(total).toBe(0);
  });

  it("returns 0 for an empty session", () => {
    expect(calcTotalInol([])).toBe(0);
  });

  it("matches the worked example: 4 sets x 4 reps @ 85% = 1.06", () => {
    const total = calcTotalInol([
      { actualReps: 4, intensityPercentage: "85", completedAt: new Date() },
      { actualReps: 4, intensityPercentage: "85", completedAt: new Date() },
      { actualReps: 4, intensityPercentage: "85", completedAt: new Date() },
      { actualReps: 4, intensityPercentage: "85", completedAt: new Date() },
    ]);
    expect(total).toBeCloseTo(1.0667, 3);
  });
});

describe("getInolTier", () => {
  it("classifies below 0.4 as low", () => {
    expect(getInolTier(0)).toBe("low");
    expect(getInolTier(0.39)).toBe("low");
  });

  it("classifies 0.4 up to (not including) 1.0 as optimal", () => {
    expect(getInolTier(0.4)).toBe("optimal");
    expect(getInolTier(0.99)).toBe("optimal");
  });

  it("classifies 1.0 and above as heavy", () => {
    expect(getInolTier(1.0)).toBe("heavy");
    expect(getInolTier(2.5)).toBe("heavy");
  });
});

describe("INOL_TIER_LABEL", () => {
  it("has a label for every tier", () => {
    expect(INOL_TIER_LABEL.low).toBeTruthy();
    expect(INOL_TIER_LABEL.optimal).toBeTruthy();
    expect(INOL_TIER_LABEL.heavy).toBeTruthy();
  });
});
