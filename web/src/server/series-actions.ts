"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { amountProblem, computeTotals } from "@/lib/invoice-math";
import { runDate, type Frequency } from "@/lib/schedule";
import { issueInvoice, rememberCategory, today, type InvoiceInput } from "./billing";
import { runSeriesOnce } from "./automation";
import { requireSession } from "./session";

const refresh = () => revalidatePath("/", "layout");
type Session = Awaited<ReturnType<typeof requireSession>>;
const actor = (session: Session) => ({ actorType: "member" as const, actorId: session.member.id, actorLabel: session.member.name });

export type Schedule = { frequency: Frequency; endAfter: number | null; endOn: string | null; mode: "send" | "draft" };

function checkSchedule(sc: Schedule, start: string): string | null {
  if (!["weekly", "monthly", "quarterly", "yearly"].includes(sc.frequency)) return "Choose how often it repeats.";
  if (sc.endAfter != null && (!Number.isInteger(sc.endAfter) || sc.endAfter < 1 || sc.endAfter > 500)) return "Choose how many invoices, between 1 and 500.";
  if (sc.endOn && sc.endOn <= start) return "The end date has to be after the first invoice.";
  if (!["send", "draft"].includes(sc.mode)) return "Choose what happens on each run.";
  return null;
}

async function ownSeries(id: string) {
  const session = await requireSession();
  const [row] = await db.select().from(s.series).where(and(eq(s.series.id, id), eq(s.series.workspaceId, session.workspace.id)));
  if (!row) throw new Error("Series not found");
  return { session, row };
}

async function logOnLatest(seriesId: string, workspaceId: string, session: Session, title: string) {
  const [last] = await db.select({ id: s.invoices.id }).from(s.invoices).where(eq(s.invoices.seriesId, seriesId)).orderBy(desc(s.invoices.createdAt)).limit(1);
  if (last) await db.insert(s.events).values({ workspaceId, invoiceId: last.id, ...actor(session), title });
}

/** New invoice from the editor with "Repeat" on: makes this invoice now, then the series carries on from it. */
export async function createRecurringInvoice(input: InvoiceInput, mode: "draft" | "send", schedule: Schedule) {
  const session = await requireSession();
  const [customer] = await db.select().from(s.customers).where(and(eq(s.customers.id, input.customerId), eq(s.customers.workspaceId, session.workspace.id)));
  if (!customer) return { ok: false as const, error: "Choose a customer first." };
  const lines = input.lines.filter((l) => l.description.trim() || l.unitPrice > 0);
  if (!lines.some((l) => l.unitPrice > 0)) return { ok: false as const, error: "Add a price to at least one item." };
  const tooBig = amountProblem(lines, input.vatBps);
  if (tooBig) return { ok: false as const, error: tooBig };
  const start = input.issueDate || today();
  const problem = checkSchedule(schedule, start);
  if (problem) return { ok: false as const, error: problem };

  const [row] = await db
    .insert(s.series)
    .values({
      workspaceId: session.workspace.id, customerId: customer.id, frequency: schedule.frequency, anchorDate: start, runIndex: 1, invoicesMade: 1,
      nextRun: schedule.endAfter === 1 ? null : runDate(start, schedule.frequency, 1), status: schedule.endAfter === 1 ? "ended" : "active",
      endAfter: schedule.endAfter, endOn: schedule.endOn, mode: schedule.mode, category: input.category || "General", termsDays: input.termsDays,
      vatBps: input.vatBps, note: input.note, template: input.template, brandColor: input.brandColor, bankAccountId: input.bankAccountId || null,
      lines, total: computeTotals(lines, input.vatBps).total, createdBy: session.member.id,
    })
    .returning();
  const r = await issueInvoice({ ws: session.workspace, customer, input, mode, actor: actor(session), createdBy: session.member.id, seriesId: row.id, createdTitle: "Invoice created · first of a recurring series" });
  refresh();
  return { ok: true as const, id: r.id, number: r.number, delivery: r.delivery, seriesId: row.id };
}

