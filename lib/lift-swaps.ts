export type SwapSlot = "main" | "assistance";

/**
 * Per-day, per-slot candidate lift pools, keyed by lift slug. Index 0 of
 * every pool is that day's current default lift (what a brand-new cycle
 * actually generates), so cycling is a full loop that starts where the
 * cycle's default generation already put you -- swapping is opt-in, it
 * never changes what a new cycle defaults to. A pool of length 1 means
 * "not swappable" (session-client hides the arrows for it).
 */
export const SWAP_POOLS: Record<number, Record<SwapSlot, string[]>> = {
  1: {
    main: ["squat"],
    assistance: ["deadlift", "romanian-deadlift"],
  },
  2: {
    main: ["bench-press"],
    assistance: [
      "overhead-press",
      "bench-press",
      "close-grip-bench-press",
      "incline-bench-press",
      "db-bench-press",
    ],
  },
  3: {
    main: ["bent-over-row", "overhead-press", "bench-press", "push-press", "lat-pulldown"],
    assistance: ["lat-pulldown", "overhead-press", "bench-press", "push-press", "bent-over-row"],
  },
  4: {
    main: ["hip-thrust", "single-leg-rdl", "squat", "deadlift"],
    assistance: ["single-leg-rdl", "hip-thrust", "squat", "deadlift"],
  },
};

export function getSwapPool(dayNumber: number, slot: SwapSlot): string[] {
  return SWAP_POOLS[dayNumber]?.[slot] ?? [];
}

/**
 * Swap-only lifts that are just a variation on one of the 8 tracked
 * main/assistance lifts -- these reuse that lift's training max for the
 * current cycle instead of requiring their own history before they show a
 * real suggested weight.
 */
export const SWAP_ONLY_PARENT_LIFT: Record<string, string> = {
  "romanian-deadlift": "deadlift",
  "close-grip-bench-press": "bench-press",
  "incline-bench-press": "bench-press",
  "db-bench-press": "bench-press",
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
