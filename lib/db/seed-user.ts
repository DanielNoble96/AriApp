import { eq } from "drizzle-orm";
import { db } from "./index";
import { programDays, lifts } from "./schema";

const DAY_DEFS = [
  { dayNumber: 1, name: "Day 1" },
  { dayNumber: 2, name: "Day 2" },
  { dayNumber: 3, name: "Day 3" },
  { dayNumber: 4, name: "Day 4" },
] as const;

// Classic 5/3/1: one main lift per day, plus a fixed cross-day assistance
// lift generated alongside it (see SWAP_POOLS/actions/cycles.ts). No
// auto-populated accessories at all -- accessory work is entirely
// freeform, added per-session via actions/custom-accessories.ts.
const LIFT_DEFS = [
  {
    slug: "squat",
    name: "Squat",
    role: "main",
    bodyRegion: "lower",
    equipmentType: "barbell",
    dayNumber: 1,
    order: 1,
    isSwapOnly: false,
  },
  {
    slug: "bench-press",
    name: "Bench Press",
    role: "main",
    bodyRegion: "upper",
    equipmentType: "barbell",
    dayNumber: 2,
    order: 1,
    isSwapOnly: false,
  },
  {
    slug: "overhead-press",
    name: "Overhead Press",
    role: "main",
    bodyRegion: "upper",
    equipmentType: "barbell",
    dayNumber: 3,
    order: 1,
    isSwapOnly: false,
  },
  {
    slug: "deadlift",
    name: "Deadlift",
    role: "main",
    bodyRegion: "lower",
    equipmentType: "barbell",
    dayNumber: 4,
    order: 1,
    isSwapOnly: false,
  },
  {
    slug: "romanian-deadlift",
    name: "Romanian Deadlift",
    role: "assistance",
    bodyRegion: "lower",
    equipmentType: "barbell",
    dayNumber: 1,
    order: 2,
    isSwapOnly: true,
  },
] as const;

/**
 * Creates the standard 4-day/5-lift program for a user (no training maxes
 * set). Shared by the one-time CLI seed script and the signup flow for new
 * accounts, so the exercise list only lives in one place.
 */
export async function seedProgramForUser(userId: string) {
  await db
    .insert(programDays)
    .values(DAY_DEFS.map((d) => ({ ...d, userId })))
    .onConflictDoNothing({ target: [programDays.userId, programDays.dayNumber] });

  const days = await db.select().from(programDays).where(eq(programDays.userId, userId));
  const dayIdByNumber = new Map(days.map((d) => [d.dayNumber, d.id]));

  await db
    .insert(lifts)
    .values(
      LIFT_DEFS.map((l) => ({
        userId,
        programDayId: dayIdByNumber.get(l.dayNumber)!,
        slug: l.slug,
        name: l.name,
        role: l.role,
        bodyRegion: l.bodyRegion,
        equipmentType: l.equipmentType,
        orderInDay: l.order,
        isSwapOnly: l.isSwapOnly,
      }))
    )
    .onConflictDoNothing({ target: [lifts.userId, lifts.slug] });

  return { dayCount: days.length, liftCount: LIFT_DEFS.length };
}
