import { eq, and, ne, inArray } from "drizzle-orm";
import { db } from "./index";
import { users, cycles, sessions, sets, lifts, cycleLiftTms } from "./schema";
import { getSwapPool } from "../lift-swaps";
import { DEFAULT_ASSISTANCE_PERCENTAGE } from "../constants";
import { buildSessionSetPlan, type SessionLiftInput, type MainWaveConfig, type WaveWeek } from "../weight-calc";

/**
 * One-off, following backfill-regenerate-noncompleted-sessions.ts: adds the
 * fixed cross-day assistance lift (5x10 @ 50% of ITS OWN cycle TM, e.g.
 * Deadlift on Squat day) back into every NOT-YET-COMPLETED session
 * (status != 'completed'). Completed sessions are never touched.  Refuses
 * (and reports) any non-completed session that already has a logged set.
 * Run once via `npm run db:backfill-add-assistance-work`.
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
    const userLifts = await db.select().from(lifts).where(eq(lifts.userId, user.id));
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

      const mainSlug = DAY_TO_SLUG[session.dayNumber];
      const mainLift = liftBySlug.get(mainSlug);
      if (!mainLift) {
        console.log(`  SKIP Week ${session.weekNumber} Day ${session.dayNumber} -- missing lift ${mainSlug}`);
        continue;
      }
      const [mainTmRow] = await db
        .select()
        .from(cycleLiftTms)
        .where(and(eq(cycleLiftTms.cycleId, session.cycleId), eq(cycleLiftTms.liftId, mainLift.id)));
      if (!mainTmRow) {
        console.log(`  SKIP Week ${session.weekNumber} Day ${session.dayNumber} -- no TM for ${mainSlug}`);
        continue;
      }

      const dayLifts: SessionLiftInput[] = [
        { liftId: mainLift.id, role: "main", trainingMax: Number(mainTmRow.startingTm), equipmentType: "barbell" },
      ];

      const assistSlug = getSwapPool(session.dayNumber, "assistance")[0];
      const assistLift = assistSlug ? liftBySlug.get(assistSlug) : undefined;
      const assistancePercentages: Record<string, number> = {};
      if (assistLift) {
        const [assistTmRow] = await db
          .select()
          .from(cycleLiftTms)
          .where(and(eq(cycleLiftTms.cycleId, session.cycleId), eq(cycleLiftTms.liftId, assistLift.id)));
        if (assistTmRow) {
          dayLifts.push({
            liftId: assistLift.id,
            role: "assistance",
            trainingMax: Number(assistTmRow.startingTm),
            equipmentType: "barbell",
          });
          assistancePercentages[assistLift.id] = DEFAULT_ASSISTANCE_PERCENTAGE;
        } else {
          console.log(`  NOTE Week ${session.weekNumber} Day ${session.dayNumber} -- no TM for assistance lift ${assistSlug}, skipping assistance for this session only`);
        }
      }

      const plan = buildSessionSetPlan({
        dayLifts,
        weekNumber: session.weekNumber as 1 | 2 | 3,
        mainWaveConfig: cycle.mainWaveConfig as MainWaveConfig,
        warmupScheme: cycle.warmupSchemeConfig as WaveWeek,
        assistancePercentages,
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
      console.log(`  FIXED Week ${session.weekNumber} Day ${session.dayNumber} -- now ${plan.length} sets`);
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
