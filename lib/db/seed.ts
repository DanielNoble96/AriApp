import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, programDays, lifts } from "./schema";

// Single seeded user for now -- every table already carries a user_id so
// real multi-user auth can be added later without a schema change.
const SEED_USER_EMAIL = "ari@afterpartymedia.com";

const DAY_DEFS = [
  { dayNumber: 1, name: "Day 1: Squat" },
  { dayNumber: 2, name: "Day 2: Bench Press" },
  { dayNumber: 3, name: "Day 3: Hip Thrust" },
  { dayNumber: 4, name: "Day 4: Bent-Over Row" },
] as const;

// Cable Crunches appears on both Day 1 and Day 4 in the program, but a lift
// belongs to exactly one program_day in this schema, so it's seeded as two
// independent rows (cable-crunch-day1 / cable-crunch-day4). Accessories have
// no shared training max or history, so this costs nothing functionally.
const LIFT_DEFS = [
  { slug: "squat", name: "Squat", role: "main", bodyRegion: "lower", dayNumber: 1, order: 1 },
  { slug: "deadlift", name: "Deadlift", role: "assistance", bodyRegion: "lower", dayNumber: 1, order: 2 },
  { slug: "calf-raise", name: "Calf Raises", role: "accessory", bodyRegion: null, dayNumber: 1, order: 3 },
  {
    slug: "cable-crunch-day1",
    name: "Cable Crunches",
    role: "accessory",
    bodyRegion: null,
    dayNumber: 1,
    order: 4,
  },
  { slug: "bench-press", name: "Bench Press", role: "main", bodyRegion: "upper", dayNumber: 2, order: 1 },
  {
    slug: "overhead-press",
    name: "Overhead Press",
    role: "assistance",
    bodyRegion: "upper",
    dayNumber: 2,
    order: 2,
  },
  { slug: "db-curl", name: "DB Curls", role: "accessory", bodyRegion: null, dayNumber: 2, order: 3 },
  { slug: "hip-thrust", name: "Hip Thrust", role: "main", bodyRegion: "lower", dayNumber: 3, order: 1 },
  {
    slug: "single-leg-rdl",
    name: "Single-Leg RDL",
    role: "assistance",
    bodyRegion: "lower",
    dayNumber: 3,
    order: 2,
  },
  {
    slug: "single-leg-step-up",
    name: "Single-Leg Step-Ups",
    role: "accessory",
    bodyRegion: null,
    dayNumber: 3,
    order: 3,
  },
  {
    slug: "bent-over-row",
    name: "Bent-Over Row",
    role: "main",
    bodyRegion: "upper",
    dayNumber: 4,
    order: 1,
  },
  {
    slug: "lat-pulldown",
    name: "Lat Pulldown",
    role: "assistance",
    bodyRegion: "upper",
    dayNumber: 4,
    order: 2,
  },
  { slug: "pull-up", name: "Pull-Ups", role: "accessory", bodyRegion: null, dayNumber: 4, order: 3 },
  {
    slug: "cable-crunch-day4",
    name: "Cable Crunches",
    role: "accessory",
    bodyRegion: null,
    dayNumber: 4,
    order: 4,
  },
] as const;

async function seed() {
  await db.insert(users).values({ email: SEED_USER_EMAIL, name: "Ari" }).onConflictDoNothing({
    target: users.email,
  });
  const [user] = await db.select().from(users).where(eq(users.email, SEED_USER_EMAIL));
  if (!user) throw new Error("Failed to resolve seed user");

  await db
    .insert(programDays)
    .values(DAY_DEFS.map((d) => ({ ...d, userId: user.id })))
    .onConflictDoNothing({ target: [programDays.userId, programDays.dayNumber] });

  const days = await db.select().from(programDays).where(eq(programDays.userId, user.id));
  const dayIdByNumber = new Map(days.map((d) => [d.dayNumber, d.id]));

  await db
    .insert(lifts)
    .values(
      LIFT_DEFS.map((l) => ({
        userId: user.id,
        programDayId: dayIdByNumber.get(l.dayNumber)!,
        slug: l.slug,
        name: l.name,
        role: l.role,
        bodyRegion: l.bodyRegion,
        orderInDay: l.order,
      }))
    )
    .onConflictDoNothing({ target: [lifts.userId, lifts.slug] });

  console.log(`Seeded user ${user.email}, ${days.length} program days, ${LIFT_DEFS.length} lifts.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
