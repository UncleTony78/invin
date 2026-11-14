import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { formatMoney, type Currency } from "@/lib/format";
import { computeTotals, formatDate, isoDate } from "@/lib/invoice-math";
import { appUrl, sendEmail } from "./email";
import { invoiceEmail, receiptEmail, reminderEmail } from "./email-templates";
import { pdfName, pdfReady, renderInvoicePdf } from "./pdf";

/*
 * The billing core: making, emailing and following up invoices. No session checks here.
 * Server actions check who is asking first; the background runner acts as the system.
 */

export type Ws = typeof s.workspaces.$inferSelect;
export type Cust = typeof s.customers.$inferSelect;
export type Inv = typeof s.invoices.$inferSelect;
export type Actor = { actorType: "member" | "system" | "agent" | "customer"; actorId: string | null; actorLabel: string };

export type InvoiceInput = {
  customerId: string;
  issueDate: string;
  termsDays: number;
  category: string;
  vatBps: number;
  note: string;
  template: string;
  brandColor: string;
  bankAccountId: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
  email?: { to: string; subject: string; message: string; attachPdf: boolean };
  /** Custom field values by field id */
  fields?: Record<string, string>;
};

/** Keep only values for fields the workspace has, trimmed and short. */
export const cleanFields = (ws: Ws, fields: Record<string, string> | undefined) =>
  Object.fromEntries(ws.customFields.map((f) => [f.id, (fields?.[f.id] ?? "").trim().slice(0, 120)]).filter(([, v]) => v));

export const today = () => isoDate(new Date());
export const dueFrom = (issue: string, termsDays: number) => {
  const [y, m, d] = issue.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d), termsDays);
};

/** Number, save and (when sending) email a new invoice. One transaction for the number and the rows. */
export async function issueInvoice(o: {
  ws: Ws;
  customer: Cust;
  input: InvoiceInput;
  mode: "draft" | "send";
  actor: Actor;
  createdBy: string | null;
  seriesId?: string | null;
  createdTitle?: string;
}) {
  const lines = o.input.lines.filter((l) => l.description.trim() || l.unitPrice > 0);
  const totals = computeTotals(lines, o.input.vatBps); // never trust totals from the browser
  const issue = o.input.issueDate || today();
  const due = dueFrom(issue, o.input.termsDays);
  const sending = o.mode === "send";
  const result = await db.transaction(async (tx) => {
    const [ws] = await tx.update(s.workspaces).set({ nextNumber: sql`${s.workspaces.nextNumber} + 1` }).where(eq(s.workspaces.id, o.ws.id)).returning();
    const number = `${ws.numberPrefix}${String(ws.nextNumber - 1).padStart(4, "0")}`;
    const [inv] = await tx
      .insert(s.invoices)
      .values({
        workspaceId: ws.id, number, customerId: o.customer.id, status: sending ? "sent" : "draft", currency: o.customer.currency, category: o.input.category || "General",
        issueDate: sending ? issue : null, dueDate: sending ? due : null, termsDays: o.input.termsDays, template: o.input.template, brandColor: o.input.brandColor,
        bankAccountId: o.input.bankAccountId || null, note: o.input.note, vatBps: o.input.vatBps, ...totals, createdBy: o.createdBy, seriesId: o.seriesId ?? null, fields: cleanFields(o.ws, o.input.fields),
        customerSnapshot: sending ? { name: o.customer.name, email: o.customer.email, address: o.customer.address } : null, sentAt: sending ? new Date() : null,
      })
      .returning();
    if (lines.length) await tx.insert(s.lineItems).values(lines.map((l, position) => ({ ...l, invoiceId: inv.id, position })));
    await rememberCategory(tx, ws, o.input.category);
    await tx.insert(s.events).values({ workspaceId: ws.id, invoiceId: inv.id, ...o.actor, title: o.createdTitle ?? "Invoice created" });
    if (sending) await tx.insert(s.events).values({ workspaceId: ws.id, invoiceId: inv.id, ...o.actor, title: `Invoice sent to ${o.input.email?.to || o.customer.email}` });
    return { id: inv.id, number, token: inv.publicToken, ws };
  });
  // Credit is used before the email goes, so the customer sees the right amount left to pay
  const creditUsed = sending ? await applyCreditTo(result.id, { actorType: "system", actorId: null, actorLabel: "InVin" }, null) : 0;
  const delivery = sending ? await emailInvoice({ ws: result.ws, id: result.id, number: result.number, token: result.token, customer: o.customer, input: o.input, total: totals.total, due }) : undefined;
  return { ...result, total: totals.total, due, delivery, creditUsed };
}

/** Sends the invoice email after the invoice is safely saved; a delivery failure never loses the invoice. */
export async function emailInvoice(o: { ws: Ws; id: string; number: string; token: string; customer: Cust; input: InvoiceInput; total: number; due: string }) {
  const amount = formatMoney(o.total / 100, o.customer.currency as Currency);
  const dueLabel = o.input.termsDays ? formatDate(o.due, { year: true }) : "on receipt";
  const mail = invoiceEmail({
    brand: o.input.brandColor, business: o.ws.name, number: o.number, amount, due: dueLabel,
    message: o.input.email?.message || `Hi ${o.customer.name.split(" ")[0]},\n\nHere's invoice ${o.number} for ${amount}, due ${dueLabel}. You'll find the bank details on the invoice.\n\nThanks,\n${o.ws.name}`,
    url: `${appUrl()}/i/${o.token}`,
  });
  // The PDF is a convenience: if rendering fails, the email still goes with its "View invoice" link
  let attachments: { filename: string; content: Buffer }[] | undefined;
  if (o.input.email?.attachPdf !== false && pdfReady()) {
    attachments = await renderInvoicePdf(o.token)
      .then((content) => [{ filename: pdfName(o.ws.name, o.number), content }])
      .catch(() => undefined);
  }
  const res = await sendEmail({
    workspaceId: o.ws.id, invoiceId: o.id, to: o.input.email?.to || o.customer.email, subject: o.input.email?.subject || `Invoice ${o.number} from ${o.ws.name}`,
    ...mail, replyTo: o.ws.email, fromName: o.ws.name, attachments,
  });
  return res.status;
}

