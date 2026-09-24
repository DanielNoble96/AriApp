import { describe, it, expect } from "vitest";
import { SWAP_POOLS, getSwapPool, getAdjacentSlug, SWAP_ONLY_PARENT_LIFT } from "../lib/lift-swaps";

describe("getAdjacentSlug", () => {
  const pool = ["a", "b", "c"];

  it("returns the next slug in the pool", () => {
    expect(getAdjacentSlug(pool, "a", "next")).toBe("b");
    expect(getAdjacentSlug(pool, "b", "next")).toBe("c");
  });

  it("wraps forward past the end back to index 0", () => {
    expect(getAdjacentSlug(pool, "c", "next")).toBe("a");
  });

  it("returns the previous slug in the pool", () => {
    expect(getAdjacentSlug(pool, "c", "prev")).toBe("b");
    expect(getAdjacentSlug(pool, "b", "prev")).toBe("a");
  });

  it("wraps backward past index 0 to the last element", () => {
    expect(getAdjacentSlug(pool, "a", "prev")).toBe("c");
  });

  it("falls back to the first pool entry when the current slug isn't in the pool", () => {
    expect(getAdjacentSlug(pool, "z", "next")).toBe("a");
    expect(getAdjacentSlug(pool, "z", "prev")).toBe("a");
  });

  it("throws for an empty pool", () => {
    expect(() => getAdjacentSlug([], "z", "next")).toThrow();
  });

  it("returns the same slug both directions for a single-element pool", () => {
    expect(getAdjacentSlug(["only"], "only", "next")).toBe("only");
    expect(getAdjacentSlug(["only"], "only", "prev")).toBe("only");
  });
});

describe("getSwapPool", () => {
  it("returns an empty array for an unknown day", () => {
    expect(getSwapPool(99, "main")).toEqual([]);
  });

  it("returns the configured singleton main pool for a known day", () => {
    expect(getSwapPool(1, "main")).toEqual(["squat"]);
    expect(getSwapPool(2, "main")).toEqual(["bench-press"]);
    expect(getSwapPool(3, "main")).toEqual(["overhead-press"]);
    expect(getSwapPool(4, "main")).toEqual(["deadlift"]);
  });

  it("returns each day's fixed cross-day assistance pool", () => {
    expect(getSwapPool(1, "assistance")).toEqual(["deadlift", "romanian-deadlift"]);
    expect(getSwapPool(2, "assistance")).toEqual(["overhead-press"]);
    expect(getSwapPool(3, "assistance")).toEqual(["bench-press"]);
    expect(getSwapPool(4, "assistance")).toEqual(["squat"]);
  });
});

describe("SWAP_POOLS data integrity", () => {
  it("every day's main pool is a singleton matching its one tracked lift", () => {
    expect(SWAP_POOLS[1].main).toEqual(["squat"]);
    expect(SWAP_POOLS[2].main).toEqual(["bench-press"]);
    expect(SWAP_POOLS[3].main).toEqual(["overhead-press"]);
    expect(SWAP_POOLS[4].main).toEqual(["deadlift"]);
  });

  it("every day's assistance lift is a different lift than its own main lift", () => {
    for (const day of [1, 2, 3, 4]) {
      expect(SWAP_POOLS[day].assistance[0]).not.toBe(SWAP_POOLS[day].main[0]);
    }
  });

  it("has no duplicate slugs within any pool", () => {
    for (const day of [1, 2, 3, 4]) {
      for (const slot of ["main", "assistance"] as const) {
        const pool = SWAP_POOLS[day][slot];
        expect(new Set(pool).size).toBe(pool.length);
      }
    }
  });
});

describe("SWAP_ONLY_PARENT_LIFT", () => {
  it("maps Romanian Deadlift to Deadlift", () => {
    expect(SWAP_ONLY_PARENT_LIFT["romanian-deadlift"]).toBe("deadlift");
    expect(Object.keys(SWAP_ONLY_PARENT_LIFT)).toHaveLength(1);
  });
});
