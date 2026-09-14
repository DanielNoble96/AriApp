import { describe, it, expect } from "vitest";
import {
  roundToIncrement,
  calcTargetWeight,
  generateWarmupSets,
  generateMainSets,
  generateAssistanceSets,
  generateAccessoryPlaceholders,
  buildSessionSetPlan,
  type MainWaveConfig,
  type WaveWeek,
} from "../lib/weight-calc";

// Classic 5/3/1 wave, used across several tests as a realistic fixture.
const MAIN_WAVE: MainWaveConfig = {
  week1: [
    { percentage: 65, reps: 5 },
    { percentage: 75, reps: 5 },
    { percentage: 85, reps: 5, amrap: true },
  ],
  week2: [
    { percentage: 70, reps: 3 },
    { percentage: 80, reps: 3 },
    { percentage: 90, reps: 3, amrap: true },
  ],
  week3: [
    { percentage: 75, reps: 5 },
    { percentage: 85, reps: 3 },
    { percentage: 95, reps: 1, amrap: true },
  ],
};

const WARMUP: WaveWeek = [
  { percentage: 40, reps: 5 },
  { percentage: 50, reps: 5 },
  { percentage: 60, reps: 3 },
];

describe("roundToIncrement", () => {
  it("rounds down when under the midpoint", () => {
    expect(roundToIncrement(191.2)).toBe(190);
  });

  it("rounds up when at or over the midpoint", () => {
    expect(roundToIncrement(192.5)).toBe(195);
  });

  it("leaves an exact multiple unchanged", () => {
    expect(roundToIncrement(185)).toBe(185);
  });

  it("respects a custom increment", () => {
    expect(roundToIncrement(187, 10)).toBe(190);
  });
});

describe("calcTargetWeight", () => {
  it("computes 85% of a 225 lb TM rounded to nearest 5", () => {
    // 225 * 0.85 = 191.25 -> rounds to 190
    expect(calcTargetWeight(225, 85)).toBe(190);
  });

  it("computes 50% of a 135 lb TM", () => {
    // 135 * 0.5 = 67.5 -> rounds up to 70
    expect(calcTargetWeight(135, 50)).toBe(70);
  });

  it("handles 0% as 0", () => {
    expect(calcTargetWeight(225, 0)).toBe(0);
  });

  it("floors at minWeight for a light warmup on a low training max", () => {
    // 40% of 105 = 42 -> rounds to 40, but a barbell can't go below 45
    expect(calcTargetWeight(105, 40, 5, 45)).toBe(45);
  });

  it("leaves a weight above minWeight unaffected", () => {
    expect(calcTargetWeight(225, 85, 5, 45)).toBe(190);
  });
});

describe("generateWarmupSets", () => {
  it("produces one row per warmup step, never AMRAP", () => {
    const rows = generateWarmupSets(225, WARMUP);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.setType === "warmup")).toBe(true);
    expect(rows.every((r) => r.isAmrap === false)).toBe(true);
    expect(rows.map((r) => r.targetReps)).toEqual([5, 5, 3]);
    expect(rows.map((r) => r.orderIndex)).toEqual([0, 1, 2]);
  });

  it("calculates each warmup weight off the TM", () => {
    const rows = generateWarmupSets(200, WARMUP);
    // 40%, 50%, 60% of 200 = 80, 100, 120 -- all exact multiples of 5
    expect(rows.map((r) => r.targetWeight)).toEqual([80, 100, 120]);
  });

  it("floors light warmups at minWeight instead of going below an empty bar", () => {
    // 40% of 105 = 42 -> rounds to 40, which is below a 45 lb bar -> floored to 45
    const rows = generateWarmupSets(105, WARMUP, 5, 45);
    expect(rows[0].targetWeight).toBe(45);
    expect(rows.every((r) => r.targetWeight! >= 45)).toBe(true);
  });
});

describe("generateMainSets", () => {
  it("week 1: only the last set is AMRAP", () => {
    const rows = generateMainSets(225, MAIN_WAVE.week1);
    expect(rows.map((r) => r.isAmrap)).toEqual([false, false, true]);
    expect(rows.map((r) => r.targetReps)).toEqual([5, 5, 5]);
    // 65%, 75%, 85% of 225 = 146.25->145, 168.75->170, 191.25->190
    expect(rows.map((r) => r.targetWeight)).toEqual([145, 170, 190]);
  });

  it("week 2: lower reps, heavier weight than week 1", () => {
    const rows = generateMainSets(225, MAIN_WAVE.week2);
    expect(rows.map((r) => r.targetReps)).toEqual([3, 3, 3]);
    expect(rows[2].isAmrap).toBe(true);
  });

  it("week 3: heaviest AMRAP set targets a single rep", () => {
    const rows = generateMainSets(225, MAIN_WAVE.week3);
    expect(rows[2].targetReps).toBe(1);
    expect(rows[2].isAmrap).toBe(true);
    // 95% of 225 = 213.75 -> 215
    expect(rows[2].targetWeight).toBe(215);
  });
});

