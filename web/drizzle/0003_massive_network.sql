CREATE TYPE "public"."frequency" AS ENUM('weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."series_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"offset_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"frequency" "frequency" DEFAULT 'monthly' NOT NULL,
	"anchor_date" date NOT NULL,
	"run_index" integer DEFAULT 0 NOT NULL,
	"next_run" date,
	"end_after" integer,
	"end_on" date,
	"mode" text DEFAULT 'send' NOT NULL,
	"status" "series_status" DEFAULT 'active' NOT NULL,
	"invoices_made" integer DEFAULT 0 NOT NULL,
	"skipped" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" text DEFAULT 'Retainer' NOT NULL,
	"terms_days" integer DEFAULT 14 NOT NULL,
	"vat_bps" integer DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"template" text DEFAULT 'stacked' NOT NULL,
	"brand_color" text DEFAULT '#0E5A52' NOT NULL,
	"bank_account_id" text,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "reminders_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "series_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "reminders_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "receipt_due" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "receipt_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "reminders_on" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "reminder_offsets" jsonb DEFAULT '[-3,0,3,7,14]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "receipts_on" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_once" ON "reminder_log" USING btree ("invoice_id","offset_days");--> statement-breakpoint
CREATE INDEX "series_ws" ON "series" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "series_next" ON "series" USING btree ("status","next_run");