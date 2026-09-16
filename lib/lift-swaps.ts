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
    main: ["hip-thrust", "overhead-press", "bench-press", "push-press", "bent-over-row", "lat-pulldown"],
    assistance: [
      "single-leg-rdl",
      "overhead-press",
      "bench-press",
      "push-press",
      "bent-over-row",
      "lat-pulldown",
    ],
  },
  4: {
    main: ["bent-over-row", "hip-thrust", "single-leg-rdl", "squat"],
    assistance: ["lat-pulldown", "hip-thrust", "single-leg-rdl", "squat"],
  },
};

export function getSwapPool(dayNumber: number, slot: SwapSlot): string[] {
  return SWAP_POOLS[dayNumber]?.[slot] ?? [];
}

/** Circular next/prev slug within a pool. Throws if currentSlug isn't in it. */
export function getAdjacentSlug(
  pool: string[],
  currentSlug: string,
  direction: "prev" | "next"
): string {
  const idx = pool.indexOf(currentSlug);
  if (idx === -1) throw new Error(`"${currentSlug}" is not in this pool`);
  const delta = direction === "next" ? 1 : -1;
  return pool[(idx + delta + pool.length) % pool.length];
}
