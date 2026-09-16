import { db } from "./index";
import { users } from "./schema";
import { seedProgramForUser } from "./seed-user";

/**
 * One-off: the lift-shuffle feature added new swap-only candidate lifts to
 * LIFT_DEFS in seed-user.ts (e.g. Romanian Deadlift, Push Press). New
 * signups get them automatically via seedProgramForUser, but existing users
 * already have their program_days/lifts rows and need the new rows
 * backfilled. Safe to re-run: seedProgramForUser's inserts both use
 * onConflictDoNothing, so already-seeded rows are untouched and only the
 * new lift rows get inserted.
 * Run once via `npm run db:backfill-swap-lifts`.
 */
async function main() {
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    const { liftCount } = await seedProgramForUser(user.id);
    console.log(`${user.email}: ensured ${liftCount} lift rows`);
  }
  console.log(`Backfilled ${allUsers.length} user(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
