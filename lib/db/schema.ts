import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

// A lift's role determines how its weight is calculated during a session:
// main -> weekly wave % of TM, assistance -> flat % of TM (5x10), accessory -> no TM, freeform.
export const liftRoleEnum = pgEnum("lift_role", ["main", "assistance", "accessory"]);

// Determines training-max bump at cycle end: lower body +10 lb, upper body +5 lb. Null for accessories.
export const bodyRegionEnum = pgEnum("body_region", ["upper", "lower"]);

// Determines how a set's target weight is displayed: barbell -> plate-loading
// breakdown, dumbbell -> per-dumbbell weight, machine -> just the number.
// Null for accessories (no calculated weight to display in the first place).
export const equipmentTypeEnum = pgEnum("equipment_type", ["barbell", "dumbbell", "machine"]);

export const cycleStatusEnum = pgEnum("cycle_status", ["active", "completed"]);

export const sessionStatusEnum = pgEnum("session_status", [
  "pending",
  "in_progress",
  "completed",
]);

export const setTypeEnum = pgEnum("set_type", [
  "warmup",
  "main",
  "assistance",
  "accessory",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  // Null until the account is claimed with a password (see the signup
  // "claim" flow for the originally-seeded single-user account).
  passwordHash: text("password_hash"),
  username: text("username").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Auth sessions -- deliberately NOT named `sessions`, since that table name
// is already taken by workout sessions. `id` is the random token itself.
export const userSessions = pgTable("user_sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// The 4 fixed training days. Rarely changes, but kept as real rows so `lifts`
// can join on a label instead of a bare int.
export const programDays = pgTable(
  "program_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    name: text("name").notNull(),
  },
  (table) => [unique().on(table.userId, table.dayNumber)]
);

// The 13 lifts: 4 main, 4 assistance, 5 accessory. currentTrainingMax is a
// denormalized "latest" cache that pre-fills the next cycle-setup screen;
// the authoritative per-cycle value lives in cycleLiftTms.
export const lifts = pgTable(
  "lifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    programDayId: uuid("program_day_id")
      .notNull()
      .references(() => programDays.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    role: liftRoleEnum("role").notNull(),
    bodyRegion: bodyRegionEnum("body_region"),
    equipmentType: equipmentTypeEnum("equipment_type"),
    orderInDay: integer("order_in_day").notNull(),
    currentTrainingMax: numeric("current_training_max", { precision: 6, scale: 2 }),
    // True for lifts that only exist as shuffle/swap candidates (see
    // lib/lift-swaps.ts) -- excluded from default per-cycle set generation
    // and from the cycle-setup TM/percentage form.
    isSwapOnly: boolean("is_swap_only").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.slug)]
);

// One row per 3-week training cycle. mainWaveConfig / warmupSchemeConfig are
// shared across all main lifts that cycle (fixed shape: 3 weeks x 3 sets),
// editable at cycle setup with defaults from lib/constants.ts.
export const cycles = pgTable(
  "cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cycleNumber: integer("cycle_number").notNull(),
    status: cycleStatusEnum("status").notNull().default("active"),
    mainWaveConfig: jsonb("main_wave_config").notNull(),
    warmupSchemeConfig: jsonb("warmup_scheme_config").notNull(),
    // Rest-timer targets (seconds) for the live session screen's alert.
    // Accessories have no target -- freeform, no consistent rest need.
    restTargetWarmupSeconds: integer("rest_target_warmup_seconds").notNull(),
    restTargetWorkSeconds: integer("rest_target_work_seconds").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.userId, table.cycleNumber)]
);

// Training max locked in at the start of each cycle, plus the suggested/
// confirmed new value at cycle-complete. This table doubles as TM history --
// no separate audit log needed since cycles are strictly ordered.
export const cycleLiftTms = pgTable(
  "cycle_lift_tms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    liftId: uuid("lift_id")
      .notNull()
      .references(() => lifts.id, { onDelete: "cascade" }),
    startingTm: numeric("starting_tm", { precision: 6, scale: 2 }).notNull(),
    endingTm: numeric("ending_tm", { precision: 6, scale: 2 }),
  },
  (table) => [unique().on(table.cycleId, table.liftId)]
);

// Per-assistance-lift percentage of TM, set independently per lift at cycle
// setup (e.g. Deadlift assistance at 50%, OHP assistance at 55%).
export const cycleAssistanceConfig = pgTable(
  "cycle_assistance_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    liftId: uuid("lift_id")
      .notNull()
      .references(() => lifts.id, { onDelete: "cascade" }),
    percentageOfTm: numeric("percentage_of_tm", { precision: 5, scale: 2 }).notNull(),
  },
  (table) => [unique().on(table.cycleId, table.liftId)]
);

