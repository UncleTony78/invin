import "server-only";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { formatMoney, type Currency } from "@/lib/format";
import { formatDate, isoDate } from "@/lib/invoice-math";
import { runDate, withinEnd, type Frequency } from "@/lib/schedule";
import { issueInvoice, remindCustomer, sendReceipt, today, type Actor } from "./billing";
import { appUrl, sendEmail } from "./email";
import { draftReadyNotice } from "./email-templates";

/*
 * "Runs itself": everything InVin does without being asked.
 * Called by the scheduler (dev: instrumentation.ts every minute; production: /api/cron).
 * Each job is idempotent, so running it twice, or late, never doubles anything.
 */

const SYSTEM: Actor = { actorType: "system", actorId: null, actorLabel: "InVin" };
const SERIES: Actor = { actorType: "system", actorId: null, actorLabel: "Recurring series" };

let running = false;

export async function runDueWork(now = new Date()) {
  if (running) return { skipped: true };
  running = true;
  try {
    const day = isoDate(now);
    const recurring = await runRecurring(day);
    const reminders = await runReminders(day);
    const receipts = await runReceipts(now);
    return { recurring, reminders, receipts };
  } finally {
    running = false;
  }
}

/* ---------------- Recurring series ---------------- */

/** Make every invoice that's due today (or was missed while the app was off). */
export async function runRecurring(day: string) {
  const due = await db.select().from(s.series).where(and(eq(s.series.status, "active"), lte(s.series.nextRun, day)));
  let made = 0;
  for (const row of due) {
    // Catch up at most a few runs; a long outage shouldn't flood a customer
    for (let guard = 0; guard < 3; guard++) {
      const [cur] = await db.select().from(s.series).where(eq(s.series.id, row.id));
      if (!cur || cur.status !== "active" || !cur.nextRun || cur.nextRun > day) break;
      await runSeriesOnce(cur.id, { runDate: cur.nextRun });
      made++;
    }
  }
  return made;
}

/**
 * Make the next invoice in a series now. Used by the runner and by "Create next invoice now".
 * Claims the run first (runIndex moves on) so two runners can't both make it.
 */
export async function runSeriesOnce(seriesId: string, o: { runDate?: string; actor?: Actor } = {}) {
  const [cur] = await db.select().from(s.series).where(eq(s.series.id, seriesId));
  if (!cur || cur.status === "ended") return null;
  const freq = cur.frequency as Frequency;
  const end = { endAfter: cur.endAfter, endOn: cur.endOn };
  const issue = o.runDate ?? today();
  const nextIndex = cur.runIndex + 1;
  // "After N invoices" counts invoices made; "on a date" checks the next slot. Skips use up neither.
  const hasNext = withinEnd(cur.anchorDate, freq, nextIndex, { endAfter: null, endOn: end.endOn }) && !(cur.endAfter != null && cur.invoicesMade + 1 >= cur.endAfter);
  const claimed = await db
    .update(s.series)
    .set({ runIndex: nextIndex, nextRun: hasNext ? runDate(cur.anchorDate, freq, nextIndex) : null, status: hasNext ? cur.status : "ended", invoicesMade: sql`${s.series.invoicesMade} + 1`, lastError: null })
    .where(and(eq(s.series.id, cur.id), eq(s.series.runIndex, cur.runIndex)))
    .returning();
  if (!claimed.length) return null;

  const [[ws], [customer]] = await Promise.all([
    db.select().from(s.workspaces).where(eq(s.workspaces.id, cur.workspaceId)),
    db.select().from(s.customers).where(eq(s.customers.id, cur.customerId)),
  ]);
  try {
    const r = await issueInvoice({
      ws, customer, mode: cur.mode === "draft" ? "draft" : "send", actor: o.actor ?? SERIES, createdBy: cur.createdBy, seriesId: cur.id,
      createdTitle: o.actor ? "Invoice created from its recurring series" : "Created automatically by its recurring series",
      input: {
        customerId: customer.id, issueDate: issue, termsDays: cur.termsDays, category: cur.category, vatBps: cur.vatBps, note: cur.note,
        template: cur.template, brandColor: cur.brandColor, bankAccountId: cur.bankAccountId ?? "", lines: cur.lines,
      },
    });
    if (cur.mode === "draft") {
      const mail = draftReadyNotice({ number: r.number, customer: customer.name, amount: formatMoney(r.total / 100, customer.currency as Currency), url: `${appUrl()}/invoices/${r.number}/edit` });
      await sendEmail({ workspaceId: ws.id, invoiceId: r.id, to: ws.email, ...mail });
    }
    return r;
  } catch (e) {
    await db.update(s.series).set({ lastError: e instanceof Error ? e.message : String(e) }).where(eq(s.series.id, cur.id));
    throw e;
  }
}

