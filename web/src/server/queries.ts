import "server-only";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { Status } from "@/components/invoice/status";
import { toHomeMinor, toUsdMinor } from "@/lib/fx";
import { describeSchedule, runDate, withinEnd, type Frequency } from "@/lib/schedule";
import { nextReminder } from "./automation";
import { isoDate } from "@/lib/invoice-math";
import { displayStatus, dueText, OPEN_STATUSES, type StoredStatus } from "@/lib/status";
import type { Session } from "./session";

export type InvoiceRow = {
  id: string;
  number: string;
  customer: string;
  customerId: string;
  category: string;
  currency: string;
  total: number;
  paid: number;
  left: number;
  stored: StoredStatus;
  status: Status;
  daysLate: number;
  due: string;
  issueDate: string | null;
  dueDate: string | null;
  tags: string[];
};

export const today = () => isoDate(new Date());

export async function listInvoices(session: Session): Promise<InvoiceRow[]> {
  const t = today();
  const rows = await db
    .select({ inv: s.invoices, customer: s.customers.name })
    .from(s.invoices)
    .innerJoin(s.customers, eq(s.customers.id, s.invoices.customerId))
    .where(eq(s.invoices.workspaceId, session.workspace.id))
    .orderBy(desc(s.invoices.number));
  return rows.map(({ inv, customer }) => {
    const d = displayStatus(inv.status, inv.dueDate, t);
    return {
      id: inv.id,
      number: inv.number,
      customer,
      customerId: inv.customerId,
      category: inv.category,
      currency: inv.currency,
      total: inv.total,
      paid: inv.amountPaid,
      left: Math.max(0, inv.total - inv.amountPaid),
      stored: inv.status,
      status: d.status,
      daysLate: d.daysLate,
      due: dueText(inv.status, inv.dueDate, t),
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      tags: inv.tags,
    };
  });
}

export type PipelineData = { draft: [number, number]; open: [number, number]; overdue: [number, number]; paid: [number, number] };

/** All money in the workspace's home currency (minor units): [amount, count] per segment. */
export function pipeline(rows: InvoiceRow[], paidThisMonthUsd: number, paidCount: number, home = "USD"): PipelineData {
  const sum = (f: (r: InvoiceRow) => boolean, v: (r: InvoiceRow) => number) => {
    const list = rows.filter(f);
    return [list.reduce((a, r) => a + toHomeMinor(v(r), r.currency, home), 0), list.length] as [number, number];
  };
  return {
    draft: sum((r) => r.status === "draft", (r) => r.total),
    open: sum((r) => OPEN_STATUSES.includes(r.stored) && r.status !== "overdue", (r) => r.left),
    overdue: sum((r) => r.status === "overdue", (r) => r.left),
    paid: [toHomeMinor(paidThisMonthUsd, "USD", home), paidCount],
  };
}

export async function paymentsSummary(session: Session) {
  const rows = await db
    .select({ amount: s.payments.amount, receivedOn: s.payments.receivedOn, currency: s.invoices.currency, invoiceId: s.payments.invoiceId })
    .from(s.payments)
    .innerJoin(s.invoices, eq(s.invoices.id, s.payments.invoiceId))
    .where(eq(s.invoices.workspaceId, session.workspace.id));
  const month = today().slice(0, 7);
  const thisMonth = rows.filter((r) => r.receivedOn.startsWith(month));
  const byMonth = new Map<string, number>();
  for (const r of rows) byMonth.set(r.receivedOn.slice(0, 7), (byMonth.get(r.receivedOn.slice(0, 7)) ?? 0) + toUsdMinor(r.amount, r.currency));
  return {
    paidThisMonthUsd: thisMonth.reduce((a, r) => a + toUsdMinor(r.amount, r.currency), 0),
    paidThisMonthCount: new Set(thisMonth.map((r) => r.invoiceId)).size,
    byMonth,
  };
}

export type ActorDTO = { type: "member" | "agent" | "system" | "customer"; label: string; email?: string; role?: string };
export type EventDTO = { id: string; at: string; title: string; actor: ActorDTO; note: string | null; details: [string, string][] | null };

