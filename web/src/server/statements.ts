import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { formatMoney, type Currency } from "@/lib/format";
import { formatDate } from "@/lib/invoice-math";
import type { Session } from "./session";

/*
 * A customer statement: what they were invoiced and what they paid over a period, with a running balance.
 * Only invoices in the customer's own currency are included; cancelled invoices (and their payments) are left out.
 * Refunds don't change what's owed in InVin (the invoice stays settled), so they aren't balance lines here.
 */

export type StatementLine = { date: string; kind: "invoice" | "payment"; ref: string; text: string; amount: number; balance: number };

export async function statement(session: Session, customerId: string, from: string, to: string) {
  const ws = session.workspace;
  const [customer] = await db.select().from(s.customers).where(and(eq(s.customers.id, customerId), eq(s.customers.workspaceId, ws.id)));
  if (!customer) return null;
  const invs = (await db.select().from(s.invoices).where(and(eq(s.invoices.customerId, customer.id), inArray(s.invoices.status, ["sent", "viewed", "partial", "paid"]))))
    .filter((i) => i.currency === customer.currency && i.issueDate);
  const pays = invs.length ? await db.select().from(s.payments).where(inArray(s.payments.invoiceId, invs.map((i) => i.id))) : [];
  const num = new Map(invs.map((i) => [i.id, i.number]));

  const events = [
    ...invs.map((i) => ({ date: i.issueDate!, kind: "invoice" as const, ref: i.number, text: `Invoice ${i.number}${i.dueDate ? `, due ${formatDate(i.dueDate, { year: true })}` : ""}`, amount: i.total })),
    ...pays.map((p) => ({ date: p.receivedOn, kind: "payment" as const, ref: num.get(p.invoiceId)!, text: `Payment for ${num.get(p.invoiceId)}${p.method ? `, ${p.method.toLowerCase()}` : ""}`, amount: -p.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "invoice" ? -1 : 1));

  const opening = events.filter((e) => e.date < from).reduce((a, e) => a + e.amount, 0);
  let bal = opening;
  const lines: StatementLine[] = events.filter((e) => e.date >= from && e.date <= to).map((e) => ({ ...e, balance: (bal += e.amount) }));
  const closing = bal;
  const invoiced = lines.filter((l) => l.kind === "invoice").reduce((a, l) => a + l.amount, 0);
  const paid = -lines.filter((l) => l.kind === "payment").reduce((a, l) => a + l.amount, 0);
  const open = invs.filter((i) => ["sent", "viewed", "partial"].includes(i.status) && i.issueDate! <= to).map((i) => ({ number: i.number, due: i.dueDate, left: i.total - i.amountPaid }));

  return {
    business: { name: ws.name, mark: ws.mark, address: ws.address, email: ws.email, brand: ws.brandColor },
    customer: { id: customer.id, name: customer.name, email: customer.email, address: customer.address },
    currency: customer.currency as Currency,
    from, to, opening, closing, invoiced, paid, lines, open,
  };
}

export type Statement = NonNullable<Awaited<ReturnType<typeof statement>>>;

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The statement as a self-contained A4 HTML page: the preview, the PDF and the email attachment all use it. */
export function statementHtml(st: Statement) {
  const m = (minor: number) => esc(formatMoney(minor / 100, st.currency));
  const d = (iso: string) => esc(formatDate(iso, { year: true }));
  const rows = st.lines
    .map((l) => `<tr><td>${d(l.date)}</td><td>${esc(l.text)}</td><td class="r">${l.kind === "invoice" ? m(l.amount) : ""}</td><td class="r">${l.kind === "payment" ? m(-l.amount) : ""}</td><td class="r b">${m(l.balance)}</td></tr>`)
    .join("");
  const open = st.open.length
    ? `<h2>Still to pay</h2><table class="mini"><tbody>${st.open.map((o) => `<tr><td>${esc(o.number)}</td><td>${o.due ? `Due ${d(o.due)}` : ""}</td><td class="r b">${m(o.left)}</td></tr>`).join("")}</tbody></table>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Statement for ${esc(st.customer.name)}</title>
<style>
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { margin: 0; font: 11px/1.5 "IBM Plex Sans", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1a1916; background: #fff; }
.page { max-width: 760px; margin: 0 auto; padding: 28px; }
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
.biz { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 13px; }
.mk { width: 28px; height: 28px; border-radius: 7px; background: ${esc(st.business.brand)}; color: #fff; display: grid; place-items: center; font-size: 10px; }
h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; text-align: right; }
.period { color: #6e6c66; text-align: right; margin-top: 2px; }
.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 28px 0 22px; }
.l { display: block; color: #6e6c66; font-size: 10px; margin-bottom: 3px; }
.sum { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 14px 16px; background: #f6f5f2; border-radius: 8px; }
.sum b { display: block; font-size: 15px; font-weight: 600; margin-top: 2px; font-variant-numeric: tabular-nums; }
.sum .due b { color: ${esc(st.business.brand)}; }
table { width: 100%; border-collapse: collapse; margin-top: 18px; font-variant-numeric: tabular-nums; }
th { text-align: left; font-weight: 400; color: #6e6c66; font-size: 10px; padding: 0 6px 6px; border-bottom: 1px solid #1a1916; }
td { padding: 8px 6px; border-bottom: 1px solid #eeece7; vertical-align: top; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
.r { text-align: right; white-space: nowrap; }
.b { font-weight: 600; }
.open-row td { color: #6e6c66; }
h2 { font-size: 12px; margin: 26px 0 0; }
.mini { margin-top: 8px; }
.foot { margin-top: 26px; color: #6e6c66; }
</style></head><body><div class="page">
<div class="top"><div class="biz"><span class="mk">${esc(st.business.mark)}</span>${esc(st.business.name)}</div><div><h1>Statement</h1><div class="period">${d(st.from)} to ${d(st.to)}</div></div></div>
<div class="parties"><div><span class="l">For</span><b>${esc(st.customer.name)}</b><br>${esc(st.customer.address)}<br>${esc(st.customer.email)}</div><div><span class="l">From</span>${esc(st.business.name)}<br>${esc(st.business.address)}<br>${esc(st.business.email)}</div></div>
<div class="sum"><div>Balance on ${d(st.from)}<b>${m(st.opening)}</b></div><div>Invoiced<b>${m(st.invoiced)}</b></div><div>Paid<b>${m(st.paid)}</b></div><div class="due">Balance on ${d(st.to)}<b>${m(st.closing)}</b></div></div>
<table><thead><tr><th>Date</th><th>Details</th><th class="r">Invoiced</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead><tbody>
<tr class="open-row"><td>${d(st.from)}</td><td>Balance brought forward</td><td></td><td></td><td class="r b">${m(st.opening)}</td></tr>
${rows || `<tr><td colspan="5" style="color:#6e6c66">No invoices or payments in this period.</td></tr>`}
</tbody></table>
${open}
<p class="foot">Amounts in ${esc(st.currency)}. Questions about this statement? Reply to ${esc(st.business.email)}.</p>
</div></body></html>`;
}
