"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sets, sessions } from "@/lib/db/schema";

/** Clears every set back to un-logged and resets the session to pending. */
export async function resetSession(sessionId: string) {
  await db
    .update(sets)
    .set({ actualWeight: null, actualReps: null, completedAt: null })
    .where(eq(sets.sessionId, sessionId));

  await db
    .update(sessions)
    .set({ status: "pending", startedAt: null, completedAt: null })
    .where(eq(sessions.id, sessionId));
}