export type InvoiceDetail = {
  row: InvoiceRow;
  invoice: { number: string; issueDate: string | null; dueDate: string | null; currency: string; vatBps: number; note: string; template: string; brandColor: string; publicToken: string; category: string; termsDays: number; bankAccountId: string | null };
  customer: { name: string; email: string; address: string };
  lines: { description: string; quantity: number; unitPrice: number }[];
  bank: { bank: string; rows: [string, string][] } | null;
  events: EventDTO[];
  business: { name: string; mark: string; address: string; email: string };
  pinned: boolean;
  claims: { id: string; amount: number; paidOn: string; reference: string; note: string }[];
  series: { id: string; label: string; nextRun: string | null; status: string } | null;
  reminders: { on: boolean; paused: boolean; customerPaused: boolean; next: { date: string; offset: number } | null };
  receiptsOn: boolean;
  lastPayment: { id: string; receiptSentAt: string | null; receiptDue: boolean } | null;
  payments: { id: string; amount: number; refunded: number; method: string; receivedOn: string; reference: string; receiptSentAt: string | null }[];
  /** The customer's credit in this invoice's currency */
  credit: number;
  tags: string[];
  /** Every tag used in the workspace, for suggestions */
  allTags: string[];
  fields: { id: string; label: string; print: boolean; value: string }[];
};

export async function getInvoiceDetail(session: Session, id: string): Promise<InvoiceDetail | null> {
  const [inv] = await db
    .select()
    .from(s.invoices)
    .where(and(or(eq(s.invoices.id, id), eq(s.invoices.number, id)), eq(s.invoices.workspaceId, session.workspace.id)));
  if (!inv) return null;
  const [[customer], lines, events, bank, members, pin, claims, seriesRows, remLog, pays, refundRows, [{ credit }]] = await Promise.all([
    db.select().from(s.customers).where(eq(s.customers.id, inv.customerId)),
    db.select().from(s.lineItems).where(eq(s.lineItems.invoiceId, inv.id)).orderBy(asc(s.lineItems.position)),
    db.select().from(s.events).where(eq(s.events.invoiceId, inv.id)).orderBy(desc(s.events.createdAt)),
    inv.bankAccountId ? db.select().from(s.bankAccounts).where(eq(s.bankAccounts.id, inv.bankAccountId)) : Promise.resolve([]),
    db.select().from(s.members).where(eq(s.members.workspaceId, session.workspace.id)),
    db.select().from(s.pins).where(and(eq(s.pins.memberId, session.member.id), eq(s.pins.kind, "invoice"), eq(s.pins.ref, inv.id))),
    db.select().from(s.paymentClaims).where(and(eq(s.paymentClaims.invoiceId, inv.id), eq(s.paymentClaims.status, "pending"))),
    inv.seriesId ? db.select().from(s.series).where(eq(s.series.id, inv.seriesId)) : Promise.resolve([]),
    db.select().from(s.reminderLog).where(eq(s.reminderLog.invoiceId, inv.id)),
    db.select().from(s.payments).where(eq(s.payments.invoiceId, inv.id)).orderBy(desc(s.payments.createdAt)),
    db.select().from(s.refunds).where(eq(s.refunds.invoiceId, inv.id)),
    db.select({ credit: sql<number>`coalesce(sum(${s.credits.amount}), 0)` }).from(s.credits).where(and(eq(s.credits.customerId, inv.customerId), eq(s.credits.currency, inv.currency))),
  ]);
  const sr = seriesRows[0];
  const t = today();
  const d = displayStatus(inv.status, inv.dueDate, t);
  const snap = inv.customerSnapshot ?? { name: customer.name, email: customer.email, address: customer.address };
  const ws = session.workspace;
  return {
    row: {
      id: inv.id, number: inv.number, customer: customer.name, customerId: customer.id, category: inv.category, currency: inv.currency,
      total: inv.total, paid: inv.amountPaid, left: Math.max(0, inv.total - inv.amountPaid), stored: inv.status, status: d.status, daysLate: d.daysLate,
      due: dueText(inv.status, inv.dueDate, t), issueDate: inv.issueDate, dueDate: inv.dueDate, tags: inv.tags,
    },
    invoice: { number: inv.number, issueDate: inv.issueDate, dueDate: inv.dueDate, currency: inv.currency, vatBps: inv.vatBps, note: inv.note, template: inv.template, brandColor: inv.brandColor, publicToken: inv.publicToken, category: inv.category, termsDays: inv.termsDays, bankAccountId: inv.bankAccountId },
    customer: snap,
    lines: lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })),
    bank: bank[0] ? { bank: bank[0].bank, rows: bank[0].rows } : null,
    events: events.map((e) => {
      const m = members.find((x) => x.id === e.actorId);
      return {
        id: e.id,
        at: e.createdAt.toISOString(),
        title: e.title,
        actor: { type: e.actorType, label: e.actorLabel, email: e.actorType === "member" ? m?.email : undefined, role: e.actorType === "member" ? m?.role : undefined },
        note: e.note,
        details: e.details,
      };
    }),
    business: { name: ws.name, mark: ws.mark, address: ws.address, email: ws.email },
    pinned: pin.length > 0,
    claims: claims.map((c) => ({ id: c.id, amount: c.amount, paidOn: c.paidOn, reference: c.reference, note: c.note })),
    series: sr ? { id: sr.id, label: describeSchedule(sr.anchorDate, sr.frequency as Frequency), nextRun: sr.nextRun, status: sr.status } : null,
    reminders: {
      on: ws.remindersOn,
      paused: inv.remindersPaused,
      customerPaused: customer.remindersPaused,
      next: OPEN_STATUSES.includes(inv.status) ? nextReminder(inv.dueDate, ws.reminderOffsets, t, remLog.map((l) => l.offsetDays)) : null,
    },
    receiptsOn: ws.receiptsOn,
    lastPayment: pays[0] ? { id: pays[0].id, receiptSentAt: pays[0].receiptSentAt?.toISOString() ?? null, receiptDue: pays[0].receiptDue } : null,
    payments: pays.map((p) => ({
      id: p.id, amount: p.amount, method: p.method, receivedOn: p.receivedOn, reference: p.reference, receiptSentAt: p.receiptSentAt?.toISOString() ?? null,
      refunded: refundRows.filter((r) => r.paymentId === p.id).reduce((a, r) => a + r.amount, 0),
    })),
    credit: Number(credit),
    tags: inv.tags,
    allTags: await workspaceTags(session),
    fields: ws.customFields.map((f) => ({ ...f, value: inv.fields[f.id] ?? "" })),
  };
}