/** "Make recurring" on an existing invoice: it becomes the first in the series. */
export async function makeRecurring(invoiceId: string, schedule: Schedule) {
  const session = await requireSession();
  const [inv] = await db.select().from(s.invoices).where(and(eq(s.invoices.id, invoiceId), eq(s.invoices.workspaceId, session.workspace.id)));
  if (!inv) return { ok: false as const, error: "Invoice not found." };
  if (inv.seriesId) return { ok: false as const, error: "This invoice already repeats." };
  const start = inv.issueDate ?? today();
  const problem = checkSchedule(schedule, start);
  if (problem) return { ok: false as const, error: problem };
  const lines = await db.select().from(s.lineItems).where(eq(s.lineItems.invoiceId, inv.id)).orderBy(s.lineItems.position);
  let index = 1;
  // If the invoice is old, start from the next date that's still ahead
  while (runDate(start, schedule.frequency, index) < today()) index++;
  const [row] = await db
    .insert(s.series)
    .values({
      workspaceId: session.workspace.id, customerId: inv.customerId, frequency: schedule.frequency, anchorDate: start, runIndex: index, invoicesMade: 1,
      nextRun: schedule.endAfter === 1 ? null : runDate(start, schedule.frequency, index), status: schedule.endAfter === 1 ? "ended" : "active",
      endAfter: schedule.endAfter, endOn: schedule.endOn, mode: schedule.mode, category: inv.category, termsDays: inv.termsDays, vatBps: inv.vatBps,
      note: inv.note, template: inv.template, brandColor: inv.brandColor, bankAccountId: inv.bankAccountId,
      lines: lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })), total: inv.total, createdBy: session.member.id,
    })
    .returning();
  await db.update(s.invoices).set({ seriesId: row.id }).where(eq(s.invoices.id, inv.id));
  await db.insert(s.events).values({ workspaceId: session.workspace.id, invoiceId: inv.id, ...actor(session), title: "Made recurring", note: `Next invoice ${row.nextRun ?? "none"}` });
  refresh();
  return { ok: true as const, seriesId: row.id, nextRun: row.nextRun };
}

/** Change how often it repeats, when it ends, or whether it sends by itself. Already-made invoices stay as they are. */
export async function updateSchedule(id: string, sc: Schedule) {
  const { session, row } = await ownSeries(id);
  if (row.status === "ended") return { ok: false as const, error: "This series has ended. Start a new one instead." };
  const from = row.nextRun && row.nextRun > today() ? row.nextRun : today();
  const problem = checkSchedule(sc, from);
  if (problem) return { ok: false as const, error: problem };
  const changedFreq = sc.frequency !== row.frequency;
  // A new frequency starts from the next run date, so nothing jumps backwards
  const anchor = changedFreq ? from : row.anchorDate;
  const index = changedFreq ? 0 : row.runIndex;
  const ends = sc.endAfter != null && row.invoicesMade >= sc.endAfter;
  await db
    .update(s.series)
    .set({ frequency: sc.frequency, anchorDate: anchor, runIndex: index, nextRun: ends ? null : runDate(anchor, sc.frequency, index), endAfter: sc.endAfter, endOn: sc.endOn, mode: sc.mode, status: ends ? "ended" : row.status })
    .where(eq(s.series.id, row.id));
  await logOnLatest(row.id, session.workspace.id, session, "Recurring schedule changed");
  refresh();
  return { ok: true as const };
}

