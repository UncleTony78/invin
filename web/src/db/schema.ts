/* InVin data model (Phase 1). Money is always integer minor units + a currency code. */
import { bigint, boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const minor = (name: string) => bigint(name, { mode: "number" }).notNull().default(0);

export const roleEnum = pgEnum("role", ["owner", "admin", "member"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "scheduled", "sent", "viewed", "partial", "paid", "cancelled"]);
export const actorTypeEnum = pgEnum("actor_type", ["member", "agent", "system", "customer"]);
export const pinKindEnum = pgEnum("pin_kind", ["invoice", "view", "customer"]);

/* ---------- Sign-in (Better Auth core tables) ---------- */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Answers from the welcome chat, saved one at a time so a refresh picks up where they left off. */
export const onboarding = pgTable("onboarding", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  mark: text("mark").notNull(),
  address: text("address").notNull().default(""),
  email: text("email").notNull(),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  brandColor: text("brand_color").notNull().default("#0E5A52"),
  template: text("template").notNull().default("stacked"),
  numberPrefix: text("number_prefix").notNull().default("INV-"),
  nextNumber: integer("next_number").notNull().default(1),
  /* Sending from your own domain (Resend). Status: none | pending | verified | failed */
  sendingDomain: text("sending_domain"),
  domainId: text("domain_id"),
  domainStatus: text("domain_status").notNull().default("none"),
  domainRecords: jsonb("domain_records").$type<{ type: string; name: string; value: string; status: string }[]>().notNull().default([]),
  /** The address emails come from once the domain is verified, e.g. invoices@studio.com */
  fromEmail: text("from_email"),
  estimatePrefix: text("estimate_prefix").notNull().default("EST-"),
  nextEstimate: integer("next_estimate").notNull().default(1),
  /** What they invoice for, from the welcome chat (e.g. "Design"). Seeds the default invoice category. */
  work: text("work").notNull().default(""),
  /** The categories this workspace bills under, in the order they were added */
  categories: jsonb("categories").$type<string[]>().notNull().default(["General"]),
  /** Extra fields on every invoice, e.g. "PO number". `print` decides if customers see it. */
  customFields: jsonb("custom_fields").$type<{ id: string; label: string; print: boolean }[]>().notNull().default([]),
  /* Automation (Phase 2) */
  remindersOn: boolean("reminders_on").notNull().default(true),
  /** Days relative to the due date: -3 = three days before, 0 = on the day, 7 = a week late */
  reminderOffsets: jsonb("reminder_offsets").$type<number[]>().notNull().default([-3, 0, 3, 7, 14]),
  receiptsOn: boolean("receipts_on").notNull().default(true),
  createdAt: createdAt(),
});

export const members = pgTable("members", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: roleEnum("role").notNull().default("member"),
  /** The sign-in identity behind this seat. Null for seats invited but not yet joined. */
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  /** Email summary of the workspace: off | daily | weekly (Monday mornings) */
  digest: text("digest").notNull().default("weekly"),
  digestSentAt: timestamp("digest_sent_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const customers = pgTable(
  "customers",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    address: text("address").notNull().default(""),
    currency: text("currency").notNull(),
    termsDays: integer("terms_days").notNull().default(14),
    remindersPaused: boolean("reminders_paused").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("customers_ws").on(t.workspaceId)],
);

export const bankAccounts = pgTable("bank_accounts", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  bank: text("bank").notNull(),
  /** Printed rows, e.g. [["Account number","…"],["Sort code","…"]] */
  rows: jsonb("rows").$type<[string, string][]>().notNull(),
});

export const catalogItems = pgTable("catalog_items", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  unitPrice: minor("unit_price"),
  currency: text("currency").notNull(),
  unit: text("unit").notNull().default("item"),
  createdAt: createdAt(),
});

export type CustomerSnapshot = { name: string; email: string; address: string };

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    customerId: text("customer_id").notNull().references(() => customers.id),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    currency: text("currency").notNull(),
    category: text("category").notNull().default("General"),
    issueDate: date("issue_date", { mode: "string" }),
    dueDate: date("due_date", { mode: "string" }),
    termsDays: integer("terms_days").notNull().default(14),
    template: text("template").notNull().default("stacked"),
    brandColor: text("brand_color").notNull().default("#0E5A52"),
    bankAccountId: text("bank_account_id").references(() => bankAccounts.id),
    note: text("note").notNull().default(""),
    /** VAT in basis points: 750 = 7.5% */
    vatBps: integer("vat_bps").notNull().default(0),
    subtotal: minor("subtotal"),
    tax: minor("tax"),
    total: minor("total"),
    amountPaid: minor("amount_paid"),
    publicToken: text("public_token").notNull().$defaultFn(() => crypto.randomUUID().replace(/-/g, "")),
    /** Customer details frozen when sent, so later edits don't rewrite history */
    customerSnapshot: jsonb("customer_snapshot").$type<CustomerSnapshot>(),
    createdBy: text("created_by"),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** Set when a recurring series made this invoice */
    seriesId: text("series_id"),
    /** Free labels for finding and grouping, e.g. "Q4", "Website project" */
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    /** Values for the workspace's custom fields, by field id */
    fields: jsonb("fields").$type<Record<string, string>>().notNull().default({}),
    remindersPaused: boolean("reminders_paused").notNull().default(false),
  },
  (t) => [uniqueIndex("invoices_ws_number").on(t.workspaceId, t.number), uniqueIndex("invoices_token").on(t.publicToken), index("invoices_ws_status").on(t.workspaceId, t.status)],
);