export type PinDTO = { id: string; kind: "invoice" | "view" | "customer"; ref: string; label: string };
export async function listPins(session: Session): Promise<PinDTO[]> {
  const rows = await db.select().from(s.pins).where(eq(s.pins.memberId, session.member.id)).orderBy(asc(s.pins.position));
  return rows.map((p) => ({ id: p.id, kind: p.kind, ref: p.ref, label: p.label }));
}

export async function listCustomers(session: Session) {
  return db.select().from(s.customers).where(eq(s.customers.workspaceId, session.workspace.id)).orderBy(asc(s.customers.name));
}

export async function listBankAccounts(session: Session) {
  return db.select().from(s.bankAccounts).where(eq(s.bankAccounts.workspaceId, session.workspace.id));
}

export async function listCatalog(session: Session) {
  return db.select().from(s.catalogItems).where(eq(s.catalogItems.workspaceId, session.workspace.id)).orderBy(asc(s.catalogItems.name));
}

export async function invoiceIdsByNumber(session: Session, numbers: string[]) {
  if (!numbers.length) return [];
  return db.select({ id: s.invoices.id, number: s.invoices.number }).from(s.invoices).where(and(eq(s.invoices.workspaceId, session.workspace.id), inArray(s.invoices.number, numbers)));
}

/* ---------------- Customers ---------------- */
export type CustomerSummary = {
  id: string; name: string; email: string; address: string; currency: string; termsDays: number;
  outstanding: number; overdue: number; billed: number; invoices: number; lastInvoice: string | null; avgDaysToPay: number | null;
};

