import type { MainWaveConfig, WaveWeek } from "./weight-calc";

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
