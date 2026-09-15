"use server";

import { eq } from "drizzle-orm";
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
