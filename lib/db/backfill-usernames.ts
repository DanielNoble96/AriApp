import { eq, isNull } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";

/**
 * One-off: usernames didn't exist before the social feed feature, so any
 * pre-existing user row has username = null. Derives a candidate from the
 * email's local part (lowercased, stripped to [a-z0-9_], truncated),
 * deduping against already-assigned usernames with a numeric suffix.
 * Run once via `node --env-file=.env.local node_modules/tsx/dist/cli.mjs lib/db/backfill-usernames.ts`,
 * then generate the follow-up migration that adds NOT NULL + UNIQUE.
 */
async function main() {
  const toBackfill = await db.select().from(users).where(isNull(users.username));
  const taken = new Set(
    (await db.select({ username: users.username }).from(users))
      .map((u) => u.username)
      .filter((u): u is string => u != null)
  );

  for (const user of toBackfill) {
    const base = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user";
    let candidate = base;
    let suffix = 1;
    while (taken.has(candidate)) {
      candidate = `${base.slice(0, 20 - String(suffix).length)}${suffix}`;
      suffix++;
    }
    taken.add(candidate);

    await db.update(users).set({ username: candidate }).where(eq(users.id, user.id));
    console.log(`${user.email} -> ${candidate}`);
  }

  console.log(`Backfilled ${toBackfill.length} user(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
