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

  it("throws for a slug not present in the pool", () => {
    expect(() => getAdjacentSlug(pool, "z", "next")).toThrow();
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

  it("returns the configured pool for a known day/slot", () => {
    expect(getSwapPool(1, "assistance")).toEqual(["deadlift", "romanian-deadlift"]);
  });
});

describe("SWAP_POOLS data integrity", () => {
  const currentDefaults: Record<number, { main: string; assistance: string }> = {
    1: { main: "squat", assistance: "deadlift" },
    2: { main: "bench-press", assistance: "overhead-press" },
    3: { main: "hip-thrust", assistance: "single-leg-rdl" },
    4: { main: "bent-over-row", assistance: "lat-pulldown" },
  };

  for (const day of [1, 2, 3, 4]) {
    it(`day ${day}'s pools start with that day's current default lift`, () => {
      expect(SWAP_POOLS[day].main[0]).toBe(currentDefaults[day].main);
      expect(SWAP_POOLS[day].assistance[0]).toBe(currentDefaults[day].assistance);
    });

    it(`day ${day}'s pools have no duplicate slugs`, () => {
      for (const slot of ["main", "assistance"] as const) {
        const pool = SWAP_POOLS[day][slot];
        expect(new Set(pool).size).toBe(pool.length);
      }
    });
  }
});

describe("SWAP_ONLY_PARENT_LIFT", () => {
  const trackedDefaults = new Set([
    "squat",
    "deadlift",
    "bench-press",
    "overhead-press",
    "hip-thrust",
    "single-leg-rdl",
    "bent-over-row",
    "lat-pulldown",
  ]);

  it("maps every swap-only variation to a real tracked (non-swap-only) parent lift", () => {
    for (const [variant, parent] of Object.entries(SWAP_ONLY_PARENT_LIFT)) {
      expect(trackedDefaults.has(parent)).toBe(true);
      expect(variant).not.toBe(parent);
    }
  });

  it("maps deadlift variations and bench variations as requested", () => {
    expect(SWAP_ONLY_PARENT_LIFT["romanian-deadlift"]).toBe("deadlift");
    expect(SWAP_ONLY_PARENT_LIFT["close-grip-bench-press"]).toBe("bench-press");
    expect(SWAP_ONLY_PARENT_LIFT["incline-bench-press"]).toBe("bench-press");
    expect(SWAP_ONLY_PARENT_LIFT["db-bench-press"]).toBe("bench-press");
  });
});
