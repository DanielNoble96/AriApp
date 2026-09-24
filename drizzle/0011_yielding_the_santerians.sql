ALTER TYPE "public"."accessory_activity_type" ADD VALUE 'skiing';--> statement-breakpoint
ALTER TYPE "public"."accessory_activity_type" ADD VALUE 'snowboarding';--> statement-breakpoint
ALTER TYPE "public"."accessory_activity_type" ADD VALUE 'hiking';--> statement-breakpoint
ALTER TYPE "public"."accessory_activity_type" ADD VALUE 'other';--> statement-breakpoint
ALTER TABLE "accessory_day_entries" ADD COLUMN "custom_activity_name" text;