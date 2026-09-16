"use server";

import { eq, and, inArray, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { sets, sessions, lifts } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getPriorBestE1rmByLift } from "@/lib/db/social-queries";
import { getSwapPool, getAdjacentSlug, type SwapSlot } from "@/lib/lift-swaps";
import { calcTargetWeight } from "@/lib/weight-calc";
import { ROUND_INCREMENT, DEFAULT_BAR_WEIGHT } from "@/lib/constants";

const SET_TYPES_FOR_SLOT: Record<SwapSlot, ("warmup" | "main" | "assistance")[]> = {
  main: ["warmup", "main"],
  assistance: ["assistance"],
};

/**
 * Swaps every set in a session's warm-up+work-set slot ("main") or
 * assistance slot to the next/previous lift in that day's swap pool (see
 * lib/lift-swaps.ts), recomputing each row's targetWeight from the new
 * lift's own lifetime best estimated 1RM (90% of it, matching the "Finding
 * Your Training Max" convention on the About page) -- reps/intensity% stay
 * whatever the week's scheme already prescribed, only the lift and its
 * weight change. Refuses once any set in the slot is already logged, so a
 * swap never silently reattributes a completed set's actual weight/reps to
 * a different lift.
 */
export async function swapGroupLift(
  sessionId: string,
  slot: SwapSlot,
  direction: "prev" | "next"
) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session) throw new Error("Session not found");
  if (session.userId !== user.id) throw new Error("Forbidden");
  if (session.status === "completed") throw new Error("Session already completed.");

  const setTypes = SET_TYPES_FOR_SLOT[slot];
  const groupSets = await db
    .select()
    .from(sets)
    .where(and(eq(sets.sessionId, sessionId), inArray(sets.setType, setTypes)))
    .orderBy(asc(sets.orderIndex));
  if (groupSets.length === 0) throw new Error("No sets found for this group.");
  if (groupSets.some((s) => s.completedAt != null)) {
    throw new Error("Can't change lifts after logging a set in this group.");
  }

  const currentLiftId = groupSets[0].liftId;
  const [currentLift] = await db.select().from(lifts).where(eq(lifts.id, currentLiftId));
  if (!currentLift) throw new Error("Lift not found.");

  const pool = getSwapPool(session.dayNumber, slot);
  if (pool.length <= 1) throw new Error("No alternative lifts for this group.");

  const nextSlug = getAdjacentSlug(pool, currentLift.slug, direction);
  const [nextLift] = await db
    .select()
    .from(lifts)
    .where(and(eq(lifts.userId, user.id), eq(lifts.slug, nextSlug)));
  if (!nextLift) throw new Error(`Lift "${nextSlug}" isn't set up for this account yet.`);

  // Lifetime best e1RM for the NEW lift -- "reflective of the PRs they've
  // already put in" for whichever lift is being switched to, not a reused
  // number from the lift it's replacing.
  const priorBest = await getPriorBestE1rmByLift(user.id, [nextLift.id], sessionId);
  const e1rm = priorBest.get(nextLift.id) ?? null;
  const newTrainingMax = e1rm != null ? e1rm * 0.9 : null;
  const minWeight = nextLift.equipmentType === "barbell" ? DEFAULT_BAR_WEIGHT : 0;

  const updated = [];
  for (const row of groupSets) {
    const targetWeight =
      newTrainingMax != null && row.intensityPercentage != null
        ? calcTargetWeight(newTrainingMax, Number(row.intensityPercentage), ROUND_INCREMENT, minWeight)
        : null;
    const [saved] = await db
      .update(sets)
      .set({ liftId: nextLift.id, targetWeight: targetWeight != null ? String(targetWeight) : null })
      .where(eq(sets.id, row.id))
      .returning();
    updated.push({
      id: saved.id,
      liftId: nextLift.id,
      liftName: nextLift.name,
      liftRole: nextLift.role,
      equipmentType: nextLift.equipmentType,
      targetWeight: saved.targetWeight,
      targetReps: saved.targetReps,
      intensityPercentage: saved.intensityPercentage,
    });
  }

  return { updatedSets: updated };
}
