import { DEFAULT_BAR_WEIGHT } from "./constants";

/**
 * Rounds to the nearest 5 lb by default -- the smallest jump loadable with a
 * standard 45 lb bar and standard plate pairs (45/25/10/5/2.5 lb per side,
 * i.e. 2.5 lb/side = 5 lb total is the smallest increment).
 */
export function roundToIncrement(weight: number, increment: number = 5): number {
  return Math.round(weight / increment) * increment;
}

/**
 * `minWeight` floors the result -- for a barbell exercise, a set should
 * never be calculated below the bar's own empty weight, since you can't
 * physically load a bar to less than that.
 */
export function calcTargetWeight(
  trainingMax: number,
  percentage: number,
  increment: number = 5,
  minWeight: number = 0
): number {
  return Math.max(minWeight, roundToIncrement(trainingMax * (percentage / 100), increment));
}

export interface WaveSet {
  percentage: number;
  reps: number;
  amrap?: boolean;
}

export type WaveWeek = WaveSet[];

export interface MainWaveConfig {
  week1: WaveWeek;
  week2: WaveWeek;
  week3: WaveWeek;
}

export type SetType = "warmup" | "main" | "assistance" | "accessory";

export interface SetPlanRow {
  setType: SetType;
  orderIndex: number;
  targetWeight: number | null;
  targetReps: number | null;
  isAmrap: boolean;
  /** The %TM used to compute targetWeight -- the INOL calculator's %1RM input. Null for accessories. */
  intensityPercentage: number | null;
}

export function generateWarmupSets(
  trainingMax: number,
  scheme: WaveWeek,
  increment: number = 5,
  minWeight: number = 0
): SetPlanRow[] {
  return scheme.map((set, index) => ({
    setType: "warmup",
    orderIndex: index,
    targetWeight: calcTargetWeight(trainingMax, set.percentage, increment, minWeight),
    targetReps: set.reps,
    isAmrap: false,
    intensityPercentage: set.percentage,
  }));
}

export function generateMainSets(
  trainingMax: number,
  weekScheme: WaveWeek,
  increment: number = 5,
  minWeight: number = 0
): SetPlanRow[] {
  return weekScheme.map((set, index) => ({
    setType: "main",
    orderIndex: index,
    targetWeight: calcTargetWeight(trainingMax, set.percentage, increment, minWeight),
    targetReps: set.reps,
    isAmrap: Boolean(set.amrap),
    intensityPercentage: set.percentage,
  }));
}

/** Assistance lifts: flat percentage of TM, same every week of the cycle. */
export function generateAssistanceSets(
  trainingMax: number,
  percentage: number,
  sets: number = 5,
  reps: number = 10,
  increment: number = 5,
  minWeight: number = 0
): SetPlanRow[] {
  const targetWeight = calcTargetWeight(trainingMax, percentage, increment, minWeight);
  return Array.from({ length: sets }, (_, index) => ({
    setType: "assistance",
    orderIndex: index,
    targetWeight,
    targetReps: reps,
    isAmrap: false,
    intensityPercentage: percentage,
  }));
}

/** Accessories have no TM and no calculated target -- fully freeform. */
export function generateAccessoryPlaceholders(count: number = 3): SetPlanRow[] {
  return Array.from({ length: count }, (_, index) => ({
    setType: "accessory",
    orderIndex: index,
    targetWeight: null,
    targetReps: null,
    isAmrap: false,
    intensityPercentage: null,
  }));
}

export interface SessionLiftInput {
  liftId: string;
  role: "main" | "assistance" | "accessory";
  trainingMax: number | null;
  /** "barbell" floors calculated weights at DEFAULT_BAR_WEIGHT; other types have no floor. */
  equipmentType: "barbell" | "dumbbell" | "machine" | null;
}

export interface BuildSessionSetPlanParams {
  dayLifts: SessionLiftInput[];
  weekNumber: 1 | 2 | 3;
  mainWaveConfig: MainWaveConfig;
  warmupScheme: WaveWeek;
  /** liftId -> percentage of TM, one entry per assistance lift for this cycle. */
  assistancePercentages: Record<string, number>;
  increment?: number;
}

export interface SessionSetPlanRow extends SetPlanRow {
  liftId: string;
}

const WEEK_KEY = { 1: "week1", 2: "week2", 3: "week3" } as const;

/** Composes warmup/main/assistance/accessory generation into one session's full ordered plan. */
export function buildSessionSetPlan(
  params: BuildSessionSetPlanParams
): SessionSetPlanRow[] {
  const { dayLifts, weekNumber, mainWaveConfig, warmupScheme, assistancePercentages, increment } =
    params;
  const weekScheme = mainWaveConfig[WEEK_KEY[weekNumber]];
  const rows: SessionSetPlanRow[] = [];
  let order = 0;

  for (const lift of dayLifts) {
    const minWeight = lift.equipmentType === "barbell" ? DEFAULT_BAR_WEIGHT : 0;

    if (lift.role === "main") {
      if (lift.trainingMax == null) {
        throw new Error(`Main lift ${lift.liftId} is missing a training max`);
      }
      for (const row of generateWarmupSets(lift.trainingMax, warmupScheme, increment, minWeight)) {
        rows.push({ ...row, liftId: lift.liftId, orderIndex: order++ });
      }
      for (const row of generateMainSets(lift.trainingMax, weekScheme, increment, minWeight)) {
        rows.push({ ...row, liftId: lift.liftId, orderIndex: order++ });
      }
    } else if (lift.role === "assistance") {
      if (lift.trainingMax == null) {
        throw new Error(`Assistance lift ${lift.liftId} is missing a training max`);
      }
      const percentage = assistancePercentages[lift.liftId];
      if (percentage == null) {
        throw new Error(`Assistance lift ${lift.liftId} is missing a configured percentage`);
      }
      for (const row of generateAssistanceSets(
        lift.trainingMax,
        percentage,
        5,
        10,
        increment,
        minWeight
      )) {
        rows.push({ ...row, liftId: lift.liftId, orderIndex: order++ });
      }
    } else {
      for (const row of generateAccessoryPlaceholders()) {
        rows.push({ ...row, liftId: lift.liftId, orderIndex: order++ });
      }
    }
  }

  return rows;
}
