import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { toHomeMinor } from "@/lib/fx";
import { isoDate } from "@/lib/invoice-math";
import type { Session } from "./session";

/*
 * Reports for a date range. Money is shown in the workspace's home currency (converted at approximate rates)
 * and, for honesty, also per original currency. "Invoiced" counts invoices issued in the range;
 * "collected" counts money received in the range, minus refunds made in the range.
 */

export type Range = { from: string; to: string };
type Row = { key: string; label: string; sub?: string; invoiced: number; collected: number; outstanding: number; count: number; href?: string };

const PER_MONTH = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 } as const;
const shift = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return isoDate(new Date(y, m - 1, dd + n));
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export async function report(session: Session, range: Range) {
  const ws = session.workspace;
  const home = ws.defaultCurrency;
  const today = isoDate(new Date());
  const h = (minor: number, cur: string) => toHomeMinor(minor, cur, home);
  const inRange = (d: string | null) => !!d && d >= range.from && d <= range.to;

  const invs = await db
    .select({ inv: s.invoices, customer: s.customers.name })
    .from(s.invoices)
    .innerJoin(s.customers, eq(s.customers.id, s.invoices.customerId))
    .where(and(eq(s.invoices.workspaceId, ws.id), inArray(s.invoices.status, ["sent", "viewed", "partial", "paid"])));
  const ids = invs.map((r) => r.inv.id);
  const [pays, refunds, series] = await Promise.all([
    ids.length ? db.select().from(s.payments).where(inArray(s.payments.invoiceId, ids)) : Promise.resolve([]),
    ids.length ? db.select().from(s.refunds).where(inArray(s.refunds.invoiceId, ids)) : Promise.resolve([]),
    db.select().from(s.series).where(and(eq(s.series.workspaceId, ws.id), eq(s.series.status, "active"))),
  ]);
  const byId = new Map(invs.map((r) => [r.inv.id, r]));
  // Money moved by credit isn't new money in, so it doesn't count as collected
  const realPays = pays.filter((p) => p.method !== "Customer credit");

  const issued = invs.filter((r) => inRange(r.inv.issueDate));
  const payIn = realPays.filter((p) => inRange(p.receivedOn));
  const refOut = refunds.filter((r) => inRange(r.refundedOn));
  const open = invs.filter((r) => ["sent", "viewed", "partial"].includes(r.inv.status));

  const invoiced = issued.reduce((a, r) => a + h(r.inv.total, r.inv.currency), 0);
  const tax = issued.reduce((a, r) => a + h(r.inv.tax, r.inv.currency), 0);
  const collected = payIn.reduce((a, p) => a + h(p.amount, byId.get(p.invoiceId)!.inv.currency), 0) - refOut.reduce((a, r) => a + h(r.amount, byId.get(r.invoiceId)!.inv.currency), 0);
  const outstanding = open.reduce((a, r) => a + h(r.inv.total - r.inv.amountPaid, r.inv.currency), 0);
  const overdue = open.filter((r) => r.inv.dueDate && r.inv.dueDate < today).reduce((a, r) => a + h(r.inv.total - r.inv.amountPaid, r.inv.currency), 0);

  // Average days from issue to the payment that settled it, for invoices settled in the range
  const settled = invs.filter((r) => r.inv.status === "paid" && r.inv.issueDate).map((r) => {
    const last = pays.filter((p) => p.invoiceId === r.inv.id).map((p) => p.receivedOn).sort().at(-1);
    return last && inRange(last) ? daysBetween(r.inv.issueDate!, last) : null;
  }).filter((n): n is number => n !== null);
  const avgDays = settled.length ? Math.round(settled.reduce((a, b) => a + b, 0) / settled.length) : null;

  // Months across the range (at most 24, newest last)
  const months: { key: string; label: string; invoiced: number; collected: number }[] = [];
  const [fy, fm] = range.from.split("-").map(Number);
  for (let i = 0; i < 24; i++) {
    const d = new Date(fy, fm - 1 + i, 1);
    const key = isoDate(d).slice(0, 7);
    if (key > range.to.slice(0, 7)) break;
    months.push({
      key,
      label: d.toLocaleDateString("en-GB", { month: "short", ...(fy !== new Date().getFullYear() || i > 11 ? { year: "2-digit" } : {}) }),
      invoiced: issued.filter((r) => r.inv.issueDate!.startsWith(key)).reduce((a, r) => a + h(r.inv.total, r.inv.currency), 0),
      collected:
        payIn.filter((p) => p.receivedOn.startsWith(key)).reduce((a, p) => a + h(p.amount, byId.get(p.invoiceId)!.inv.currency), 0) -
        refOut.filter((r) => r.refundedOn.startsWith(key)).reduce((a, r) => a + h(r.amount, byId.get(r.invoiceId)!.inv.currency), 0),
    });
  }

  // What's owed today, by how late it is
  const buckets = [
    { key: "current", label: "Not due yet", test: (late: number) => late <= 0 },
    { key: "1-30", label: "1 to 30 days late", test: (late: number) => late >= 1 && late <= 30 },
    { key: "31-60", label: "31 to 60 days late", test: (late: number) => late >= 31 && late <= 60 },
    { key: "61-90", label: "61 to 90 days late", test: (late: number) => late >= 61 && late <= 90 },
    { key: "90+", label: "Over 90 days late", test: (late: number) => late > 90 },
  ].map((b) => {
    const list = open.filter((r) => b.test(r.inv.dueDate ? daysBetween(r.inv.dueDate, today) : 0));
    return { key: b.key, label: b.label, amount: list.reduce((a, r) => a + h(r.inv.total - r.inv.amountPaid, r.inv.currency), 0), count: list.length, numbers: list.map((r) => r.inv.number) };
  });

  const group = (keyOf: (r: (typeof invs)[number]) => string, labelOf: (r: (typeof invs)[number]) => string, hrefOf?: (k: string) => string): Row[] => {
    const m = new Map<string, Row>();
    const get = (r: (typeof invs)[number]) => {
      const k = keyOf(r);
      if (!m.has(k)) m.set(k, { key: k, label: labelOf(r), invoiced: 0, collected: 0, outstanding: 0, count: 0, href: hrefOf?.(k) });
      return m.get(k)!;
    };
    for (const r of issued) { const g = get(r); g.invoiced += h(r.inv.total, r.inv.currency); g.count++; }
    for (const p of payIn) { const r = byId.get(p.invoiceId)!; get(r).collected += h(p.amount, r.inv.currency); }
    for (const x of refOut) { const r = byId.get(x.invoiceId)!; get(r).collected -= h(x.amount, r.inv.currency); }
    for (const r of open) get(r).outstanding += h(r.inv.total - r.inv.amountPaid, r.inv.currency);
    return [...m.values()].filter((g) => g.invoiced || g.collected || g.outstanding).sort((a, b) => b.invoiced - a.invoiced || b.outstanding - a.outstanding);
  };
  const customers = group((r) => r.inv.customerId, (r) => r.customer, (k) => `/customers/${k}`).slice(0, 12);
  const categories = group((r) => r.inv.category || "General", (r) => r.inv.category || "General", (k) => `/invoices?q=${encodeURIComponent(k)}`);

  // Original currencies, no conversion: the numbers you'd see in each bank account
  const currencies = [...new Set([...issued.map((r) => r.inv.currency), ...open.map((r) => r.inv.currency), ...payIn.map((p) => byId.get(p.invoiceId)!.inv.currency)])].sort().map((c) => ({
    currency: c,
    invoiced: issued.filter((r) => r.inv.currency === c).reduce((a, r) => a + r.inv.total, 0),
    collected: payIn.filter((p) => byId.get(p.invoiceId)!.inv.currency === c).reduce((a, p) => a + p.amount, 0) - refOut.filter((x) => byId.get(x.invoiceId)!.inv.currency === c).reduce((a, x) => a + x.amount, 0),
    outstanding: open.filter((r) => r.inv.currency === c).reduce((a, r) => a + r.inv.total - r.inv.amountPaid, 0),
    tax: issued.filter((r) => r.inv.currency === c).reduce((a, r) => a + r.inv.tax, 0),
  }));

  const cust = new Map(invs.map((r) => [r.inv.customerId, r.inv.currency]));
  const recurring = series.reduce((a, sr) => a + h(sr.total, cust.get(sr.customerId) ?? home) * PER_MONTH[sr.frequency as keyof typeof PER_MONTH], 0);

  return {
    range, home, invoiced, collected, outstanding, overdue, tax, avgDays, recurring: Math.round(recurring), activeSeries: series.length,
    issuedCount: issued.length, months, buckets, customers, categories, currencies,
    previous: undefined as undefined | { invoiced: number; collected: number },
  };
}