describe("generateAssistanceSets", () => {
  it("defaults to 5 sets of 10, flat weight, never AMRAP", () => {
    const rows = generateAssistanceSets(200, 50);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.targetReps === 10)).toBe(true);
    expect(rows.every((r) => r.targetWeight === 100)).toBe(true);
    expect(rows.every((r) => r.isAmrap === false)).toBe(true);
  });

  it("supports a per-lift custom percentage", () => {
    const rows = generateAssistanceSets(200, 60);
    expect(rows[0].targetWeight).toBe(120);
  });
});

describe("generateAccessoryPlaceholders", () => {
  it("produces blank rows with no calculated target", () => {
    const rows = generateAccessoryPlaceholders(3);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.targetWeight === null && r.targetReps === null)).toBe(true);
  });

  it("supports a custom count", () => {
    expect(generateAccessoryPlaceholders(5)).toHaveLength(5);
  });
});

describe("buildSessionSetPlan", () => {
  const assistancePercentages = { deadlift: 50 };

  it("orders warmup -> main -> assistance -> accessory across the whole day", () => {
    const plan = buildSessionSetPlan({
      dayLifts: [
        { liftId: "squat", role: "main", trainingMax: 225, equipmentType: "barbell" },
        { liftId: "deadlift", role: "assistance", trainingMax: 315, equipmentType: "barbell" },
        { liftId: "calf-raise", role: "accessory", trainingMax: null, equipmentType: null },
      ],
      weekNumber: 1,
      mainWaveConfig: MAIN_WAVE,
      warmupScheme: WARMUP,
      assistancePercentages,
    });

    // 3 warmup + 3 main for squat, 5 assistance for deadlift, 3 accessory placeholders
    expect(plan).toHaveLength(3 + 3 + 5 + 3);
    expect(plan.map((r) => r.orderIndex)).toEqual(plan.map((_, i) => i));
    expect(plan.slice(0, 6).every((r) => r.liftId === "squat")).toBe(true);
    expect(plan.slice(6, 11).every((r) => r.liftId === "deadlift" && r.setType === "assistance")).toBe(
      true
    );
    expect(plan.slice(11).every((r) => r.liftId === "calf-raise" && r.setType === "accessory")).toBe(
      true
    );
  });

  it("floors barbell warmups at 45 lb for a low training max", () => {
    const plan = buildSessionSetPlan({
      dayLifts: [{ liftId: "squat", role: "main", trainingMax: 105, equipmentType: "barbell" }],
      weekNumber: 1,
      mainWaveConfig: MAIN_WAVE,
      warmupScheme: WARMUP,
      assistancePercentages: {},
    });
    const warmups = plan.filter((r) => r.setType === "warmup");
    expect(warmups.every((r) => r.targetWeight! >= 45)).toBe(true);
  });

  it("does not floor a dumbbell lift's weight at the barbell minimum", () => {
    const plan = buildSessionSetPlan({
      dayLifts: [
        { liftId: "single-leg-rdl", role: "assistance", trainingMax: 40, equipmentType: "dumbbell" },
      ],
      weekNumber: 1,
      mainWaveConfig: MAIN_WAVE,
      warmupScheme: WARMUP,
      assistancePercentages: { "single-leg-rdl": 50 },
    });
    // 50% of 40 = 20, well below 45 -- fine for a dumbbell, no floor should apply
    expect(plan[0].targetWeight).toBe(20);
  });

  it("throws if a main lift is missing a training max", () => {
    expect(() =>
      buildSessionSetPlan({
        dayLifts: [{ liftId: "squat", role: "main", trainingMax: null, equipmentType: "barbell" }],
        weekNumber: 1,
        mainWaveConfig: MAIN_WAVE,
        warmupScheme: WARMUP,
        assistancePercentages: {},
      })
    ).toThrow(/missing a training max/);
  });

  it("throws if an assistance lift has no configured percentage", () => {
    expect(() =>
      buildSessionSetPlan({
        dayLifts: [
          { liftId: "deadlift", role: "assistance", trainingMax: 315, equipmentType: "barbell" },
        ],
        weekNumber: 1,
        mainWaveConfig: MAIN_WAVE,
        warmupScheme: WARMUP,
        assistancePercentages: {},
      })
    ).toThrow(/missing a configured percentage/);
  });
});
