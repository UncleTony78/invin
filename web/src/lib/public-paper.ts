import type { Currency } from "./format";
import { formatDate } from "./invoice-math";
import type { PublicInvoice } from "@/server/public";

/** Public invoice → the shape InvoicePaper renders. Shared by the customer page and the PDF print page. */
export function toPaper(inv: PublicInvoice) {
  const cur = inv.currency as Currency;
  return {
    number: inv.number,
    issued: formatDate(inv.issueDate, { year: true }),
    due: formatDate(inv.dueDate, { year: true }),
    currency: cur,
    customer: { ...inv.customer, currency: cur },
    items: inv.lines.map((l) => ({ description: l.description, quantity: l.quantity, price: l.unitPrice / 100 })),
    vatRate: inv.vatBps / 10000,
    paid: inv.stored === "partial" ? inv.paid / 100 : 0,
    note: inv.note,
    fields: inv.fields,
    settled: inv.stored === "paid" ? ("paid" as const) : inv.stored === "cancelled" ? ("cancelled" as const) : undefined,
  };
}

