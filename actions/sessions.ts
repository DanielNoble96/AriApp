"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sets, sessions } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

async function loadOwnedSession(sessionId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session) throw new Error("Session not found");
  if (session.userId !== user.id) throw new Error("Forbidden");

  return session;
}

/** Clears every set back to un-logged and resets the session to pending. */
export async function resetSession(sessionId: string) {
  await loadOwnedSession(sessionId);

  await db
    .update(sets)
    .set({ actualWeight: null, actualReps: null, completedAt: null })
    .where(eq(sets.sessionId, sessionId));

  await db
    .update(sessions)
    .set({
      status: "pending",
      startedAt: null,
      pausedAt: null,
      pausedSeconds: 0,
      completedAt: null,
    })
    .where(eq(sessions.id, sessionId));
}

/** Manually marks a session complete, regardless of whether every set is done. */
export async function completeSession(sessionId: string) {
  await loadOwnedSession(sessionId);

  await db
    .update(sessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

/** Explicitly starts the session's elapsed timer. Only meaningful from pending. */
export async function beginSession(sessionId: string) {
  const session = await loadOwnedSession(sessionId);
  if (session.status !== "pending") return;

  await db
    .update(sessions)
    .set({ status: "in_progress", startedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

/** Freezes the elapsed/rest timers by recording when the pause began. */
export async function pauseSession(sessionId: string) {
  const session = await loadOwnedSession(sessionId);
  if (session.status !== "in_progress" || session.pausedAt != null) return;

  await db.update(sessions).set({ pausedAt: new Date() }).where(eq(sessions.id, sessionId));
}

/** Folds the just-finished pause into the accumulated total and unfreezes the timers. */
export async function resumeSession(sessionId: string) {
  const session = await loadOwnedSession(sessionId);
  if (session.pausedAt == null) return;

  const pausedDurationSeconds = Math.max(
    0,
    Math.floor((Date.now() - session.pausedAt.getTime()) / 1000)
  );

  await db
    .update(sessions)
    .set({
      pausedAt: null,
      pausedSeconds: session.pausedSeconds + pausedDurationSeconds,
    })
    .where(eq(sessions.id, sessionId));
}
