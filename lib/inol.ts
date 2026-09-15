/**
 * INOL (Intensity for Number of Lifts): INOL = (Sets x Reps) / (100 - %1RM).
 *
 * Computed here per individual completed set -- (1 x actualReps) / (100 - %)
 * -- and summed across a session, rather than per exercise. When every set
 * of a lift shares one %1RM, summing the per-set values is identical to the
 * standard per-exercise formula (e.g. 4 sets x 4 reps @ 85% = 4 x (4/15) =
 * 1.067, matching (4x4)/15 directly); this version also handles a lift
 * whose sets span different %1RM values, like our main-lift wave.
 *
 * %1RM here is % of training max, since that's the actual intensity value
 * driving every weight calculation in this app. Accessory sets have no %TM
 * at all and are excluded.
 */
export function calcSetInol(actualReps: number, intensityPercentage: number): number {
  if (intensityPercentage >= 100) return 0;
  return actualReps / (100 - intensityPercentage);
}

export interface InolSetInput {
  actualReps: number | null;
  intensityPercentage: string | null;
  completedAt: Date | null;
}

/** Sums calcSetInol across every completed set that has a known %1RM. */
export function calcTotalInol(sets: InolSetInput[]): number {
  return sets.reduce((total, set) => {
    if (set.completedAt == null || set.actualReps == null || set.intensityPercentage == null) {
      return total;
    }
    return total + calcSetInol(set.actualReps, Number(set.intensityPercentage));
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
