import type { MainWaveConfig, WaveWeek } from "./weight-calc";

// Shared by actions/auth.ts (signup) and actions/profile.ts (username
// change) -- kept here since a "use server" file can only export async
// functions, not plain constants.
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export const ROUND_INCREMENT = 5;

// A standard barbell's own weight -- no barbell set should ever be
// calculated below this, since you physically can't load a bar to less
// than what it weighs empty.
export const DEFAULT_BAR_WEIGHT = 45;

// Classic 5/3/1 wave. Editable per-cycle at setup; these are just the
// pre-filled defaults.
export const DEFAULT_MAIN_WAVE: MainWaveConfig = {
  week1: [
    { percentage: 65, reps: 5 },
    { percentage: 75, reps: 5 },
    { percentage: 85, reps: 5, amrap: true },
  ],
  week2: [
    { percentage: 70, reps: 3 },
    { percentage: 80, reps: 3 },
    { percentage: 90, reps: 3, amrap: true },
  ],
  week3: [
    { percentage: 75, reps: 5 },
    { percentage: 85, reps: 3 },
    { percentage: 95, reps: 1, amrap: true },
  ],
};

export const DEFAULT_WARMUP_SCHEME: WaveWeek = [
  { percentage: 40, reps: 5 },
  { percentage: 50, reps: 5 },
  { percentage: 60, reps: 3 },
];

// Flat starting point for every assistance lift; each is independently
// editable per lift at cycle setup.
export const DEFAULT_ASSISTANCE_PERCENTAGE = 50;

// Training max bump applied at cycle-complete, suggested but editable.
export const UPPER_BODY_TM_BUMP = 5;
export const LOWER_BODY_TM_BUMP = 10;

// Rest-timer alert targets (seconds), editable at cycle setup. The work
// target also applies to assistance and accessory sets.
export const DEFAULT_REST_TARGET_WARMUP_SECONDS = 120;
export const DEFAULT_REST_TARGET_WORK_SECONDS = 180;

// Display order for listing the 4 days within a week -- purely visual;
// doesn't change which session/exercises a given dayNumber actually is.
export const DAY_DISPLAY_ORDER = [1, 2, 4, 3];

// Display labels for each of the 4 fixed program days.
export const DAY_LABELS: Record<number, string> = {
  1: "Lower Body + Abs",
  2: "Upper Body",
  3: "Glutes",
  4: "Back + Abs",
};

export type AccessoryActivityType =
  | "run"
  | "bike"
  | "swim"
  | "walk"
  | "yoga"
  | "pilates"
  | "tennis"
  | "pickleball"
  | "paddle"
  | "trail_run";

// Display order for the activity-type picker when logging an accessory day.
export const ACCESSORY_ACTIVITY_OPTIONS: AccessoryActivityType[] = [
  "run",
  "bike",
  "swim",
  "walk",
  "yoga",
  "pilates",
  "tennis",
  "pickleball",
  "paddle",
  "trail_run",
];

export const ACCESSORY_ACTIVITY_LABELS: Record<AccessoryActivityType, string> = {
  run: "Run",
  bike: "Bike",
  swim: "Swim",
  walk: "Walk",
  yoga: "Yoga",
  pilates: "Pilates",
  tennis: "Tennis",
  pickleball: "Pickleball",
  paddle: "Paddle",
  trail_run: "Trail Run",
};