/** One pass over invoices + payments gives every customer's ledger numbers (in their own currency). */
export async function listCustomerSummaries(session: Session): Promise<CustomerSummary[]> {
  const [custs, rows, pays] = await Promise.all([
    listCustomers(session),
    listInvoices(session),
    db.select({ invoiceId: s.payments.invoiceId, receivedOn: s.payments.receivedOn }).from(s.payments)
      .innerJoin(s.invoices, eq(s.invoices.id, s.payments.invoiceId)).where(eq(s.invoices.workspaceId, session.workspace.id)),
  ]);
  const lastPay = new Map<string, string>();
  for (const p of pays) if (!lastPay.has(p.invoiceId) || p.receivedOn > lastPay.get(p.invoiceId)!) lastPay.set(p.invoiceId, p.receivedOn);
  return custs.map((c) => {
    const mine = rows.filter((r) => r.customerId === c.id && r.stored !== "draft" && r.stored !== "cancelled");
    const paidTimes = mine.filter((r) => r.stored === "paid" && r.issueDate && lastPay.has(r.id)).map((r) => {
      const [a, b] = [r.issueDate!, lastPay.get(r.id)!].map((x) => Date.parse(x));
      return Math.max(0, Math.round((b - a) / 86_400_000));
    });
    return {
      id: c.id, name: c.name, email: c.email, address: c.address, currency: c.currency, termsDays: c.termsDays,
      outstanding: mine.filter((r) => ["sent", "viewed", "partial"].includes(r.stored)).reduce((a, r) => a + r.left, 0),
      overdue: mine.filter((r) => r.status === "overdue").reduce((a, r) => a + r.left, 0),
      billed: mine.reduce((a, r) => a + r.total, 0),
      invoices: mine.length,
      lastInvoice: mine.map((r) => r.issueDate).filter(Boolean).sort().at(-1) ?? null,
      avgDaysToPay: paidTimes.length ? Math.round(paidTimes.reduce((a, b) => a + b, 0) / paidTimes.length) : null,
    };
  });
}

/* ---------------- Payments ledger ---------------- */
export type PaymentRow = { id: string; receivedOn: string; amount: number; currency: string; method: string; reference: string; invoiceId: string; number: string; customer: string; recordedBy: string };

export async function listPayments(session: Session): Promise<PaymentRow[]> {
  const rows = await db
    .select({ p: s.payments, number: s.invoices.number, currency: s.invoices.currency, customer: s.customers.name, invoiceId: s.invoices.id, member: s.members.name })
    .from(s.payments)
    .innerJoin(s.invoices, eq(s.invoices.id, s.payments.invoiceId))
    .innerJoin(s.customers, eq(s.customers.id, s.invoices.customerId))
    .leftJoin(s.members, eq(s.members.id, s.payments.recordedBy))
    .where(eq(s.invoices.workspaceId, session.workspace.id))
    .orderBy(desc(s.payments.receivedOn), desc(s.payments.createdAt));
  // Refunds sit in the same ledger as money going out (negative amounts), so totals are what you actually kept
  const refunds = await db
    .select({ r: s.refunds, number: s.invoices.number, currency: s.invoices.currency, customer: s.customers.name, invoiceId: s.invoices.id, member: s.members.name })
    .from(s.refunds)
    .innerJoin(s.invoices, eq(s.invoices.id, s.refunds.invoiceId))
    .innerJoin(s.customers, eq(s.customers.id, s.invoices.customerId))
    .leftJoin(s.members, eq(s.members.id, s.refunds.recordedBy))
    .where(eq(s.invoices.workspaceId, session.workspace.id));
  return [
    ...rows.map((r) => ({ id: r.p.id, receivedOn: r.p.receivedOn, amount: r.p.amount, currency: r.currency, method: r.p.method, reference: r.p.reference, invoiceId: r.invoiceId, number: r.number, customer: r.customer, recordedBy: r.member ?? "—" })),
    ...refunds.map((x) => ({ id: x.r.id, receivedOn: x.r.refundedOn, amount: -x.r.amount, currency: x.currency, method: "Refund", reference: x.r.reason, invoiceId: x.invoiceId, number: x.number, customer: x.customer, recordedBy: x.member ?? "—" })),
  ].sort((a, b) => b.receivedOn.localeCompare(a.receivedOn));
}

export async function catalogUsage(session: Session) {
  const rows = await db.select({ description: s.lineItems.description }).from(s.lineItems)
    .innerJoin(s.invoices, eq(s.invoices.id, s.lineItems.invoiceId)).where(eq(s.invoices.workspaceId, session.workspace.id));
  return (name: string) => rows.filter((r) => r.description.toLowerCase().startsWith(name.toLowerCase())).length;
}