export type Report = Awaited<ReturnType<typeof report>>;

/** Turn ?range= or ?from=&to= into dates. Defaults to this year so far. */
export function resolveRange(sp: { range?: string; from?: string; to?: string }): Range & { key: string } {
  const now = new Date();
  const t = isoDate(now);
  const y = now.getFullYear(), m = now.getMonth();
  const valid = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (sp.range === "custom" && valid(sp.from) && valid(sp.to) && sp.from! <= sp.to!) return { key: "custom", from: sp.from!, to: sp.to! };
  switch (sp.range) {
    case "month": return { key: "month", from: isoDate(new Date(y, m, 1)), to: t };
    case "last-month": return { key: "last-month", from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) };
    case "quarter": return { key: "quarter", from: isoDate(new Date(y, Math.floor(m / 3) * 3, 1)), to: t };
    case "12m": return { key: "12m", from: isoDate(new Date(y, m - 11, 1)), to: t };
    case "last-year": return { key: "last-year", from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default: return { key: "year", from: `${y}-01-01`, to: t };
  }
}

/** The same length of time just before the range, for "up 12% on the previous period". */
export function previousRange(r: Range): Range {
  const days = daysBetween(r.from, r.to);
  return { from: shift(r.from, -days - 1), to: shift(r.from, -1) };
}
