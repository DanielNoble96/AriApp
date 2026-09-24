export type SwapSlot = "main" | "assistance";

/**
 * Per-day, per-slot candidate lift pools, keyed by lift slug. Index 0 of
 * every pool is that day's current default lift (what a brand-new cycle
 * actually generates), so cycling is a full loop that starts where the
 * cycle's default generation already put you -- swapping is opt-in, it
 * never changes what a new cycle defaults to. A pool of length 1 means
 * "not swappable" (session-client hides the arrows for it).
 */
// Classic 5/3/1: exactly one main lift per day, no assistance tier at all
// anymore -- every pool is a singleton, so no arrows ever render. Kept as a
// real (if trivial) lookup rather than removed outright, since old
// completed sessions may still render assistance-type rows historically.
export const SWAP_POOLS: Record<number, Record<SwapSlot, string[]>> = {
  1: { main: ["squat"], assistance: [] },
  2: { main: ["bench-press"], assistance: [] },
  3: { main: ["overhead-press"], assistance: [] },
  4: { main: ["deadlift"], assistance: [] },
};

export function getSwapPool(dayNumber: number, slot: SwapSlot): string[] {
  return SWAP_POOLS[dayNumber]?.[slot] ?? [];
}

/**
 * Swap-only lifts that are just a variation on one of the tracked main
 * lifts, reusing that lift's cycle training max. Empty now that there are
 * no swap-only variant lifts left.
 */
export const SWAP_ONLY_PARENT_LIFT: Record<string, string> = {};

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
