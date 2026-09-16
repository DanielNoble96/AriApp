"use server";

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { sets, sessions, lifts, programDays } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

/**
 * Adds a brand-new, user-named freeform accessory to a session -- creates a
 * one-off lift row (isSwapOnly: true, so it never gets auto-generated into
 * future cycles) plus a single freeform set for it, appended at the end of
 * the session. Mirrors the existing prescribed accessory rows (null
 * target, freeform weight/reps) so it reuses the same rendering, "Extra
 * Sets", and remove-set logic already in session-client.tsx.
 */
export async function addCustomAccessory(sessionId: string, name: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Enter a name for the accessory.");
  if (trimmed.length > 60) throw new Error("Name is too long.");

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session) throw new Error("Session not found");
  if (session.userId !== user.id) throw new Error("Forbidden");

  const [day] = await db
    .select()
    .from(programDays)
    .where(and(eq(programDays.userId, user.id), eq(programDays.dayNumber, session.dayNumber)));
  if (!day) throw new Error("Program day not found");

  const [lift] = await db
    .insert(lifts)
    .values({
      userId: user.id,
      programDayId: day.id,
      slug: `custom-${crypto.randomUUID().slice(0, 8)}`,
      name: trimmed,
      role: "accessory",
      bodyRegion: null,
      equipmentType: null,
      orderInDay: 99,
      isSwapOnly: true,
    })
    .returning();

  const [lastRow] = await db
    .select({ orderIndex: sets.orderIndex })
    .from(sets)
    .where(eq(sets.sessionId, sessionId))
    .orderBy(desc(sets.orderIndex))
    .limit(1);
  const orderIndex = (lastRow?.orderIndex ?? -1) + 1;

  const [newSet] = await db
    .insert(sets)
    .values({
      sessionId,
      liftId: lift.id,
      setType: "accessory",
      orderIndex,
      isAmrap: false,
      isExtra: false,
      targetWeight: null,
      targetReps: null,
      intensityPercentage: null,
    })
    .returning();

  return {
    id: newSet.id,
    liftId: lift.id,
    liftName: lift.name,
    liftRole: lift.role,
    equipmentType: lift.equipmentType,
    setType: newSet.setType,
    orderIndex: newSet.orderIndex,
    isAmrap: newSet.isAmrap,
    isExtra: newSet.isExtra,
    targetWeight: newSet.targetWeight,
    targetReps: newSet.targetReps,
    intensityPercentage: newSet.intensityPercentage,
  };
}
