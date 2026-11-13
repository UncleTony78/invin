"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { amountProblem, computeTotals, isoDate } from "@/lib/invoice-math";
import { emailInvoice, issueInvoice, rememberCategory, remindCustomer, sendReceipt, type InvoiceInput as Input } from "./billing";
import { formatMoney, type Currency } from "@/lib/format";
import { getInvoiceDetail, today } from "./queries";
import { requireSession } from "./session";

/* Every action re-checks the session and that the record belongs to the workspace.
   Server Functions are reachable by direct POST, so the UI is never the guard. */

async function ownInvoice(id: string) {
  const session = await requireSession();
  const [inv] = await db.select().from(s.invoices).where(and(eq(s.invoices.id, id), eq(s.invoices.workspaceId, session.workspace.id)));
  if (!inv) throw new Error("Invoice not found");
  return { session, inv };
}

const refresh = () => revalidatePath("/", "layout");
const memberActor = (m: { id: string; name: string }) => ({ actorType: "member" as const, actorId: m.id, actorLabel: m.name });

export async function fetchInvoiceDetail(id: string) {
  return getInvoiceDetail(await requireSession(), id);
}

export async function recordPayment(input: { invoiceId: string; amount: number; receivedOn: string; method: string; reference: string }) {
  const { session, inv } = await ownInvoice(input.invoiceId);
  if (!["sent", "viewed", "partial"].includes(inv.status)) return { ok: false as const, error: "This invoice can't take payments right now." };
  const left = inv.total - inv.amountPaid;
  const amount = Math.round(input.amount);
  if (!(amount > 0)) return { ok: false as const, error: "Enter an amount above zero." };
  if (amount > left) return { ok: false as const, error: `That's more than the ${formatMoney(left / 100, inv.currency as Currency)} left to pay.` };
  const paidNow = inv.amountPaid + amount;
  const status = paidNow >= inv.total ? "paid" : "partial";
  const paymentId = await db.transaction(async (tx) => {
    // With receipts on, the runner emails one about a minute later (long enough for Undo to cancel it)
    const [p] = await tx.insert(s.payments).values({ invoiceId: inv.id, amount, receivedOn: input.receivedOn || today(), method: input.method, reference: input.reference, recordedBy: session.member.id, receiptDue: session.workspace.receiptsOn }).returning();
    await tx.update(s.invoices).set({ amountPaid: paidNow, status }).where(eq(s.invoices.id, inv.id));
    await tx.insert(s.events).values({
      workspaceId: session.workspace.id, invoiceId: inv.id, ...memberActor(session.member),
      title: `${status === "paid" ? "Payment" : "Part payment"} recorded · ${formatMoney(amount / 100, inv.currency as Currency)}`,
      note: input.reference ? `${input.method}, reference ${input.reference}` : null,
    });
    return p.id;
  });
  refresh();
  return { ok: true as const, paymentId, status, receipt: session.workspace.receiptsOn };
}

export async function undoPayment(invoiceId: string, paymentId: string) {
  const { session, inv } = await ownInvoice(invoiceId);
  await db.transaction(async (tx) => {
    const [p] = await tx.delete(s.payments).where(and(eq(s.payments.id, paymentId), eq(s.payments.invoiceId, inv.id))).returning();
    if (!p) return;
    const paid = inv.amountPaid - p.amount;
    await tx.update(s.invoices).set({ amountPaid: paid, status: paid > 0 ? "partial" : "sent" }).where(eq(s.invoices.id, inv.id));
    await tx.insert(s.events).values({ workspaceId: session.workspace.id, invoiceId: inv.id, ...memberActor(session.member), title: `Payment removed · ${formatMoney(p.amount / 100, inv.currency as Currency)}` });
  });
  refresh();
}

export async function sendReminder(invoiceId: string) {
  const { session, inv } = await ownInvoice(invoiceId);
  const [c] = await db.select().from(s.customers).where(eq(s.customers.id, inv.customerId));
  const delivery = await remindCustomer({ ws: session.workspace, inv, customer: c, actor: memberActor(session.member), sender: session.member.name.split(" ")[0] });
  refresh();
  return { to: c.name, delivery };
}

