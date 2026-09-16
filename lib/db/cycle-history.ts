import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "./index";
import { cycles, sessions, sets, posts, postPrs, accessoryDayEntries, cycleLiftTms, lifts } from "./schema";
import { calcTotalInol } from "@/lib/inol";

export interface CycleHistoryEntry {
  id: string;
  cycleNumber: number;
  startedAt: Date;
  completedAt: Date | null;
  sessionsCompleted: number;
  sessionsTotal: number;
  totalInol: number;
  prCount: number;
  accessoryDayCount: number;
  startingTms: { liftName: string; startingTm: string }[];
}

/**
 * Stats for every completed cycle, newest first. Bulk-fetches (rather than
 * per-cycle queries) and groups in TS, matching social-queries.ts's style --
 * PR counts need an extra hop since post_prs has no cycleId of its own:
 * sessions -> posts -> post_prs.
 */
export async function getCycleHistoryForUser(userId: string): Promise<CycleHistoryEntry[]> {
  const completedCycles = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.userId, userId), eq(cycles.status, "completed")))
    .orderBy(desc(cycles.cycleNumber));

  if (completedCycles.length === 0) return [];

  const cycleIds = completedCycles.map((c) => c.id);

  const cycleSessions = await db
    .select({ id: sessions.id, cycleId: sessions.cycleId, status: sessions.status })
    .from(sessions)
    .where(inArray(sessions.cycleId, cycleIds));

  const sessionIds = cycleSessions.map((s) => s.id);
  const cycleIdBySessionId = new Map(cycleSessions.map((s) => [s.id, s.cycleId]));

  const sessionCountsByCycle = new Map<string, { total: number; completed: number }>();
  for (const s of cycleSessions) {
    const counts = sessionCountsByCycle.get(s.cycleId) ?? { total: 0, completed: 0 };
    counts.total++;
    if (s.status === "completed") counts.completed++;
    sessionCountsByCycle.set(s.cycleId, counts);
  }

  const cycleSets =
    sessionIds.length === 0
      ? []
      : await db
          .select({
            sessionId: sets.sessionId,
            actualReps: sets.actualReps,
            intensityPercentage: sets.intensityPercentage,
            completedAt: sets.completedAt,
          })
          .from(sets)
          .where(inArray(sets.sessionId, sessionIds));

  const setsByCycle = new Map<string, typeof cycleSets>();
  for (const set of cycleSets) {
    const cycleId = cycleIdBySessionId.get(set.sessionId);
    if (!cycleId) continue;
    const arr = setsByCycle.get(cycleId) ?? [];
    arr.push(set);
    setsByCycle.set(cycleId, arr);
  }

  // PRs have no direct cycleId -- chain through posts (session-kind only).
  const cyclePosts =
    sessionIds.length === 0
      ? []
      : await db
          .select({ id: posts.id, sessionId: posts.sessionId })
          .from(posts)
          .where(inArray(posts.sessionId, sessionIds));

  const postIds = cyclePosts.map((p) => p.id);
  const cycleIdByPostId = new Map(
    cyclePosts
      .filter((p) => p.sessionId != null)
      .map((p) => [p.id, cycleIdBySessionId.get(p.sessionId!)])
  );

  const cyclePrs =
    postIds.length === 0
      ? []
      : await db.select({ postId: postPrs.postId }).from(postPrs).where(inArray(postPrs.postId, postIds));

  const prCountByCycle = new Map<string, number>();
  for (const pr of cyclePrs) {
    const cycleId = cycleIdByPostId.get(pr.postId);
    if (!cycleId) continue;
    prCountByCycle.set(cycleId, (prCountByCycle.get(cycleId) ?? 0) + 1);
  }

  const cycleAccessoryDays = await db
    .select({ id: accessoryDayEntries.id, cycleId: accessoryDayEntries.cycleId })
    .from(accessoryDayEntries)
    .where(inArray(accessoryDayEntries.cycleId, cycleIds));

  const accessoryCountByCycle = new Map<string, number>();
  for (const a of cycleAccessoryDays) {
    accessoryCountByCycle.set(a.cycleId, (accessoryCountByCycle.get(a.cycleId) ?? 0) + 1);
  }

  const cycleTms = await db
    .select({ cycleId: cycleLiftTms.cycleId, startingTm: cycleLiftTms.startingTm, liftName: lifts.name })
    .from(cycleLiftTms)
    .innerJoin(lifts, eq(cycleLiftTms.liftId, lifts.id))
    .where(inArray(cycleLiftTms.cycleId, cycleIds));

  const tmsByCycle = new Map<string, { liftName: string; startingTm: string }[]>();
  for (const tm of cycleTms) {
    const arr = tmsByCycle.get(tm.cycleId) ?? [];
    arr.push({ liftName: tm.liftName, startingTm: tm.startingTm });
    tmsByCycle.set(tm.cycleId, arr);
  }

  return completedCycles.map((cycle) => {
    const counts = sessionCountsByCycle.get(cycle.id) ?? { total: 0, completed: 0 };
    return {
      id: cycle.id,
      cycleNumber: cycle.cycleNumber,
      startedAt: cycle.startedAt,
      completedAt: cycle.completedAt,
      sessionsCompleted: counts.completed,
      sessionsTotal: counts.total,
      totalInol: calcTotalInol(setsByCycle.get(cycle.id) ?? []),
      prCount: prCountByCycle.get(cycle.id) ?? 0,
      accessoryDayCount: accessoryCountByCycle.get(cycle.id) ?? 0,
      startingTms: tmsByCycle.get(cycle.id) ?? [],
    };
  });
}