// The 12 ordered workout slots per cycle (4 days x 3 weeks). sequenceIndex
// drives "next workout" -- purely sequential, no calendar involved.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    weekNumber: integer("week_number").notNull(),
    sequenceIndex: integer("sequence_index").notNull(),
    status: sessionStatusEnum("status").notNull().default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    // Set while actively paused; null otherwise. pausedSeconds accumulates
    // total time spent paused across possibly multiple pause/resume cycles,
    // so elapsed/rest timers can be computed as (now - startedAt - pausedSeconds)
    // and freeze correctly (via pausedAt) even across a closed/reopened app.
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedSeconds: integer("paused_seconds").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.cycleId, table.sequenceIndex)]
);

// Materialized upfront for all 12 sessions at cycle-creation time. Every set
// has a stable id to check off/edit, and "resume where I left off" is just
// `WHERE completed_at IS NULL`. target* is null for accessory sets (freeform).
export const sets = pgTable("sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  liftId: uuid("lift_id")
    .notNull()
    .references(() => lifts.id, { onDelete: "cascade" }),
  setType: setTypeEnum("set_type").notNull(),
  orderIndex: integer("order_index").notNull(),
  isAmrap: boolean("is_amrap").notNull().default(false),
  // True only for bonus sets appended via the "Extra Sets" card -- lets the
  // UI offer removal for those without risking the prescribed program sets.
  isExtra: boolean("is_extra").notNull().default(false),
  targetWeight: numeric("target_weight", { precision: 6, scale: 2 }),
  targetReps: integer("target_reps"),
  // The %TM used to generate targetWeight (stored exactly, not
  // back-derived from the rounded weight) -- doubles as the %1RM input for
  // the INOL calculator. Null for accessory sets, which have no %TM at all.
  intensityPercentage: numeric("intensity_percentage", { precision: 5, scale: 2 }),
  actualWeight: numeric("actual_weight", { precision: 6, scale: 2 }),
  actualReps: integer("actual_reps"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const friendRequestStatusEnum = pgEnum("friend_request_status", ["pending", "accepted"]);

// A single directional row per friend pair. "Accepted" makes the friendship
// symmetric despite the row's direction -- see lib/db/social-queries.ts's
// getFriendIds, which checks both requesterId and addresseeId. Declining a
// request just deletes the row rather than storing a "declined" status, so
// a new request can be sent again later.
export const friendRequests = pgTable(
  "friend_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: uuid("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendRequestStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.requesterId, table.addresseeId)]
);

// One row per completed session -- created automatically by
// actions/sessions.ts's completeSession. inolScore is a snapshot computed
// at creation time (not recomputed live), since resetSession can later wipe
// the underlying sets; resetSession deletes this row entirely in that case.
export const accessoryActivityTypeEnum = pgEnum("accessory_activity_type", [
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
  "skiing",
  "snowboarding",
  "hiking",
  "other",
]);

// A freeform cross-training/cardio entry, independent of the 4 fixed
// program days -- any number can be added per week. Not scored for INOL
// and never eligible for PRs (see actions/accessory-days.ts).
export const accessoryDayEntries = pgTable("accessory_day_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cycleId: uuid("cycle_id")
    .notNull()
    .references(() => cycles.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  activityType: accessoryActivityTypeEnum("activity_type").notNull(),
  // Set only when activityType is "other" -- the freeform name typed in
  // for a custom activity not in the fixed list.
  customActivityName: text("custom_activity_name"),
  durationMinutes: integer("duration_minutes"),
  distanceMiles: numeric("distance_miles", { precision: 6, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A post is either a lifting-session post OR an accessory-day post --
// exactly one of sessionId/accessoryDayEntryId is set, enforced at the
// application level (actions/sessions.ts, actions/accessory-days.ts)
// rather than a DB constraint. inolScore is null for accessory-day posts.
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id")
    .unique()
    .references(() => sessions.id, { onDelete: "cascade" }),
  accessoryDayEntryId: uuid("accessory_day_entry_id")
    .unique()
    .references(() => accessoryDayEntries.id, { onDelete: "cascade" }),
  inolScore: numeric("inol_score", { precision: 6, scale: 3 }),
  caption: text("caption"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Up to 3 photos per post (enforced in actions/posts.ts, not here).
// photoUrl is this app's own /api/photos serving route, not the blob's own
// URL -- the Blob store is private, so photos are streamed back through
// that route rather than linked to directly. createdAt orders the gallery.
export const postPhotos = pgTable("post_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Personal records hit in a post's session, snapshotted at creation time
// (see lib/prs.ts for the estimated-1RM comparison that produces these).
export const postPrs = pgTable("post_prs", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  liftName: text("lift_name").notNull(),
  weight: numeric("weight", { precision: 6, scale: 2 }).notNull(),
  reps: integer("reps").notNull(),
  estimatedOneRepMax: numeric("estimated_one_rep_max", { precision: 6, scale: 2 }).notNull(),
});

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
