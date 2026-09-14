import { DEFAULT_BAR_WEIGHT } from "./constants";

const DEFAULT_PLATE_SIZES = [45, 25, 10, 5, 2.5];

export interface PlateBreakdown {
  /** Plates for ONE side of the bar, largest first (e.g. [45, 10]). */
  perSide: number[];
  /** Total weight actually achieved -- equals the target when achievable. */
  weightOnBar: number;
  /** True if the target is lighter than an empty bar (nothing to load). */
  belowBarWeight: boolean;
}

/**
 * Greedily allocates plates for one side of the bar to hit `totalWeight`.
 * Our targets are always rounded to the nearest 5 lb (see weight-calc.ts),
 * and 2.5 lb plates make every multiple of 5 lb exactly achievable per side,
 * so this never needs to "settle" for an approximate result in practice.
 */
export function calcPlateBreakdown(
  totalWeight: number,
  barWeight: number = DEFAULT_BAR_WEIGHT,
  plateSizes: number[] = DEFAULT_PLATE_SIZES
): PlateBreakdown {
  if (totalWeight < barWeight) {
    return { perSide: [], weightOnBar: barWeight, belowBarWeight: true };
  }

  const perSideTarget = (totalWeight - barWeight) / 2;
  const perSide: number[] = [];
  let remaining = perSideTarget;

  for (const plate of plateSizes) {
    while (remaining + 1e-9 >= plate) {
      perSide.push(plate);
      remaining -= plate;
    }
  }

  const weightOnBar = barWeight + perSide.reduce((sum, p) => sum + p, 0) * 2;
  return { perSide, weightOnBar, belowBarWeight: false };
}

/** e.g. [45, 45, 10] -> "2x45 + 1x10". Empty array -> "Bar only". */
export function formatPlateBreakdown(perSide: number[]): string {
  if (perSide.length === 0) return "Bar only";

  const counts = new Map<number, number>();
  for (const plate of perSide) {
    counts.set(plate, (counts.get(plate) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([plate, count]) => `${count}x${plate}`)
    .join(" + ");
}
