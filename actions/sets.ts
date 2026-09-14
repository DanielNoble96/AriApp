"use server";

import { eq, and, isNull } from "drizzle-orm";
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

  const [session] = await db.select().from(sessions).where(eq(sessions.id, set.sessionId));
  if (!session) throw new Error("Session not found");

  if (session.status === "pending") {
    await db
      .update(sessions)
      .set({ status: "in_progress", startedAt: session.startedAt ?? new Date() })
      .where(eq(sessions.id, session.id));
  }

  const [remaining] = await db
    .select({ id: sets.id })
    .from(sets)
    .where(and(eq(sets.sessionId, session.id), isNull(sets.completedAt)))
    .limit(1);

  if (!remaining) {
    await db
      .update(sessions)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(sessions.id, session.id));
  }

  return { setId: set.id };
}
