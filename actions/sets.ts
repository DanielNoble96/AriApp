"use server";

import { eq, and, asc, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sets, sessions } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

/**
 * Records actual weight/reps for a set and marks it complete. Also works to
 * *edit* an already-completed set (same unconditional update), since "check
 * off a set" and "correct a set you already checked off" are the same write.
 */
export async function completeSet(setId: string, actualWeight: number | null, actualReps: number) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  // Ownership check before touching anything -- a Server Action is a public
  // POST endpoint reachable by anyone, not just through this app's own UI.
  const [owned] = await db
    .select({ userId: sessions.userId })
    .from(sets)
    .innerJoin(sessions, eq(sets.sessionId, sessions.id))
    .where(eq(sets.id, setId));
  if (!owned) throw new Error("Set not found");
  if (owned.userId !== user.id) throw new Error("Forbidden");

  const [set] = await db
    .update(sets)
    .set({
      actualWeight: actualWeight != null ? String(actualWeight) : null,
      actualReps,
      completedAt: new Date(),
    })
    .where(eq(sets.id, setId))
    .returning();

  if (!set) throw new Error("Set not found");

  // Starting/pausing/completing the session are now exclusively explicit
  // actions (see actions/sessions.ts) -- checking off a set no longer
  // implicitly starts the timer.
  return { setId: set.id };
}

/**
 * Appends a bonus set to the end of a lift's Work Sets or Accessory group,
 * shifting every later set's orderIndex up by one to make room. Work Sets
 * extras copy the last set's weight/reps and are marked AMRAP (an extra
 * work set is for another all-out effort); Accessory extras are blank,
 * matching the existing freeform accessory rows.
 */
export async function addExtraSet(
  sessionId: string,
  liftId: string,
  setType: "main" | "accessory"
) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session) throw new Error("Session not found");
  if (session.userId !== user.id) throw new Error("Forbidden");

  const groupSets = await db
    .select()
    .from(sets)
    .where(and(eq(sets.sessionId, sessionId), eq(sets.liftId, liftId), eq(sets.setType, setType)))
    .orderBy(asc(sets.orderIndex));

  const lastOfGroup = groupSets[groupSets.length - 1];
  if (!lastOfGroup) throw new Error("No existing sets found for this lift");
  const insertionIndex = lastOfGroup.orderIndex + 1;

  await db
    .update(sets)
    .set({ orderIndex: sql`${sets.orderIndex} + 1` })
    .where(and(eq(sets.sessionId, sessionId), gte(sets.orderIndex, insertionIndex)));

  const [newSet] = await db
    .insert(sets)
    .values({
      sessionId,
      liftId,
      setType,
      orderIndex: insertionIndex,
      isAmrap: setType === "main",
      targetWeight: setType === "main" ? lastOfGroup.targetWeight : null,
      targetReps: setType === "main" ? lastOfGroup.targetReps : null,
    })
    .returning();

  return newSet;
}
