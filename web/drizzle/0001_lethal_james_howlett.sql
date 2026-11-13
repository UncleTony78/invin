CREATE TYPE "public"."claim_status" AS ENUM('pending', 'confirmed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('held', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "payment_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"paid_on" date NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "status" "email_status" DEFAULT 'held' NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "delivered_to" text;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "provider_id" text;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;