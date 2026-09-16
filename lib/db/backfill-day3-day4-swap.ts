import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { users, programDays, lifts } from "./schema";

/**
 * One-off: Day 3 and Day 4's actual main+assistance lifts were swapped
 * (Bent-Over Row/Lat Pulldown -> Day 3, Hip Thrust/Single-Leg RDL -> Day 4)
 * to match lib/lift-swaps.ts's SWAP_POOLS and LIFT_DEFS in seed-user.ts.
 * Existing users' already-seeded lift rows need the same programDayId/
 * orderInDay update so a brand-new cycle generates with the corrected
 * defaults too -- this only repoints which day a lift row belongs to, it
 * never touches already-generated sessions/sets, so no in-progress or
 * completed cycle's logged data is affected.
 * Run once via `npm run db:backfill-day3-day4-swap`.
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

    const moves: { slug: string; programDayId: string; orderInDay: number }[] = [
      { slug: "bent-over-row", programDayId: day3.id, orderInDay: 1 },
      { slug: "lat-pulldown", programDayId: day3.id, orderInDay: 2 },
      { slug: "hip-thrust", programDayId: day4.id, orderInDay: 1 },
      { slug: "single-leg-rdl", programDayId: day4.id, orderInDay: 2 },
    ];

    for (const move of moves) {
      const result = await db
        .update(lifts)
        .set({ programDayId: move.programDayId, orderInDay: move.orderInDay, updatedAt: new Date() })
        .where(and(eq(lifts.userId, user.id), eq(lifts.slug, move.slug)))
        .returning({ id: lifts.id });
      if (result.length === 0) {
        console.log(`${user.email}: no "${move.slug}" row found, skipping`);
      }
    }
    console.log(`${user.email}: moved bent-over-row/lat-pulldown -> Day 3, hip-thrust/single-leg-rdl -> Day 4`);
  }

  console.log(`Done: ${allUsers.length} user(s) checked.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
