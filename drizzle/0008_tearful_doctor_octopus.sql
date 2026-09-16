CREATE TYPE "public"."accessory_activity_type" AS ENUM('run', 'bike', 'swim', 'walk', 'yoga', 'pilates', 'tennis', 'pickleball', 'paddle', 'trail_run');--> statement-breakpoint
CREATE TABLE "accessory_day_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"activity_type" "accessory_activity_type" NOT NULL,
	"duration_minutes" integer,
	"distance_miles" numeric(6, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "inol_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "accessory_day_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "accessory_day_entries" ADD CONSTRAINT "accessory_day_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessory_day_entries" ADD CONSTRAINT "accessory_day_entries_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_accessory_day_entry_id_accessory_day_entries_id_fk" FOREIGN KEY ("accessory_day_entry_id") REFERENCES "public"."accessory_day_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_accessory_day_entry_id_unique" UNIQUE("accessory_day_entry_id");