export const lineItems = pgTable("line_items", {
  id: id(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  description: text("description").notNull().default(""),
  quantity: numeric("quantity", { precision: 12, scale: 2, mode: "number" }).notNull().default(1),
  unitPrice: minor("unit_price"),
});

export const payments = pgTable("payments", {
  id: id(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  amount: minor("amount"),
  method: text("method").notNull().default("Bank transfer"),
  receivedOn: date("received_on", { mode: "string" }).notNull(),
  reference: text("reference").notNull().default(""),
  recordedBy: text("recorded_by"),
  /** Receipts wait a minute so an undone payment never sends one */
  receiptDue: boolean("receipt_due").notNull().default(false),
  receiptSentAt: timestamp("receipt_sent_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const frequencyEnum = pgEnum("frequency", ["weekly", "monthly", "quarterly", "yearly"]);
export const seriesStatusEnum = pgEnum("series_status", ["active", "paused", "ended"]);

/** A recurring series: the invoice to repeat, and when. Each run makes an ordinary invoice with seriesId set. */
export const series = pgTable(
  "series",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull().references(() => customers.id),
    frequency: frequencyEnum("frequency").notNull().default("monthly"),
    /** The first run; later runs are counted from here so "the 31st" stays the last day of short months */
    anchorDate: date("anchor_date", { mode: "string" }).notNull(),
    /** How many runs have happened (sent, drafted or skipped). The next run is anchor + runIndex periods. */
    runIndex: integer("run_index").notNull().default(0),
    nextRun: date("next_run", { mode: "string" }),
    endAfter: integer("end_after"),
    endOn: date("end_on", { mode: "string" }),
    /** send = email it automatically; draft = make a draft for review */
    mode: text("mode").notNull().default("send"),
    status: seriesStatusEnum("status").notNull().default("active"),
    invoicesMade: integer("invoices_made").notNull().default(0),
    skipped: jsonb("skipped").$type<string[]>().notNull().default([]),
    /* The invoice to repeat */
    category: text("category").notNull().default("Retainer"),
    termsDays: integer("terms_days").notNull().default(14),
    vatBps: integer("vat_bps").notNull().default(0),
    note: text("note").notNull().default(""),
    template: text("template").notNull().default("stacked"),
    brandColor: text("brand_color").notNull().default("#0E5A52"),
    bankAccountId: text("bank_account_id"),
    lines: jsonb("lines").$type<{ description: string; quantity: number; unitPrice: number }[]>().notNull().default([]),
    total: minor("total"),
    lastError: text("last_error"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("series_ws").on(t.workspaceId), index("series_next").on(t.status, t.nextRun)],
);

/** One row per automatic reminder sent, so each step of the schedule fires once. */
export const reminderLog = pgTable(
  "reminder_log",
  {
    id: id(),
    invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    offsetDays: integer("offset_days").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reminder_once").on(t.invoiceId, t.offsetDays)],
);

/** Append-only record. Drives the activity timeline and notifications. */
export const events = pgTable(
  "events",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    /** Set for events on an estimate (no FK: estimates are defined after this table) */
    estimateId: text("estimate_id"),
    title: text("title").notNull(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id"),
    actorLabel: text("actor_label").notNull(),
    note: text("note"),
    /** Agent execution details: [label, value] rows */
    details: jsonb("details").$type<[string, string][]>(),
    createdAt: createdAt(),
  },
  (t) => [index("events_invoice").on(t.invoiceId, t.createdAt)],
);

export const pins = pgTable("pins", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  kind: pinKindEnum("kind").notNull(),
  ref: text("ref").notNull(),
  label: text("label").notNull(),
  position: integer("position").notNull().default(0),
});

export const emailStatusEnum = pgEnum("email_status", ["held", "sent", "failed"]);

/** Every email InVin sends (or would send), with its delivery result. */
export const outbox = pgTable("outbox", {
  id: id(),
  /** Null for account emails like sign-in codes */
  workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: emailStatusEnum("status").notNull().default("held"),
  /** Where it actually went (test mode redirects to one inbox) */
  deliveredTo: text("delivered_to"),
  providerId: text("provider_id"),
  error: text("error"),
  createdAt: createdAt(),
});

export const claimStatusEnum = pgEnum("claim_status", ["pending", "confirmed", "dismissed"]);

/** "I've paid" from the customer's invoice page. Never changes the invoice until the sender confirms. */
export const paymentClaims = pgTable("payment_claims", {
  id: id(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  amount: minor("amount"),
  paidOn: date("paid_on", { mode: "string" }).notNull(),
  reference: text("reference").notNull().default(""),
  note: text("note").notNull().default(""),
  status: claimStatusEnum("status").notNull().default("pending"),
  createdAt: createdAt(),
});

export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];
export type Invoice = typeof invoices.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Event = typeof events.$inferSelect;

/* ---------------- Phase 2b: notifications, refunds, credit ---------------- */

/** The in-app feed. Workspace-wide; each member's "seen up to" time decides what's unread. */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    /** viewed | claim | paid | overdue | recurring | failed | refund | credit */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    href: text("href"),
    /** Stops the same event being announced twice (e.g. "overdue:<invoice id>") */
    dedupe: text("dedupe"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_ws").on(t.workspaceId, t.createdAt), uniqueIndex("notifications_once").on(t.workspaceId, t.dedupe)],
);

export const notificationSeen = pgTable("notification_seen", {
  memberId: text("member_id").primaryKey().references(() => members.id, { onDelete: "cascade" }),
  seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Money given back on a payment. The invoice's amount paid goes down by the same amount. */
export const refunds = pgTable("refunds", {
  id: id(),
  paymentId: text("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  amount: minor("amount"),
  reason: text("reason").notNull().default(""),
  refundedOn: date("refunded_on", { mode: "string" }).notNull(),
  recordedBy: text("recorded_by"),
  createdAt: createdAt(),
});

/** Customer credit ledger, per currency: + when they overpay, - when it's used on an invoice. */
export const credits = pgTable(
  "credits",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("credits_customer").on(t.customerId, t.currency)],
);

/** A named filter on the invoice list, shared with the whole workspace. Can be pinned to the sidebar. */
export const savedViews = pgTable("saved_views", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** The built-in tab it starts from: all, open, overdue, drafts, scheduled, paid */
  base: text("base").notNull().default("all"),
  q: text("q").notNull().default(""),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  categories: jsonb("categories").$type<string[]>().notNull().default([]),
  createdBy: text("created_by"),
  createdAt: createdAt(),
});

/**
 * An estimate (quote). The customer accepts or declines it on its own page; accepted ones
 * become invoices in one click, either all at once or as a deposit invoice then the rest.
 * Status: draft | sent | viewed | accepted | declined | converted ("expired" is worked out from validUntil).
 */
export const estimates = pgTable(
  "estimates",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    customerId: text("customer_id").notNull().references(() => customers.id),
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull(),
    category: text("category").notNull().default("General"),
    issueDate: date("issue_date", { mode: "string" }),
    validDays: integer("valid_days").notNull().default(30),
    validUntil: date("valid_until", { mode: "string" }),
    template: text("template").notNull().default("stacked"),
    brandColor: text("brand_color").notNull().default("#0E5A52"),
    note: text("note").notNull().default(""),
    vatBps: integer("vat_bps").notNull().default(0),
    lines: jsonb("lines").$type<{ description: string; quantity: number; unitPrice: number }[]>().notNull().default([]),
    subtotal: minor("subtotal"),
    tax: minor("tax"),
    total: minor("total"),
    publicToken: text("public_token").notNull().$defaultFn(() => crypto.randomUUID().replace(/-/g, "")),
    customerSnapshot: jsonb("customer_snapshot").$type<{ name: string; email: string; address: string }>(),
    acceptedBy: text("accepted_by"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    declineReason: text("decline_reason"),
    /** Deposit as basis points of the total (5000 = 50%), when billed as deposit + rest */
    depositBps: integer("deposit_bps"),
    depositInvoiceId: text("deposit_invoice_id"),
    invoiceId: text("invoice_id"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("estimates_ws_number").on(t.workspaceId, t.number), uniqueIndex("estimates_token").on(t.publicToken)],
);

/** An invitation to join a workspace. The link works once, for the invited email, for 14 days. */
export const invites = pgTable(
  "invites",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: roleEnum("role").notNull().default("member"),
    token: text("token").notNull().$defaultFn(() => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16)),
    invitedBy: text("invited_by"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("invites_token").on(t.token), index("invites_ws").on(t.workspaceId)],
);