/* ---------------- Recurring ---------------- */
export type SeriesRow = {
  id: string; customer: string; customerId: string; currency: string; total: number; schedule: string; ending: string; frequency: Frequency;
  nextRun: string | null; status: "active" | "paused" | "ended"; mode: string; invoicesMade: number; endAfter: number | null; endOn: string | null; lastError: string | null;
};

export async function listSeries(session: Session): Promise<SeriesRow[]> {
  const rows = await db
    .select({ sr: s.series, customer: s.customers.name, currency: s.customers.currency })
    .from(s.series)
    .innerJoin(s.customers, eq(s.customers.id, s.series.customerId))
    .where(eq(s.series.workspaceId, session.workspace.id))
    .orderBy(asc(s.series.nextRun));
  const order = { active: 0, paused: 1, ended: 2 };
  return rows
    .map(({ sr, customer, currency }) => toSeriesRow(sr, customer, currency))
    .sort((a, b) => order[a.status] - order[b.status]);
}

function toSeriesRow(sr: typeof s.series.$inferSelect, customer: string, currency: string): SeriesRow {
  const ending = sr.endAfter != null ? `${sr.invoicesMade} of ${sr.endAfter}` : sr.endOn ? `Until ${sr.endOn}` : "No end";
  return {
    id: sr.id, customer, customerId: sr.customerId, currency, total: sr.total, schedule: describeSchedule(sr.anchorDate, sr.frequency as Frequency), ending,
    frequency: sr.frequency as Frequency, nextRun: sr.nextRun, status: sr.status, mode: sr.mode, invoicesMade: sr.invoicesMade, endAfter: sr.endAfter, endOn: sr.endOn, lastError: sr.lastError,
  };
}

export type SeriesDetail = SeriesRow & {
  occurrences: { kind: "made" | "upcoming" | "skipped"; date: string; invoiceId?: string; number?: string; status?: InvoiceRow["status"]; total?: number; left?: number }[];
  invoice: { category: string; termsDays: number; vatBps: number; note: string; template: string; brandColor: string; bankAccountId: string | null; lines: { description: string; quantity: number; unitPrice: number }[] };
  customerEmail: string;
};

