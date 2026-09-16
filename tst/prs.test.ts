import { describe, it, expect } from "vitest";
import { calcEstimated1Rm, findPrs, type CurrentSetForPr } from "../lib/prs";

describe("calcEstimated1Rm", () => {
  it("applies the Epley formula", () => {
    // 200 x 5 -> 200 * (1 + 5/30) = 233.33
    expect(calcEstimated1Rm(200, 5)).toBeCloseTo(233.33, 1);
  });

  it("returns the weight itself for a 1-rep set", () => {
    expect(calcEstimated1Rm(315, 1)).toBeCloseTo(315 * (1 + 1 / 30), 5);
  });
});

describe("findPrs", () => {
  const squat = (overrides: Partial<CurrentSetForPr> = {}): CurrentSetForPr => ({
    liftId: "squat-id",
    liftName: "Squat",
    actualWeight: "225",
    actualReps: 5,
    completedAt: new Date(),
    ...overrides,
  });

  it("flags a PR when this session's best e1RM beats prior history", () => {
    const prior = new Map([["squat-id", 200]]); // e1RM of 200 x 5 = 233.33
    const result = findPrs([squat()], prior); // 225 x 5 -> e1RM 262.5
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ liftId: "squat-id", liftName: "Squat", weight: 225, reps: 5 });
  });

  it("does not flag a lift with no prior history as a PR", () => {
    const result = findPrs([squat()], new Map());
    expect(result).toHaveLength(0);
  });

  it("does not flag a tie as a PR", () => {
    const e1rm = calcEstimated1Rm(225, 5);
    const prior = new Map([["squat-id", e1rm]]);
    const result = findPrs([squat()], prior);
    expect(result).toHaveLength(0);
  });

  it("does not flag a session that falls short of prior history", () => {
    const prior = new Map([["squat-id", 999]]);
    const result = findPrs([squat()], prior);
    expect(result).toHaveLength(0);
  });

  it("picks the best set within the session before comparing to history", () => {
    const sets = [
      squat({ actualWeight: "200", actualReps: 5 }),
      squat({ actualWeight: "225", actualReps: 3 }),
    ];
    const prior = new Map([["squat-id", calcEstimated1Rm(200, 5)]]);
    const result = findPrs(sets, prior);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ weight: 225, reps: 3 });
  });

  it("skips sets that aren't completed or are missing weight/reps", () => {
    const sets = [
      squat({ completedAt: null }),
      squat({ actualWeight: null }),
      squat({ actualReps: null }),
    ];
    const result = findPrs(sets, new Map([["squat-id", 0]]));
    expect(result).toHaveLength(0);
  });

  it("evaluates multiple lifts independently", () => {
    const bench: CurrentSetForPr = {
      liftId: "bench-id",
      liftName: "Bench Press",
      actualWeight: "135",
      actualReps: 5,
      completedAt: new Date(),
    };
    const prior = new Map([
      ["squat-id", 999], // squat falls short
      ["bench-id", 100], // bench beats history
    ]);
    const result = findPrs([squat(), bench], prior);
    expect(result).toHaveLength(1);
    expect(result[0].liftId).toBe("bench-id");
  });
});