/** A payment reminder, by hand or on the schedule. Logged on the invoice either way. */
export async function remindCustomer(o: { ws: Ws; inv: Inv; customer: Cust; actor: Actor; sender: string; title?: string }) {
  const cur = o.inv.currency as Currency;
  const left = formatMoney((o.inv.total - o.inv.amountPaid) / 100, cur);
  const late = o.inv.dueDate && o.inv.dueDate < today();
  const mail = reminderEmail({
    brand: o.inv.brandColor, business: o.ws.name, customer: o.customer.name, number: o.inv.number, left,
    dueLine: o.inv.dueDate ? `${late ? "was due" : "is due"} on ${formatDate(o.inv.dueDate, { year: true })}` : "is due",
    sender: o.sender, url: `${appUrl()}/i/${o.inv.publicToken}`,
  });
  const res = await sendEmail({
    workspaceId: o.ws.id, invoiceId: o.inv.id, to: o.customer.email, subject: `Reminder: invoice ${o.inv.number} from ${o.ws.name}`,
    ...mail, replyTo: o.ws.email, fromName: o.ws.name,
  });
  await db.insert(s.events).values({ workspaceId: o.ws.id, invoiceId: o.inv.id, ...o.actor, title: o.title ?? `Reminder sent to ${o.customer.email}` });
  return res.status;
}

/** Email a receipt for one payment and note it on the invoice. */
export async function sendReceipt(paymentId: string, actor: Actor) {
  const [p] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId));
  if (!p) return null;
  const [inv] = await db.select().from(s.invoices).where(eq(s.invoices.id, p.invoiceId));
  const [[ws], [customer]] = await Promise.all([
    db.select().from(s.workspaces).where(eq(s.workspaces.id, inv.workspaceId)),
    db.select().from(s.customers).where(eq(s.customers.id, inv.customerId)),
  ]);
  const cur = inv.currency as Currency;
  const left = inv.total - inv.amountPaid;
  const mail = receiptEmail({
    brand: inv.brandColor, business: ws.name, customer: customer.name.split(" ")[0], number: inv.number, amount: formatMoney(p.amount / 100, cur),
    paidOn: formatDate(p.receivedOn, { year: true }), method: p.method, left: left > 0 ? formatMoney(left / 100, cur) : null, url: `${appUrl()}/i/${inv.publicToken}`,
  });
  const res = await sendEmail({ workspaceId: ws.id, invoiceId: inv.id, to: customer.email, subject: mail.subject, text: mail.text, html: mail.html, replyTo: ws.email, fromName: ws.name });
  await db.update(s.payments).set({ receiptDue: false, receiptSentAt: new Date() }).where(eq(s.payments.id, p.id));
  await db.insert(s.events).values({ workspaceId: ws.id, invoiceId: inv.id, ...actor, title: `Receipt sent to ${customer.email}`, note: formatMoney(p.amount / 100, cur) });
  return { to: customer.email, delivery: res.status };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A category typed on an invoice joins the workspace's list, so it's there to pick next time. */
export async function rememberCategory(tx: Tx | typeof db, ws: Ws, category: string) {
  const c = category.trim();
  if (!c || ws.categories.some((x) => x.toLowerCase() === c.toLowerCase()) || ws.categories.length >= 40) return;
  await tx.update(s.workspaces).set({ categories: [...ws.categories, c] }).where(eq(s.workspaces.id, ws.id));
}

/* ---------------- Customer credit ---------------- */

/** What a customer has in credit, in one currency (minor units). */
export async function creditBalance(customerId: string, currency: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`coalesce(sum(${s.credits.amount}), 0)` })
    .from(s.credits)
    .where(and(eq(s.credits.customerId, customerId), eq(s.credits.currency, currency)));
  return Number(n);
}

/**
 * Use the customer's credit on an unpaid invoice: a payment marked "Customer credit"
 * and a matching minus on the credit ledger, in one transaction. Returns what was used (0 if none).
 */
export async function applyCreditTo(invoiceId: string, actor: Actor, by: string | null) {
  const [inv] = await db.select().from(s.invoices).where(eq(s.invoices.id, invoiceId));
  if (!inv || !["sent", "viewed", "partial"].includes(inv.status)) return 0;
  const balance = await creditBalance(inv.customerId, inv.currency);
  const use = Math.min(balance, inv.total - inv.amountPaid);
  if (use <= 0) return 0;
  const paid = inv.amountPaid + use;
  await db.transaction(async (tx) => {
    await tx.insert(s.payments).values({ invoiceId: inv.id, amount: use, receivedOn: today(), method: "Customer credit", reference: "", recordedBy: by });
    await tx.insert(s.credits).values({ workspaceId: inv.workspaceId, customerId: inv.customerId, currency: inv.currency, amount: -use, invoiceId: inv.id, note: `Used on ${inv.number}` });
    await tx.update(s.invoices).set({ amountPaid: paid, status: paid >= inv.total ? "paid" : "partial" }).where(eq(s.invoices.id, inv.id));
    await tx.insert(s.events).values({ workspaceId: inv.workspaceId, invoiceId: inv.id, ...actor, title: `Customer credit used · ${formatMoney(use / 100, inv.currency as Currency)}` });
  });
  return use;
}
