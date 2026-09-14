"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sets, sessions } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

/** Clears every set back to un-logged and resets the session to pending. */
export async function resetSession(sessionId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session) throw new Error("Session not found");
  if (session.userId !== user.id) throw new Error("Forbidden");

  await db
    .update(sets)
    .set({ actualWeight: null, actualReps: null, completedAt: null })
    .where(eq(sets.sessionId, sessionId));

  await db
    .update(sessions)
    .set({ status: "pending", startedAt: null, completedAt: null })
    .where(eq(sessions.id, sessionId));
}

/** Manually marks a session complete, regardless of whether every set is done. */
export async function completeSession(sessionId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session) throw new Error("Session not found");
  if (session.userId !== user.id) throw new Error("Forbidden");

  await db
    .update(sessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}
