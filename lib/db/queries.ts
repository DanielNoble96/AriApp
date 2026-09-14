import { eq, asc } from "drizzle-orm";
import { db } from "./index";
import { users, lifts, programDays } from "./schema";

// Single-user app for now -- there's only ever one row to grab.
export async function getCurrentUser() {
  const [user] = await db.select().from(users).limit(1);
  if (!user) throw new Error("No seeded user found -- run `npm run db:seed`");
  return user;
}

export async function getLiftsForUser(userId: string) {
  return db
    .select({
      id: lifts.id,
      slug: lifts.slug,
      name: lifts.name,
      role: lifts.role,
      bodyRegion: lifts.bodyRegion,
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
