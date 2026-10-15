import { eq, isNotNull } from "drizzle-orm";
import { db } from "./index";
import { posts } from "./schema";
import { getSetsForSession } from "./queries";
import { calcTotalInol } from "../inol";

/**
 * One-off: recomputes every workout post's stored INOL snapshot with the
 * corrected formula (%1RM instead of %TM, main work sets only -- see
 * lib/inol.ts). Derived entirely from the logged sets, so nothing
 * original is lost. Run via `npm run db:backfill-recompute-inol`.
 */
async function main() {
  const rows = await db.select().from(posts).where(isNotNull(posts.sessionId));
  let changed = 0;
  let sumOld = 0;
  let sumNew = 0;
  for (const post of rows) {
    const sessionSets = await getSetsForSession(post.sessionId!);
    const fresh = calcTotalInol(sessionSets);
    const old = Number(post.inolScore ?? 0);
    sumOld += old;
    sumNew += fresh;
    if (Math.abs(fresh - old) > 0.0005) {
      await db.update(posts).set({ inolScore: fresh.toFixed(3) }).where(eq(posts.id, post.id));
      changed++;
    }
  }
  console.log(`posts: ${rows.length}, updated: ${changed}, avg old=${(sumOld / rows.length).toFixed(2)} avg new=${(sumNew / rows.length).toFixed(2)}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
