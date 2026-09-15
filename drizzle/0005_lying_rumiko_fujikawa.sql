ALTER TABLE "sets" ADD COLUMN "is_extra" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sets" ADD COLUMN "intensity_percentage" numeric(5, 2);