/** Send (or resend) a receipt for a payment straight away. */
export async function sendReceiptNow(invoiceId: string, paymentId?: string) {
  const { session, inv } = await ownInvoice(invoiceId);
  const [p] = paymentId
    ? await db.select().from(s.payments).where(and(eq(s.payments.id, paymentId), eq(s.payments.invoiceId, inv.id)))
    : await db.select().from(s.payments).where(eq(s.payments.invoiceId, inv.id)).orderBy(desc(s.payments.createdAt)).limit(1);
  if (!p) return { ok: false as const, error: "There's no payment on this invoice yet." };
  const res = await sendReceipt(p.id, memberActor(session.member));
  refresh();
  return { ok: true as const, to: res?.to ?? "", delivery: res?.delivery };
}

/** Stop or restart automatic reminders for one invoice. */
export async function setInvoiceReminders(invoiceId: string, paused: boolean) {
  const { session, inv } = await ownInvoice(invoiceId);
  await db.update(s.invoices).set({ remindersPaused: paused }).where(eq(s.invoices.id, inv.id));
  await db.insert(s.events).values({ workspaceId: session.workspace.id, invoiceId: inv.id, ...memberActor(session.member), title: paused ? "Automatic reminders paused" : "Automatic reminders turned back on" });
  refresh();
  return { paused };
}

export async function cancelInvoice(invoiceId: string, reason: string) {
  const { session, inv } = await ownInvoice(invoiceId);
  if (inv.status === "paid" || inv.status === "cancelled") return { ok: false as const };
  await db.update(s.invoices).set({ status: "cancelled" }).where(eq(s.invoices.id, inv.id));
  await db.insert(s.events).values({ workspaceId: session.workspace.id, invoiceId: inv.id, ...memberActor(session.member), title: "Invoice cancelled", note: reason || null });
  refresh();
  return { ok: true as const };
}

