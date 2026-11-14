import { report, resolveRange } from "@/server/reports";
import { requireSession } from "@/server/session";

export const dynamic = "force-dynamic";

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const money = (minor: number) => (minor / 100).toFixed(2);

/** The report as one CSV: a summary, then each breakdown, separated by blank lines. */
export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const r = await report(await requireSession(), resolveRange({ range: "custom", from: sp.from, to: sp.to }));
  const rows: (string | number)[][] = [
    [`InVin report, ${r.range.from} to ${r.range.to}, in ${r.home} (other currencies converted at approximate rates)`],
    [],
    ["Summary", r.home],
    ["Invoiced", money(r.invoiced)],
    ["Collected after refunds", money(r.collected)],
    ["Owed now", money(r.outstanding)],
    ["Overdue now", money(r.overdue)],
    ["VAT on invoices issued", money(r.tax)],
    ["Recurring each month", money(r.recurring)],
    [],
    ["Month", "Invoiced", "Collected"],
    ...r.months.map((m) => [m.key, money(m.invoiced), money(m.collected)]),
    [],
    ["Owed by age", "Amount", "Invoices"],
    ...r.buckets.map((b) => [b.label, money(b.amount), b.count]),
    [],
    ["Customer", "Invoiced", "Collected", "Owed now", "Invoices"],
    ...r.customers.map((c) => [c.label, money(c.invoiced), money(c.collected), money(c.outstanding), c.count]),
    [],
    ["Category", "Invoiced", "Collected", "Owed now", "Invoices"],
    ...r.categories.map((c) => [c.label, money(c.invoiced), money(c.collected), money(c.outstanding), c.count]),
    [],
    ["Currency (original amounts)", "Invoiced", "Collected", "Owed now", "VAT"],
    ...r.currencies.map((c) => [c.currency, money(c.invoiced), money(c.collected), money(c.outstanding), money(c.tax)]),
  ];
  const csv = "﻿" + rows.map((l) => l.map((v) => cell(String(v))).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${r.range.from}-to-${r.range.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
