import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { programDays } from "./schema";

/** One-off: renames every user's program days from "Day N" to their main lift. Run via `npm run db:backfill-day-names`. */
const NAMES: Record<number, string> = { 1: "Squat", 2: "Bench Press", 3: "Overhead Press", 4: "Deadlift" };

async function main() {
  for (const [day, name] of Object.entries(NAMES)) {
    await db.update(programDays).set({ name }).where(eq(programDays.dayNumber, Number(day)));
  }
  console.log("Renamed program days.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
