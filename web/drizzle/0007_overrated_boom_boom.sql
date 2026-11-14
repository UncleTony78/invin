CREATE TABLE "estimates" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"number" text NOT NULL,
	"customer_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"issue_date" date,
	"valid_days" integer DEFAULT 30 NOT NULL,
	"valid_until" date,
	"template" text DEFAULT 'stacked' NOT NULL,
	"brand_color" text DEFAULT '#0E5A52' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"vat_bps" integer DEFAULT 0 NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"public_token" text NOT NULL,
	"customer_snapshot" jsonb,
	"accepted_by" text,
	"accepted_at" timestamp with time zone,
	"decline_reason" text,
	"deposit_bps" integer,
	"deposit_invoice_id" text,
	"invoice_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "estimate_id" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "estimate_prefix" text DEFAULT 'EST-' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "next_estimate" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "estimates_ws_number" ON "estimates" USING btree ("workspace_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "estimates_token" ON "estimates" USING btree ("public_token");