/** Edit what future invoices contain. Invoices already made are never touched. */
export async function updateSeriesInvoice(id: string, input: InvoiceInput) {
  const { session, row } = await ownSeries(id);
  const [customer] = await db.select().from(s.customers).where(and(eq(s.customers.id, input.customerId), eq(s.customers.workspaceId, session.workspace.id)));
  if (!customer) return { ok: false as const, error: "Choose a customer first." };
  const lines = input.lines.filter((l) => l.description.trim() || l.unitPrice > 0);
  if (!lines.some((l) => l.unitPrice > 0)) return { ok: false as const, error: "Add a price to at least one item." };
  const tooBig = amountProblem(lines, input.vatBps);
  if (tooBig) return { ok: false as const, error: tooBig };
  await db
    .update(s.series)
    .set({
      customerId: customer.id, category: input.category || "General", termsDays: input.termsDays, vatBps: input.vatBps, note: input.note, template: input.template,
      brandColor: input.brandColor, bankAccountId: input.bankAccountId || null, lines, total: computeTotals(lines, input.vatBps).total,
    })
    .where(eq(s.series.id, row.id));
  await rememberCategory(db, session.workspace, input.category);
  await logOnLatest(row.id, session.workspace.id, session, "Future recurring invoices edited");
  refresh();
  return { ok: true as const };
}

export async function pauseSeries(id: string) {
  const { session, row } = await ownSeries(id);
  if (row.status !== "active") return { ok: false as const };
  await db.update(s.series).set({ status: "paused" }).where(eq(s.series.id, row.id));
  await logOnLatest(row.id, session.workspace.id, session, "Recurring series paused");
  refresh();
  return { ok: true as const };
}

/** Resume. Dates missed while paused are skipped, never sent late in a burst. */
export async function resumeSeries(id: string) {
  const { session, row } = await ownSeries(id);
  if (row.status !== "paused") return { ok: false as const };
  const freq = row.frequency as Frequency;
  let index = row.runIndex;
  const missed: string[] = [];
  while (runDate(row.anchorDate, freq, index) < today()) missed.push(runDate(row.anchorDate, freq, index++));
  const next = runDate(row.anchorDate, freq, index);
  const ended = row.endOn != null && next > row.endOn;
  await db.update(s.series).set({ status: ended ? "ended" : "active", runIndex: index, nextRun: ended ? null : next, skipped: [...row.skipped, ...missed] }).where(eq(s.series.id, row.id));
  await logOnLatest(row.id, session.workspace.id, session, "Recurring series resumed");
  refresh();
  return { ok: true as const, nextRun: ended ? null : next, missed: missed.length };
}

export async function endSeries(id: string) {
  const { session, row } = await ownSeries(id);
  await db.update(s.series).set({ status: "ended", nextRun: null }).where(eq(s.series.id, row.id));
  await logOnLatest(row.id, session.workspace.id, session, "Recurring series ended");
  refresh();
  return { ok: true as const };
}

/** Skip the next run only. Returns what Undo needs. */
export async function skipNext(id: string) {
  const { row } = await ownSeries(id);
  if (row.status !== "active" || !row.nextRun) return { ok: false as const };
  const freq = row.frequency as Frequency;
  const index = row.runIndex + 1;
  const next = runDate(row.anchorDate, freq, index);
  const ended = row.endOn != null && next > row.endOn;
  await db.update(s.series).set({ runIndex: index, nextRun: ended ? null : next, status: ended ? "ended" : "active", skipped: [...row.skipped, row.nextRun] }).where(eq(s.series.id, row.id));
  refresh();
  return { ok: true as const, skippedDate: row.nextRun, nextRun: ended ? null : next };
}

export async function undoSkip(id: string, skippedDate: string) {
  const { row } = await ownSeries(id);
  if (!row.skipped.includes(skippedDate) || row.runIndex < 1) return;
  await db
    .update(s.series)
    .set({ runIndex: row.runIndex - 1, nextRun: skippedDate, status: "active", skipped: row.skipped.filter((d) => d !== skippedDate) })
    .where(eq(s.series.id, row.id));
  refresh();
}

/** Make the next invoice now instead of waiting for its date. */
export async function runNow(id: string) {
  const { session, row } = await ownSeries(id);
  if (row.status === "ended") return { ok: false as const, error: "This series has ended." };
  const r = await runSeriesOnce(row.id, { runDate: today(), actor: actor(session) });
  refresh();
  if (!r) return { ok: false as const, error: "Couldn't make the invoice. Try again." };
  return { ok: true as const, id: r.id, number: r.number, mode: row.mode, delivery: r.delivery };
}
