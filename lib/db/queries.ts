import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "./index";
import { lifts, programDays, cycles, sessions, sets, accessoryDayEntries } from "./schema";

export async function getLiftsForUser(userId: string) {
  return db
    .select({
      id: lifts.id,
      slug: lifts.slug,
      name: lifts.name,
      role: lifts.role,
      bodyRegion: lifts.bodyRegion,
      equipmentType: lifts.equipmentType,
      orderInDay: lifts.orderInDay,
      currentTrainingMax: lifts.currentTrainingMax,
      dayNumber: programDays.dayNumber,
      dayName: programDays.name,
    })
    .from(lifts)
    .innerJoin(programDays, eq(lifts.programDayId, programDays.id))
    .where(eq(lifts.userId, userId))
    .orderBy(asc(programDays.dayNumber), asc(lifts.orderInDay));
}

export async function getActiveCycle(userId: string) {
  // Ordering is defense-in-depth: createCycle always completes any prior
  // active cycle before starting a new one, so there should only ever be
  // one, but this guarantees the newest wins if that invariant is ever
  // violated rather than an arbitrary row.
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.userId, userId), eq(cycles.status, "active")))
    .orderBy(desc(cycles.cycleNumber))
    .limit(1);
  return cycle ?? null;
}

export async function getSessionsForCycle(cycleId: string) {
  return db
    .select()
    .from(sessions)
    .where(eq(sessions.cycleId, cycleId))
    .orderBy(asc(sessions.sequenceIndex));
}

export async function getAccessoryDaysForCycle(cycleId: string) {
  return db
    .select()
    .from(accessoryDayEntries)
    .where(eq(accessoryDayEntries.cycleId, cycleId))
    .orderBy(asc(accessoryDayEntries.createdAt));
}

export async function getSessionById(sessionId: string) {
  const [row] = await db
    .select({
      id: sessions.id,
      cycleId: sessions.cycleId,
      userId: sessions.userId,
      dayNumber: sessions.dayNumber,
      weekNumber: sessions.weekNumber,
      sequenceIndex: sessions.sequenceIndex,
      status: sessions.status,
      startedAt: sessions.startedAt,
      pausedAt: sessions.pausedAt,
      pausedSeconds: sessions.pausedSeconds,
      completedAt: sessions.completedAt,
      dayName: programDays.name,
      restTargetWarmupSeconds: cycles.restTargetWarmupSeconds,
      restTargetWorkSeconds: cycles.restTargetWorkSeconds,
    })
    .from(sessions)
    .innerJoin(
      programDays,
      and(eq(programDays.userId, sessions.userId), eq(programDays.dayNumber, sessions.dayNumber))
    )
    .innerJoin(cycles, eq(cycles.id, sessions.cycleId))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  return row ?? null;
}

export async function getSetsForSession(sessionId: string) {
  return db
    .select({
      id: sets.id,
      liftId: sets.liftId,
      liftName: lifts.name,
      liftRole: lifts.role,
      equipmentType: lifts.equipmentType,
      setType: sets.setType,
      orderIndex: sets.orderIndex,
      isAmrap: sets.isAmrap,
      isExtra: sets.isExtra,
      targetWeight: sets.targetWeight,
      targetReps: sets.targetReps,
      intensityPercentage: sets.intensityPercentage,
      actualWeight: sets.actualWeight,
      actualReps: sets.actualReps,
      completedAt: sets.completedAt,
    })
    .from(sets)
    .innerJoin(lifts, eq(sets.liftId, lifts.id))
    .where(eq(sets.sessionId, sessionId))
    .orderBy(asc(sets.orderIndex));
}
