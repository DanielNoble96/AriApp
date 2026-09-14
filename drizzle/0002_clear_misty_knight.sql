CREATE TYPE "public"."equipment_type" AS ENUM('barbell', 'dumbbell', 'machine');--> statement-breakpoint
ALTER TABLE "lifts" ADD COLUMN "equipment_type" "equipment_type";