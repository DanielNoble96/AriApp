ALTER TABLE "sessions" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "paused_seconds" integer DEFAULT 0 NOT NULL;