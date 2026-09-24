/**
 * A personal record is a main lift's best estimated 1RM (Epley formula:
 * weight x (1 + reps/30)) in a session strictly beating that lift's best
 * estimated 1RM from every prior completed session. A lift with no prior
 * history never counts as a PR -- there's nothing yet to beat.
 */
export function calcEstimated1Rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/**
 * Minimum whole rep count at `weight` whose estimated 1RM would strictly
 * beat `priorBestE1rm` -- what an AMRAP set's live "PR:" hint shows, so a
 * lifter knows how many reps they need before racking the bar. Always at
 * least 1 (even a weight already above the prior best still needs a rep
 * logged to count).
 */
export function calcRepsNeededForPr(weight: number, priorBestE1rm: number): number {
  if (weight <= 0) return 1;
  const needed = Math.floor(30 * (priorBestE1rm / weight - 1)) + 1;
  return Math.max(1, needed);
}

export interface CurrentSetForPr {
  liftId: string;
  liftName: string;
  actualWeight: string | null;
  actualReps: number | null;
  completedAt: Date | null;
}

export interface PrResult {
  liftId: string;
  liftName: string;
  weight: number;
  reps: number;
  estimatedOneRepMax: number;
}

/**
 * Takes this session's completed main-lift sets and each lift's best prior
 * estimated 1RM (absent = no history yet), and returns one PrResult per
 * lift whose best set this session strictly beats its prior best.
 */
export function findPrs(
  currentSets: CurrentSetForPr[],
  priorBestE1rmByLift: Map<string, number>
): PrResult[] {
  const bestThisSessionByLift = new Map<string, PrResult>();

  for (const set of currentSets) {
    if (set.completedAt == null || set.actualWeight == null || set.actualReps == null) continue;
    const weight = Number(set.actualWeight);
    const reps = set.actualReps;
    const estimatedOneRepMax = calcEstimated1Rm(weight, reps);

    const best = bestThisSessionByLift.get(set.liftId);
    if (!best || estimatedOneRepMax > best.estimatedOneRepMax) {
      bestThisSessionByLift.set(set.liftId, {
        liftId: set.liftId,
        liftName: set.liftName,
        weight,
        reps,
        estimatedOneRepMax,
      });
    }
  }

  const results: PrResult[] = [];
  for (const [liftId, best] of bestThisSessionByLift) {
    const priorBest = priorBestE1rmByLift.get(liftId);
    if (priorBest == null) continue;
    if (best.estimatedOneRepMax > priorBest + 1e-9) {
      results.push(best);
    }
  }
  return results;
}
