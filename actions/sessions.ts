"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sets, sessions, posts, postPrs } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getSetsForSession } from "@/lib/db/queries";
import { getPriorBestE1rmByLift } from "@/lib/db/social-queries";
import { calcTotalInol } from "@/lib/inol";
import { findPrs, type CurrentSetForPr } from "@/lib/prs";

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

  // A reset means "this workout didn't happen" -- any feed post (and its
  // comments, via cascade) it auto-created no longer reflects reality.
  await db.delete(posts).where(eq(posts.sessionId, sessionId));

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

/**
 * Manually marks a session complete, regardless of whether every set is
 * done, and auto-creates a feed post (INOL score + any PRs) exactly once
 * per session -- the existing-post check plus onConflictDoNothing below
 * both guard against a double-submit creating a duplicate.
 */
export async function completeSession(sessionId: string) {
  const session = await loadOwnedSession(sessionId);

  await db
    .update(sessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(sessions.id, sessionId));

  const [existingPost] = await db.select().from(posts).where(eq(posts.sessionId, sessionId));
  if (existingPost) return;

  const sessionSets = await getSetsForSession(sessionId);
  const inolScore = calcTotalInol(sessionSets);

  const mainSets: CurrentSetForPr[] = sessionSets
    .filter((s) => s.setType === "main" && s.liftRole === "main")
    .map((s) => ({
      liftId: s.liftId,
      liftName: s.liftName,
      actualWeight: s.actualWeight,
      actualReps: s.actualReps,
      completedAt: s.completedAt,
    }));

  const liftIds = [...new Set(mainSets.map((s) => s.liftId))];
  const priorBestByLift = await getPriorBestE1rmByLift(session.userId, liftIds, sessionId);
  const prs = findPrs(mainSets, priorBestByLift);

  const [post] = await db
    .insert(posts)
    .values({ userId: session.userId, sessionId, inolScore: String(inolScore) })
    .onConflictDoNothing({ target: posts.sessionId })
    .returning();

  if (post && prs.length > 0) {
    await db.insert(postPrs).values(
      prs.map((pr) => ({
        postId: post.id,
        liftName: pr.liftName,
        weight: String(pr.weight),
        reps: pr.reps,
        estimatedOneRepMax: String(pr.estimatedOneRepMax),
      }))
    );
  }
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

/**
 * Freezes the elapsed/rest timers by recording when the pause began.
 * Returns the resulting pausedAt/pausedSeconds so the caller can sync its
 * local state to what was actually saved, rather than guessing -- if this
 * is a no-op (already paused, or a stale client re-sending an old click),
 * the caller still gets back the true current values instead of drifting.
 */
export async function pauseSession(sessionId: string) {
  const session = await loadOwnedSession(sessionId);
  if (session.status !== "in_progress" || session.pausedAt != null) {
    return { pausedAt: session.pausedAt, pausedSeconds: session.pausedSeconds };
  }

  const [updated] = await db
    .update(sessions)
    .set({ pausedAt: new Date() })
    .where(eq(sessions.id, sessionId))
    .returning();
  return { pausedAt: updated.pausedAt, pausedSeconds: updated.pausedSeconds };
}

/**
 * Folds the just-finished pause into the accumulated total and unfreezes
 * the timers. Returns the resulting pausedAt/pausedSeconds for the same
 * reason as pauseSession -- the client syncs to this instead of computing
 * its own guess, so a stale/mismatched client state can't get stuck.
 */
export async function resumeSession(sessionId: string) {
  const session = await loadOwnedSession(sessionId);
  if (session.pausedAt == null) {
    return { pausedAt: null, pausedSeconds: session.pausedSeconds };
  }

  const pausedDurationSeconds = Math.max(
    0,
    Math.floor((Date.now() - session.pausedAt.getTime()) / 1000)
  );

  const [updated] = await db
    .update(sessions)
    .set({
      pausedAt: null,
      pausedSeconds: session.pausedSeconds + pausedDurationSeconds,
    })
    .where(eq(sessions.id, sessionId))
    .returning();
  return { pausedAt: updated.pausedAt, pausedSeconds: updated.pausedSeconds };
}
