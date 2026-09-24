import { eq, and, inArray, notInArray } from "drizzle-orm";
import { db } from "./index";
import { users, programDays, lifts } from "./schema";

/**
 * One-off: collapses the program down to classic 5/3/1 (Squat, Bench Press,
 * Overhead Press, Deadlift -- one main lift per day, no assistance tier,
 * no auto-populated accessories). Every other existing lift row (the old
 * assistance lifts, every seeded accessory, every swap-only variant) is
 * marked isSwapOnly so it's excluded from future cycle generation and the
 * cycle-setup form, WITHOUT being deleted -- deleting would cascade-delete
 * any completed session's sets that reference it, destroying real history.
 * Overhead Press moves to Day 3 and Deadlift moves to Day 4 (Squat/Day 1
 * and Bench Press/Day 2 are unchanged) so a brand-new cycle generates the
 * new default lineup.
 * Run once via `npm run db:backfill-classic-531`.
 */
const CORE_SLUGS = ["squat", "bench-press", "overhead-press", "deadlift"];

async function main() {
  const allUsers = await db.select().from(users);

  for (const user of allUsers) {
    const days = await db.select().from(programDays).where(eq(programDays.userId, user.id));
    const day3 = days.find((d) => d.dayNumber === 3);
    const day4 = days.find((d) => d.dayNumber === 4);
    if (!day3 || !day4) {
      console.log(`${user.email}: missing Day 3/4, skipping`);
      continue;
    }

    await db
      .update(lifts)
      .set({ isSwapOnly: true, updatedAt: new Date() })
      .where(and(eq(lifts.userId, user.id), notInArray(lifts.slug, CORE_SLUGS)));

    await db
      .update(lifts)
      .set({ programDayId: day3.id, orderInDay: 1, isSwapOnly: false, updatedAt: new Date() })
      .where(and(eq(lifts.userId, user.id), eq(lifts.slug, "overhead-press")));

    await db
      .update(lifts)
      .set({ programDayId: day4.id, orderInDay: 1, isSwapOnly: false, updatedAt: new Date() })
      .where(and(eq(lifts.userId, user.id), eq(lifts.slug, "deadlift")));

    await db
      .update(lifts)
      .set({ isSwapOnly: false, updatedAt: new Date() })
      .where(and(eq(lifts.userId, user.id), inArray(lifts.slug, ["squat", "bench-press"])));

    console.log(`${user.email}: core lifts confirmed, everything else marked isSwapOnly`);
  }

  console.log(`Done: ${allUsers.length} user(s) checked.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
