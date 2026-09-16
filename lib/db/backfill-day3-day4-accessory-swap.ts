import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { users, programDays, lifts } from "./schema";

/**
 * One-off, continuing the Day 3/Day 4 main+assistance swap in
 * backfill-day3-day4-swap.ts: their accessory lifts move too. Single-Leg
 * Step-Ups -> Day 4, Pull-Ups and Cable Crunches -> Day 3 (the latter's
 * slug is renamed cable-crunch-day4 -> cable-crunch-day3 to match, see
 * seed-user.ts). Only repoints existing lift rows -- doesn't touch any
 * already-generated session/set data.
 * Run once via `npm run db:backfill-day3-day4-accessory-swap`.
 */
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
      .set({ programDayId: day4.id, orderInDay: 3, updatedAt: new Date() })
      .where(and(eq(lifts.userId, user.id), eq(lifts.slug, "single-leg-step-up")));

    await db
      .update(lifts)
      .set({ programDayId: day3.id, orderInDay: 3, updatedAt: new Date() })
      .where(and(eq(lifts.userId, user.id), eq(lifts.slug, "pull-up")));

    await db
      .update(lifts)
      .set({ slug: "cable-crunch-day3", programDayId: day3.id, orderInDay: 4, updatedAt: new Date() })
      .where(and(eq(lifts.userId, user.id), eq(lifts.slug, "cable-crunch-day4")));

    console.log(`${user.email}: moved single-leg-step-up -> Day 4, pull-up/cable-crunch -> Day 3`);
  }

  console.log(`Done: ${allUsers.length} user(s) checked.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
