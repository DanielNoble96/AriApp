CREATE TYPE "public"."body_region" AS ENUM('upper', 'lower');--> statement-breakpoint
CREATE TYPE "public"."cycle_status" AS ENUM('active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."lift_role" AS ENUM('main', 'assistance', 'accessory');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."set_type" AS ENUM('warmup', 'main', 'assistance', 'accessory');--> statement-breakpoint
CREATE TABLE "cycle_assistance_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"lift_id" uuid NOT NULL,
	"percentage_of_tm" numeric(5, 2) NOT NULL,
	CONSTRAINT "cycle_assistance_config_cycle_id_lift_id_unique" UNIQUE("cycle_id","lift_id")
);
--> statement-breakpoint
CREATE TABLE "cycle_lift_tms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"lift_id" uuid NOT NULL,
	"starting_tm" numeric(6, 2) NOT NULL,
	"ending_tm" numeric(6, 2),
	CONSTRAINT "cycle_lift_tms_cycle_id_lift_id_unique" UNIQUE("cycle_id","lift_id")
);
--> statement-breakpoint
CREATE TABLE "cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cycle_number" integer NOT NULL,
	"status" "cycle_status" DEFAULT 'active' NOT NULL,
	"main_wave_config" jsonb NOT NULL,
	"warmup_scheme_config" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "cycles_user_id_cycle_number_unique" UNIQUE("user_id","cycle_number")
);
--> statement-breakpoint
CREATE TABLE "lifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"program_day_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"role" "lift_role" NOT NULL,
	"body_region" "body_region",
	"order_in_day" integer NOT NULL,
	"current_training_max" numeric(6, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lifts_user_id_slug_unique" UNIQUE("user_id","slug")
);
--> statement-breakpoint
CREATE TABLE "program_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "program_days_user_id_day_number_unique" UNIQUE("user_id","day_number")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"week_number" integer NOT NULL,
	"sequence_index" integer NOT NULL,
	"status" "session_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "sessions_cycle_id_sequence_index_unique" UNIQUE("cycle_id","sequence_index")
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"lift_id" uuid NOT NULL,
	"set_type" "set_type" NOT NULL,
	"order_index" integer NOT NULL,
	"is_amrap" boolean DEFAULT false NOT NULL,
	"target_weight" numeric(6, 2),
	"target_reps" integer,
	"actual_weight" numeric(6, 2),
	"actual_reps" integer,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "cycle_assistance_config" ADD CONSTRAINT "cycle_assistance_config_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_assistance_config" ADD CONSTRAINT "cycle_assistance_config_lift_id_lifts_id_fk" FOREIGN KEY ("lift_id") REFERENCES "public"."lifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_lift_tms" ADD CONSTRAINT "cycle_lift_tms_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_lift_tms" ADD CONSTRAINT "cycle_lift_tms_lift_id_lifts_id_fk" FOREIGN KEY ("lift_id") REFERENCES "public"."lifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifts" ADD CONSTRAINT "lifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifts" ADD CONSTRAINT "lifts_program_day_id_program_days_id_fk" FOREIGN KEY ("program_day_id") REFERENCES "public"."program_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_days" ADD CONSTRAINT "program_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sets" ADD CONSTRAINT "sets_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sets" ADD CONSTRAINT "sets_lift_id_lifts_id_fk" FOREIGN KEY ("lift_id") REFERENCES "public"."lifts"("id") ON DELETE cascade ON UPDATE no action;