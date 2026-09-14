import { eq } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";
import { seedProgramForUser } from "./seed-user";

// Single seeded user for now -- every table already carries a user_id so
// real multi-user auth can be added later without a schema change.
const SEED_USER_EMAIL = "ari@afterpartymedia.com";

async function seed() {
  await db.insert(users).values({ email: SEED_USER_EMAIL, name: "Ari" }).onConflictDoNothing({
    target: users.email,
  });
  const [user] = await db.select().from(users).where(eq(users.email, SEED_USER_EMAIL));
  if (!user) throw new Error("Failed to resolve seed user");

  const { dayCount, liftCount } = await seedProgramForUser(user.id);

  console.log(`Seeded user ${user.email}, ${dayCount} program days, ${liftCount} lifts.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