/* ---------------- Pins ---------------- */
export async function togglePin(input: { kind: "invoice" | "view" | "customer"; ref: string; label: string }) {
  const session = await requireSession();
  const where = and(eq(s.pins.memberId, session.member.id), eq(s.pins.kind, input.kind), eq(s.pins.ref, input.ref));
  const existing = await db.select().from(s.pins).where(where);
  if (existing.length) {
    await db.delete(s.pins).where(where);
    refresh();
    return { pinned: false };
  }
  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${s.pins.position}), -1)` }).from(s.pins).where(eq(s.pins.memberId, session.member.id));
  await db.insert(s.pins).values({ workspaceId: session.workspace.id, memberId: session.member.id, ...input, position: Number(max) + 1 });
  refresh();
  return { pinned: true };
}

export async function reorderPins(ids: string[]) {
  const session = await requireSession();
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.update(s.pins).set({ position: i }).where(and(eq(s.pins.id, id), eq(s.pins.memberId, session.member.id)));
  });
  refresh();
}

/* ---------------- Create and send ---------------- */
export type InvoiceInput = Input;

export async function createInvoice(input: InvoiceInput, mode: "draft" | "send") {
  const session = await requireSession();
  const [customer] = await db.select().from(s.customers).where(and(eq(s.customers.id, input.customerId), eq(s.customers.workspaceId, session.workspace.id)));
  if (!customer) return { ok: false as const, error: "Choose a customer first." };
  const lines = input.lines.filter((l) => l.description.trim() || l.unitPrice > 0);
  if (mode === "send" && lines.length === 0) return { ok: false as const, error: "Add at least one item before sending." };
  if (mode === "send" && !lines.some((l) => l.unitPrice > 0)) return { ok: false as const, error: "Add a price to at least one item." };
  const tooBig = amountProblem(lines, input.vatBps);
  if (tooBig) return { ok: false as const, error: tooBig };
  const r = await issueInvoice({ ws: session.workspace, customer, input, mode, actor: memberActor(session.member), createdBy: session.member.id });
  refresh();
  return { ok: true as const, id: r.id, number: r.number, delivery: r.delivery };
}

/** Save changes to a draft, or send it. Only drafts can be edited: sent invoices are a record. */
export async function updateDraft(id: string, input: InvoiceInput, mode: "draft" | "send") {
  const { session, inv } = await ownInvoice(id);
  if (inv.status !== "draft") return { ok: false as const, error: "Only drafts can be edited. Sent invoices are kept as they were sent." };
  const [customer] = await db.select().from(s.customers).where(and(eq(s.customers.id, input.customerId), eq(s.customers.workspaceId, session.workspace.id)));
  if (!customer) return { ok: false as const, error: "Choose a customer first." };
  const lines = input.lines.filter((l) => l.description.trim() || l.unitPrice > 0);
  if (mode === "send" && lines.length === 0) return { ok: false as const, error: "Add at least one item before sending." };
  if (mode === "send" && !lines.some((l) => l.unitPrice > 0)) return { ok: false as const, error: "Add a price to at least one item." };
  const tooBig = amountProblem(lines, input.vatBps);
  if (tooBig) return { ok: false as const, error: tooBig };
  const totals = computeTotals(lines, input.vatBps);
  const issue = input.issueDate || today();
  const [y, m, d] = issue.split("-").map(Number);
  const due = isoDate(new Date(y, m - 1, d), input.termsDays);
  const sending = mode === "send";
  await db.transaction(async (tx) => {
    await tx
      .update(s.invoices)
      .set({
        customerId: customer.id, currency: customer.currency, category: input.category || "General", termsDays: input.termsDays, template: input.template,
        brandColor: input.brandColor, bankAccountId: input.bankAccountId || null, note: input.note, vatBps: input.vatBps, ...totals,
        status: sending ? "sent" : "draft", issueDate: sending ? issue : null, dueDate: sending ? due : null,
        customerSnapshot: sending ? { name: customer.name, email: customer.email, address: customer.address } : null, sentAt: sending ? new Date() : null,
      })
      .where(eq(s.invoices.id, inv.id));
    await tx.delete(s.lineItems).where(eq(s.lineItems.invoiceId, inv.id));
    if (lines.length) await tx.insert(s.lineItems).values(lines.map((l, position) => ({ ...l, invoiceId: inv.id, position })));
    await tx.insert(s.events).values({ workspaceId: session.workspace.id, invoiceId: inv.id, ...memberActor(session.member), title: sending ? `Invoice sent to ${input.email?.to || customer.email}` : "Draft updated" });
  });
  await rememberCategory(db, session.workspace, input.category);
  const delivery = sending ? await emailInvoice({ ws: session.workspace, id: inv.id, number: inv.number, token: inv.publicToken, customer, input, total: totals.total, due }) : undefined;
  refresh();
  return { ok: true as const, id: inv.id, number: inv.number, delivery };
}

/* ---------------- "I've paid" claims from the customer page ---------------- */
export async function confirmClaim(claimId: string) {
  await requireSession();
  const [claim] = await db.select().from(s.paymentClaims).where(eq(s.paymentClaims.id, claimId));
  if (!claim || claim.status !== "pending") return { ok: false as const, error: "This claim was already handled." };
  const { inv } = await ownInvoice(claim.invoiceId);
  const amount = Math.min(claim.amount, inv.total - inv.amountPaid);
  const res = await recordPayment({ invoiceId: inv.id, amount, receivedOn: claim.paidOn, method: "Bank transfer", reference: claim.reference });
  if (!res.ok) return res;
  await db.update(s.paymentClaims).set({ status: "confirmed" }).where(eq(s.paymentClaims.id, claim.id));
  refresh();
  return { ...res, number: inv.number };
}

export async function dismissClaim(claimId: string) {
  const session = await requireSession();
  const [claim] = await db.select().from(s.paymentClaims).where(eq(s.paymentClaims.id, claimId));
  if (!claim || claim.status !== "pending") return;
  const { inv } = await ownInvoice(claim.invoiceId);
  await db.update(s.paymentClaims).set({ status: "dismissed" }).where(eq(s.paymentClaims.id, claim.id));
  await db.insert(s.events).values({ workspaceId: session.workspace.id, invoiceId: inv.id, ...memberActor(session.member), title: "Payment claim dismissed", note: "Not found in the bank yet." });
  refresh();
}
