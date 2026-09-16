"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cycles, accessoryDayEntries, posts } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import type { AccessoryActivityType } from "@/lib/constants";

export interface LogAccessoryDayInput {
  cycleId: string;
  weekNumber: number;
  activityType: AccessoryActivityType;
  durationMinutes: number | null;
  distanceMiles: number | null;
  caption: string | null;
}

/**
 * Logs a freeform cross-training/cardio entry and immediately creates its
 * feed post in the same call -- unlike a lifting session, there's no
 * begin/pause/complete lifecycle here, just a single-shot creation. No
 * INOL score and no PRs: this isn't part of the 5/3/1 program itself.
 */
export async function logAccessoryDay(input: LogAccessoryDayInput) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [cycle] = await db.select().from(cycles).where(eq(cycles.id, input.cycleId));
  if (!cycle) throw new Error("Cycle not found");
  if (cycle.userId !== user.id) throw new Error("Forbidden");

  if (input.weekNumber < 1 || input.weekNumber > 3) {
    throw new Error("Invalid week number.");
  }

  const [entry] = await db
    .insert(accessoryDayEntries)
    .values({
      userId: user.id,
      cycleId: input.cycleId,
      weekNumber: input.weekNumber,
      activityType: input.activityType,
      durationMinutes: input.durationMinutes,
      distanceMiles: input.distanceMiles != null ? String(input.distanceMiles) : null,
    })
    .returning();

  const trimmedCaption = input.caption?.trim();

  await db.insert(posts).values({
    userId: user.id,
    accessoryDayEntryId: entry.id,
    caption: trimmedCaption ? trimmedCaption : null,
  });

  return entry;
}

/** Deletes an accessory day entry, cascading to its feed post (and that post's comments). */
export async function deleteAccessoryDay(entryId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const [entry] = await db.select().from(accessoryDayEntries).where(eq(accessoryDayEntries.id, entryId));
  if (!entry) throw new Error("Entry not found");
  if (entry.userId !== user.id) throw new Error("Forbidden");

  await db.delete(accessoryDayEntries).where(eq(accessoryDayEntries.id, entryId));
}