export async function getSeries(session: Session, id: string): Promise<SeriesDetail | null> {
  const [row] = await db
    .select({ sr: s.series, customer: s.customers })
    .from(s.series)
    .innerJoin(s.customers, eq(s.customers.id, s.series.customerId))
    .where(and(eq(s.series.id, id), eq(s.series.workspaceId, session.workspace.id)));
  if (!row) return null;
  const { sr, customer } = row;
  const t = today();
  const invs = await db.select().from(s.invoices).where(eq(s.invoices.seriesId, sr.id)).orderBy(desc(s.invoices.createdAt));
  const occurrences: SeriesDetail["occurrences"] = [];
  // Next few dates the series will run, inside its end rule
  if (sr.status !== "ended" && sr.nextRun) {
    const freq = sr.frequency as Frequency;
    let made = sr.invoicesMade;
    for (let i = sr.runIndex; occurrences.length < 4; i++) {
      if (sr.endAfter != null && made >= sr.endAfter) break;
      if (!withinEnd(sr.anchorDate, freq, i, { endAfter: null, endOn: sr.endOn })) break;
      occurrences.push({ kind: "upcoming", date: runDate(sr.anchorDate, freq, i) });
      made++;
    }
    occurrences.reverse();
  }
  const past: SeriesDetail["occurrences"] = [
    ...invs.map((inv) => ({
      kind: "made" as const, date: inv.issueDate ?? isoDate(inv.createdAt), invoiceId: inv.id, number: inv.number,
      status: displayStatus(inv.status, inv.dueDate, t).status, total: inv.total, left: Math.max(0, inv.total - inv.amountPaid),
    })),
    ...sr.skipped.map((date) => ({ kind: "skipped" as const, date })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return {
    ...toSeriesRow(sr, customer.name, customer.currency),
    occurrences: [...occurrences, ...past],
    invoice: { category: sr.category, termsDays: sr.termsDays, vatBps: sr.vatBps, note: sr.note, template: sr.template, brandColor: sr.brandColor, bankAccountId: sr.bankAccountId, lines: sr.lines },
    customerEmail: customer.email,
  };
}

/* ---------------- Home insights ---------------- */
export type Insight = { label: string; sub: string; value: number; share: number; href?: string };

/** The last 12 months of real billing (sent or later, not cancelled), in the workspace's currency. */
export async function insights(session: Session) {
  const home = session.workspace.defaultCurrency;
  const since = isoDate(new Date(), -365);
  const invs = await db
    .select({ id: s.invoices.id, total: s.invoices.total, paid: s.invoices.amountPaid, currency: s.invoices.currency, category: s.invoices.category, customerId: s.invoices.customerId, customer: s.customers.name, status: s.invoices.status, issueDate: s.invoices.issueDate })
    .from(s.invoices)
    .innerJoin(s.customers, eq(s.customers.id, s.invoices.customerId))
    .where(and(eq(s.invoices.workspaceId, session.workspace.id), inArray(s.invoices.status, ["sent", "viewed", "partial", "paid"])));
  const recent = invs.filter((i) => !i.issueDate || i.issueDate >= since);
  const lines = recent.length
    ? await db.select({ invoiceId: s.lineItems.invoiceId, description: s.lineItems.description, quantity: s.lineItems.quantity, unitPrice: s.lineItems.unitPrice }).from(s.lineItems).where(inArray(s.lineItems.invoiceId, recent.map((i) => i.id)))
    : [];
  const cur = new Map(recent.map((i) => [i.id, i.currency]));
  const total = recent.reduce((a, i) => a + toHomeMinor(i.total, i.currency, home), 0) || 1;

  const group = <T,>(rows: T[], key: (r: T) => string, value: (r: T) => number) => {
    const m = new Map<string, { value: number; count: number; first: T }>();
    for (const r of rows) {
      const k = key(r);
      const g = m.get(k) ?? { value: 0, count: 0, first: r };
      g.value += value(r);
      g.count++;
      m.set(k, g);
    }
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  };

  const customers: Insight[] = group(recent, (i) => i.customerId, (i) => toHomeMinor(i.total, i.currency, home))
    .slice(0, 5)
    .map(([id, g]) => {
      const paid = recent.filter((i) => i.customerId === id).reduce((a, i) => a + toHomeMinor(i.paid, i.currency, home), 0);
      return { label: g.first.customer, sub: `${g.count} invoice${g.count === 1 ? "" : "s"} · ${g.value ? Math.round((paid / g.value) * 100) : 0}% paid`, value: g.value, share: g.value / total, href: `/customers/${id}` };
    });
  // Same item typed slightly differently ("Logo design" / "logo design ") counts as one
  const services: Insight[] = group(lines, (l) => l.description.trim().toLowerCase(), (l) => toHomeMinor(Math.round(l.quantity * l.unitPrice), cur.get(l.invoiceId) ?? home, home))
    .slice(0, 5)
    .map(([, g]) => ({ label: g.first.description.trim(), sub: `On ${g.count} invoice line${g.count === 1 ? "" : "s"}`, value: g.value, share: g.value / total }));
  const categories: Insight[] = group(recent, (i) => i.category || "General", (i) => toHomeMinor(i.total, i.currency, home))
    .slice(0, 5)
    .map(([c, g]) => ({ label: c, sub: `${g.count} invoice${g.count === 1 ? "" : "s"}`, value: g.value, share: g.value / total, href: `/invoices?q=${encodeURIComponent(c)}` }));
  return { customers, services, categories, total: recent.length ? total : 0, currency: home };
}

/* ---------------- Organising ---------------- */
/** Distinct tags across the workspace's invoices, most used first. */
export async function workspaceTags(session: Session) {
  const rows = await db.select({ tags: s.invoices.tags }).from(s.invoices).where(eq(s.invoices.workspaceId, session.workspace.id));
  const count = new Map<string, number>();
  for (const r of rows) for (const t of r.tags) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

export type SavedView = { id: string; name: string; base: string; q: string; tags: string[]; categories: string[] };
export async function listSavedViews(session: Session): Promise<SavedView[]> {
  const rows = await db.select().from(s.savedViews).where(eq(s.savedViews.workspaceId, session.workspace.id)).orderBy(asc(s.savedViews.createdAt));
  return rows.map((v) => ({ id: v.id, name: v.name, base: v.base, q: v.q, tags: v.tags, categories: v.categories }));
}
