export type SwapSlot = "main" | "assistance";

/**
 * Per-day, per-slot candidate lift pools, keyed by lift slug. Index 0 of
 * every pool is that day's current default lift (what a brand-new cycle
 * actually generates), so cycling is a full loop that starts where the
 * cycle's default generation already put you -- swapping is opt-in, it
 * never changes what a new cycle defaults to. A pool of length 1 means
 * "not swappable" (session-client hides the arrows for it).
 */
// Classic 5/3/1, one main lift per day (singleton pools, no swap arrows on
// the main slot). Each day also has a fixed cross-day assistance lift --
// index 0 of the assistance pool is what createCycle actually generates
// (see actions/cycles.ts); Day 1's assistance additionally cycles to
// Romanian Deadlift.
export const SWAP_POOLS: Record<number, Record<SwapSlot, string[]>> = {
  1: { main: ["squat"], assistance: ["deadlift", "romanian-deadlift"] },
  2: { main: ["bench-press"], assistance: ["overhead-press"] },
  3: { main: ["overhead-press"], assistance: ["bench-press"] },
  4: { main: ["deadlift"], assistance: ["squat"] },
};

export function getSwapPool(dayNumber: number, slot: SwapSlot): string[] {
  return SWAP_POOLS[dayNumber]?.[slot] ?? [];
}

/**
 * Swap-only lifts that are just a variation on one of the tracked main
 * lifts, reusing that lift's cycle training max instead of requiring their
 * own logged history first.
 */
export const SWAP_ONLY_PARENT_LIFT: Record<string, string> = {
  "romanian-deadlift": "deadlift",
};

/**
 * Circular next/prev slug within a pool. If currentSlug isn't in the pool
 * (e.g. a session was generated before SWAP_POOLS changed and its current
 * lift is no longer listed for that day), falls back to the first pool
 * entry rather than throwing, so an old default can still be swapped away
 * from cleanly instead of the arrows erroring out.
 */
export function getAdjacentSlug(
  pool: string[],
  currentSlug: string,
  direction: "prev" | "next"
): string {
  if (pool.length === 0) throw new Error("Pool is empty");
  const idx = pool.indexOf(currentSlug);
  if (idx === -1) return pool[0];
  const delta = direction === "next" ? 1 : -1;
  return pool[(idx + delta + pool.length) % pool.length];
}
