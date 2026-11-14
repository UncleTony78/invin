ALTER TABLE "members" ADD COLUMN "digest" text DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "digest_sent_at" timestamp with time zone;