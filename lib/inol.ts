/**
 * INOL (Intensity for Number of Lifts): INOL = reps / (100 - %1RM), summed
 * over an exercise's sets (e.g. 5 sets x 3 reps @ 80% 1RM = 15/20 = 0.75).
 *
 * Computed per completed set and summed. Three things keep this honest to
 * the standard formula:
 *
 * - Intensity is % of 1RM, not % of training max. The training max is 90%
 *   of 1RM (see the About page), so a set's %TM is multiplied by 0.9 first
 *   -- an 85% TM set is really ~76.5% of 1RM. Using %TM directly was
 *   inflating every score.
 * - Only main work sets count (extras included). Warm-ups are far too
 *   light to be meaningful training stimulus, and assistance is a different
 *   lift whose 5x10 volume would swamp the main lift's score -- the
 *   0.4 / 1.0 tier thresholds are per-exercise numbers.
 * - Intensity follows what was actually lifted: prescribed at 100 lb
 *   (85% TM) and logged at 105 lb counts at 85% x 105/100. This scales the
 *   stored %TM by actual/target weight, so it needs no training max lookup
 *   and works the same for swapped lifts and extras.
 */
export const TRAINING_MAX_TO_1RM = 0.9;

export function calcSetInol(actualReps: number, intensityPercentage: number): number {
  if (intensityPercentage >= 100) return 0;
  return actualReps / (100 - intensityPercentage);
}

export interface InolSetInput {
  actualReps: number | null;
  intensityPercentage: string | null;
  completedAt: Date | null;
  targetWeight?: string | null;
  actualWeight?: string | null;
  /** When provided, only "main" sets count toward INOL. */
  setType?: string;
}

/**
 * The set's % of 1RM: stored %TM, adjusted for the weight actually lifted
 * vs prescribed (falls back to the stored %TM if either weight is
 * missing/blank), converted from %TM to %1RM.
 */
export function effectiveIntensity(set: InolSetInput): number | null {
  if (set.intensityPercentage == null) return null;
  const pct = Number(set.intensityPercentage);
  const target = set.targetWeight != null ? Number(set.targetWeight) : NaN;
  const actual = set.actualWeight != null ? Number(set.actualWeight) : NaN;
  const scaled = target > 0 && actual > 0 ? (pct * actual) / target : pct;
  return scaled * TRAINING_MAX_TO_1RM;
}

/** Sums calcSetInol across every completed set that has a known %1RM. */
export function calcTotalInol(sets: InolSetInput[]): number {
  return sets.reduce((total, set) => {
    if (set.setType !== undefined && set.setType !== "main") return total;
    if (set.completedAt == null || set.actualReps == null) return total;
    const intensity = effectiveIntensity(set);
    if (intensity == null) return total;
    // Lifting above the training max is plausible; cap just under 100 so
    // the set still counts instead of zeroing out.
    return total + calcSetInol(set.actualReps, Math.min(intensity, 99));
  }, 0);
}

export type InolTier = "low" | "optimal" | "heavy";

export function getInolTier(inol: number): InolTier {
  if (inol < 0.4) return "low";
  if (inol < 1.0) return "optimal";
  return "heavy";
}

export const INOL_TIER_LABEL: Record<InolTier, string> = {
  low: "She's Giving...Participation Award",
  optimal: "You Ate With That One",
  heavy: "Slayed Boots Down Diva",
};
