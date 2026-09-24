import { eq, and, ne, inArray } from "drizzle-orm";
import { db } from "./index";
import { users, cycles, sessions, sets, lifts, cycleLiftTms } from "./schema";
import { buildSessionSetPlan, type SessionLiftInput, type MainWaveConfig, type WaveWeek } from "../weight-calc";

/**
 * One-off, paired with backfill-classic-531.ts: regenerates every
 * NOT-YET-COMPLETED session's sets (status != 'completed') to the new
 * classic 5/3/1 structure -- one main lift's warm-up + work sets only, no
 * assistance, no auto-populated accessories. Completed sessions are never
 * touched, so historical stats are unaffected. Refuses (and reports) any
 * non-completed session that already has a logged/completed individual
 * set, rather than silently discarding it.
 * Run once via `npm run db:backfill-regenerate-noncompleted-sessions`.
 */
const DAY_TO_SLUG: Record<number, string> = {
  1: "squat",
  2: "bench-press",
  3: "overhead-press",
  4: "deadlift",
};

async function main() {
  const allUsers = await db.select().from(users);

  for (const user of allUsers) {
    const userLifts = await db
      .select()
      .from(lifts)
      .where(and(eq(lifts.userId, user.id), inArray(lifts.slug, Object.values(DAY_TO_SLUG))));
    const liftBySlug = new Map(userLifts.map((l) => [l.slug, l]));

    const notCompleted = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), ne(sessions.status, "completed")));
    if (notCompleted.length === 0) {
      console.log(`${user.email}: no non-completed sessions`);
      continue;
    }

    const cycleIds = [...new Set(notCompleted.map((s) => s.cycleId))];
    const cycleRows = await db.select().from(cycles).where(inArray(cycles.id, cycleIds));
    const cycleById = new Map(cycleRows.map((c) => [c.id, c]));

    for (const session of notCompleted) {
      const cycle = cycleById.get(session.cycleId);
      if (!cycle) {
        console.log(`  SKIP session ${session.id} -- cycle not found`);
        continue;
      }

      const existing = await db.select().from(sets).where(eq(sets.sessionId, session.id));
      if (existing.some((r) => r.completedAt != null)) {
        console.log(
          `  SKIP Week ${session.weekNumber} Day ${session.dayNumber} (${session.id}) -- has logged sets, not touching`
        );
        continue;
      }

      const slug = DAY_TO_SLUG[session.dayNumber];
      const lift = liftBySlug.get(slug);
      if (!lift) {
        console.log(`  SKIP Week ${session.weekNumber} Day ${session.dayNumber} -- missing lift ${slug} for this user`);
        continue;
      }

      const [tmRow] = await db
        .select()
        .from(cycleLiftTms)
        .where(and(eq(cycleLiftTms.cycleId, session.cycleId), eq(cycleLiftTms.liftId, lift.id)));
      if (!tmRow) {
        console.log(`  SKIP Week ${session.weekNumber} Day ${session.dayNumber} -- no TM for ${slug} on this cycle`);
        continue;
      }

      const dayLifts: SessionLiftInput[] = [
        {
          liftId: lift.id,
          role: "main",
          trainingMax: Number(tmRow.startingTm),
          equipmentType: "barbell",
        },
      ];

      const plan = buildSessionSetPlan({
        dayLifts,
        weekNumber: session.weekNumber as 1 | 2 | 3,
        mainWaveConfig: cycle.mainWaveConfig as MainWaveConfig,
        warmupScheme: cycle.warmupSchemeConfig as WaveWeek,
        assistancePercentages: {},
      });

      await db.delete(sets).where(eq(sets.sessionId, session.id));
      await db.insert(sets).values(
        plan.map((row) => ({
          sessionId: session.id,
          liftId: row.liftId,
          setType: row.setType,
          orderIndex: row.orderIndex,
          isAmrap: row.isAmrap,
          targetWeight: row.targetWeight != null ? String(row.targetWeight) : null,
          targetReps: row.targetReps,
          intensityPercentage: row.intensityPercentage != null ? String(row.intensityPercentage) : null,
        }))
      );
      console.log(
        `  FIXED Week ${session.weekNumber} Day ${session.dayNumber} -- now ${plan.length} sets (${lift.name})`
      );
    }
  }

  console.log(`Done: ${allUsers.length} user(s) checked.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
