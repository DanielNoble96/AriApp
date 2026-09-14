"use server";

import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { cycles, cycleLiftTms, cycleAssistanceConfig, sessions, sets, lifts } from "@/lib/db/schema";
import { getLiftsForUser } from "@/lib/db/queries";
import { getSessionUser } from "@/lib/auth";
import {
  buildSessionSetPlan,
  type MainWaveConfig,
  type WaveWeek,
  type SessionLiftInput,
} from "@/lib/weight-calc";

export interface CreateCycleInput {
  /** liftId -> training max, required for every main and assistance lift. */
  trainingMaxes: Record<string, number>;
  /** liftId -> percentage of TM, required for every assistance lift. */
  assistancePercentages: Record<string, number>;
  mainWaveConfig: MainWaveConfig;
  warmupScheme: WaveWeek;
  restTargetWarmupSeconds: number;
  restTargetWorkSeconds: number;
}

export async function createCycle(input: CreateCycleInput) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");

  const allLifts = await getLiftsForUser(user.id);

  const trackedLifts = allLifts.filter((l) => l.role === "main" || l.role === "assistance");
  const assistanceLifts = allLifts.filter((l) => l.role === "assistance");

  for (const l of trackedLifts) {
    if (input.trainingMaxes[l.id] == null) {
      throw new Error(`Missing training max for ${l.name}`);
    }
  }
  for (const l of assistanceLifts) {
    if (input.assistancePercentages[l.id] == null) {
      throw new Error(`Missing assistance percentage for ${l.name}`);
    }
  }

  const [lastCycle] = await db
    .select({ cycleNumber: cycles.cycleNumber })
    .from(cycles)
    .where(eq(cycles.userId, user.id))
    .orderBy(desc(cycles.cycleNumber))
    .limit(1);
  const cycleNumber = (lastCycle?.cycleNumber ?? 0) + 1;

  // TODO(multi-user): neon-http has no interactive transaction support, so
  // these writes run sequentially instead of atomically. As a stand-in, any
  // failure below deletes the cycle row, which cascades to clean up
  // everything created for it. Once we're on multiple users, replace this
  // whole block with a real transaction via drizzle-orm/neon-serverless
  // (the websocket/Pool driver, which does support db.transaction()).
  let cycleId: string | undefined;

  try {
    const [cycle] = await db
      .insert(cycles)
      .values({
        userId: user.id,
        cycleNumber,
        status: "active",
        mainWaveConfig: input.mainWaveConfig,
        warmupSchemeConfig: input.warmupScheme,
        restTargetWarmupSeconds: input.restTargetWarmupSeconds,
        restTargetWorkSeconds: input.restTargetWorkSeconds,
      })
      .returning();
    cycleId = cycle.id;

    await db.insert(cycleLiftTms).values(
      trackedLifts.map((l) => ({
        cycleId: cycle.id,
        liftId: l.id,
        startingTm: String(input.trainingMaxes[l.id]),
      }))
    );

    await db.insert(cycleAssistanceConfig).values(
      assistanceLifts.map((l) => ({
        cycleId: cycle.id,
        liftId: l.id,
        percentageOfTm: String(input.assistancePercentages[l.id]),
      }))
    );

    // Cache the latest TM on the lift itself so the *next* cycle's setup
    // screen can pre-fill from it.
    for (const l of trackedLifts) {
      await db
        .update(lifts)
        .set({ currentTrainingMax: String(input.trainingMaxes[l.id]), updatedAt: new Date() })
        .where(eq(lifts.id, l.id));
    }

    const liftsByDay = new Map<number, typeof allLifts>();
    for (const lift of allLifts) {
      const arr = liftsByDay.get(lift.dayNumber) ?? [];
      arr.push(lift);
      liftsByDay.set(lift.dayNumber, arr);
    }

    for (let week = 1; week <= 3; week++) {
      for (let day = 1; day <= 4; day++) {
        const sequenceIndex = (week - 1) * 4 + day;
        const dayLiftRows = liftsByDay.get(day) ?? [];

        const [session] = await db
          .insert(sessions)
          .values({
            cycleId: cycle.id,
            userId: user.id,
            dayNumber: day,
            weekNumber: week,
            sequenceIndex,
            status: "pending",
          })
          .returning();

        const dayLiftsInput: SessionLiftInput[] = dayLiftRows.map((l) => ({
          liftId: l.id,
          role: l.role,
          trainingMax: l.role === "accessory" ? null : input.trainingMaxes[l.id],
          equipmentType: l.equipmentType,
        }));

        const plan = buildSessionSetPlan({
          dayLifts: dayLiftsInput,
          weekNumber: week as 1 | 2 | 3,
          mainWaveConfig: input.mainWaveConfig,
          warmupScheme: input.warmupScheme,
          assistancePercentages: input.assistancePercentages,
        });

        if (plan.length > 0) {
          await db.insert(sets).values(
            plan.map((row) => ({
              sessionId: session.id,
              liftId: row.liftId,
              setType: row.setType,
              orderIndex: row.orderIndex,
              isAmrap: row.isAmrap,
              targetWeight: row.targetWeight != null ? String(row.targetWeight) : null,
              targetReps: row.targetReps,
            }))
          );
        }
      }
    }
  } catch (err) {
    if (cycleId) {
      await db.delete(cycles).where(eq(cycles.id, cycleId)).catch(() => {});
    }
    throw err;
  }

  // Deliberately no redirect() here -- this action is called directly from a
  // client component wrapped in try/catch, and redirect() throws internally,
  // which that catch would otherwise misinterpret as a failure. The client
  // navigates itself after a successful (non-throwing) call instead.
  return { cycleNumber };
}