/* ---------------- Reminders ---------------- */

/** Send each step of the workspace's reminder schedule once per unpaid invoice. */
export async function runReminders(day: string) {
  const open = await db
    .select({ inv: s.invoices, ws: s.workspaces, customer: s.customers })
    .from(s.invoices)
    .innerJoin(s.workspaces, eq(s.workspaces.id, s.invoices.workspaceId))
    .innerJoin(s.customers, eq(s.customers.id, s.invoices.customerId))
    .where(and(inArray(s.invoices.status, ["sent", "viewed", "partial"]), eq(s.invoices.remindersPaused, false), eq(s.customers.remindersPaused, false), eq(s.workspaces.remindersOn, true)));
  if (!open.length) return 0;
  const sentLog = await db.select().from(s.reminderLog).where(inArray(s.reminderLog.invoiceId, open.map((o) => o.inv.id)));
  let sent = 0;
  for (const { inv, ws, customer } of open) {
    if (!inv.dueDate) continue;
    const step = reminderDueToday(inv.dueDate, ws.reminderOffsets, day, inv.sentAt);
    if (step == null || sentLog.some((l) => l.invoiceId === inv.id && l.offsetDays === step)) continue;
    // Log first: the unique index makes this the lock, so a step can never be sent twice
    const claimed = await db.insert(s.reminderLog).values({ invoiceId: inv.id, offsetDays: step }).onConflictDoNothing().returning();
    if (!claimed.length) continue;
    await remindCustomer({ ws, inv, customer, actor: SYSTEM, sender: ws.name, title: `Automatic reminder sent to ${customer.email} (${stepLabel(step)})` });
    sent++;
  }
  return sent;
}

/**
 * The schedule step that falls today, or yesterday if the runner missed a day.
 * Steps from before the invoice was sent are skipped, so a late invoice doesn't get a burst of reminders.
 */
export function reminderDueToday(dueDate: string, offsets: number[], day: string, sentAt: Date | null) {
  const sentDay = sentAt ? isoDate(sentAt) : null;
  const yesterday = shift(day, -1);
  for (const off of [...offsets].sort((a, b) => b - a)) {
    const when = shift(dueDate, off);
    if ((when === day || when === yesterday) && (!sentDay || when > sentDay)) return off;
  }
  return null;
}

/** When the next automatic reminder will go, for showing in the invoice panel. */
export function nextReminder(dueDate: string | null, offsets: number[], day: string, sentSteps: number[]) {
  if (!dueDate) return null;
  for (const off of [...offsets].sort((a, b) => a - b)) {
    const when = shift(dueDate, off);
    if (when >= day && !sentSteps.includes(off)) return { date: when, offset: off };
  }
  return null;
}

const stepLabel = (off: number) => (off === 0 ? "due today" : off < 0 ? `${-off} day${off === -1 ? "" : "s"} before due` : `${off} day${off === 1 ? "" : "s"} late`);

function shift(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}

/* ---------------- Receipts ---------------- */

/** Receipts for payments recorded at least a minute ago (Undo deletes the payment before then). */
export async function runReceipts(now: Date) {
  const cutoff = new Date(now.getTime() - 60_000);
  const due = await db.select({ id: s.payments.id }).from(s.payments).where(and(eq(s.payments.receiptDue, true), lte(s.payments.createdAt, cutoff)));
  for (const p of due) await sendReceipt(p.id, SYSTEM);
  return due.length;
}

export const describeRun = (d: string) => formatDate(d, { year: true });
