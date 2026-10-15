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
    // %TM x 0.9 = %1RM: 58.5 / 67.5 / 76.5
    const expected = 5 / (100 - 58.5) + 5 / (100 - 67.5) + 5 / (100 - 76.5);
    expect(total).toBeCloseTo(expected, 5);
  });

  it("raises intensity when more weight than prescribed was lifted", () => {
    const prescribed = calcTotalInol([
      { actualReps: 3, intensityPercentage: "85", targetWeight: "100", actualWeight: "100", completedAt: new Date() },
    ]);
    const heavier = calcTotalInol([
      { actualReps: 3, intensityPercentage: "85", targetWeight: "100", actualWeight: "105", completedAt: new Date() },
    ]);
    expect(prescribed).toBeCloseTo(3 / (100 - 76.5), 5);
    expect(heavier).toBeCloseTo(3 / (100 - 89.25 * 0.9), 5);
    expect(heavier).toBeGreaterThan(prescribed);
  });

  it("falls back to the stored percentage when a weight is blank", () => {
    const total = calcTotalInol([
      { actualReps: 3, intensityPercentage: "85", targetWeight: "100", actualWeight: null, completedAt: new Date() },
    ]);
    expect(total).toBeCloseTo(3 / (100 - 76.5), 5);
  });

  it("still counts a set lifted at or above 100% of the training max", () => {
    const total = calcTotalInol([
      { actualReps: 1, intensityPercentage: "95", targetWeight: "100", actualWeight: "110", completedAt: new Date() },
    ]);
    expect(total).toBeGreaterThan(0);
  });

  it("skips sets that aren't completed yet", () => {
    const total = calcTotalInol([
      { actualReps: 5, intensityPercentage: "65.00", completedAt: new Date() },
      { actualReps: null, intensityPercentage: "85.00", completedAt: null },
    ]);
    expect(total).toBeCloseTo(5 / (100 - 58.5), 5);
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

  it("matches the standard formula: 5 sets x 3 reps @ 80% 1RM = 0.75", () => {
    // 80% of 1RM is 88.89% of a training max that's 90% of 1RM
    const sets = Array.from({ length: 5 }, () => ({
      actualReps: 3,
      intensityPercentage: String(80 / 0.9),
      completedAt: new Date(),
    }));
    expect(calcTotalInol(sets)).toBeCloseTo(0.75, 5);
  });

  it("only counts main work sets when set types are provided", () => {
    const now = new Date();
    const total = calcTotalInol([
      { setType: "warmup", actualReps: 5, intensityPercentage: "50", completedAt: now },
      { setType: "main", actualReps: 5, intensityPercentage: "85", completedAt: now },
      { setType: "assistance", actualReps: 10, intensityPercentage: "50", completedAt: now },
    ]);
    expect(total).toBeCloseTo(5 / (100 - 76.5), 5);
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
