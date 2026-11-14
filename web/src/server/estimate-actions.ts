"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { formatMoney, type Currency } from "@/lib/format";
import { amountProblem, computeTotals, formatDate } from "@/lib/invoice-math";
import { dueFrom, issueInvoice, rememberCategory, today } from "./billing";
import { appUrl, sendEmail } from "./email";
import { estimateEmail } from "./email-templates";
import { requireSession } from "./session";

const refresh = () => revalidatePath("/", "layout");
type Session = Awaited<ReturnType<typeof requireSession>>;
const actor = (session: Session) => ({ actorType: "member" as const, actorId: session.member.id, actorLabel: session.member.name });

export type EstimateInput = {
  customerId: string;
  issueDate: string;
  validDays: number;
  category: string;
  vatBps: number;
  note: string;
  template: string;
  brandColor: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
  email?: { to: string; subject: string; message: string };
};

async function ownEstimate(idOrNumber: string) {
  const session = await requireSession();
  const [est] = await db
    .select()
    .from(s.estimates)
    .where(and(sql`(${s.estimates.id} = ${idOrNumber} or ${s.estimates.number} = ${idOrNumber})`, eq(s.estimates.workspaceId, session.workspace.id)));
  if (!est) throw new Error("Estimate not found");
  return { session, est };
}

const log = (session: Session, estimateId: string, title: string, note?: string) =>
  db.insert(s.events).values({ workspaceId: session.workspace.id, estimateId, ...actor(session), title, note: note ?? null });

/** Create or update a draft estimate, or send it. Only drafts can change; a sent estimate is what the customer saw. */
export async function saveEstimate(id: string | null, input: EstimateInput, mode: "draft" | "send") {
  const session = await requireSession();
  const ws = session.workspace;
  const [customer] = await db.select().from(s.customers).where(and(eq(s.customers.id, input.customerId), eq(s.customers.workspaceId, ws.id)));
  if (!customer) return { ok: false as const, error: "Choose a customer first." };
  const lines = input.lines.filter((l) => l.description.trim() || l.unitPrice > 0);
  if (mode === "send" && !lines.some((l) => l.unitPrice > 0)) return { ok: false as const, error: "Add a price to at least one item." };
  const tooBig = amountProblem(lines, input.vatBps);
  if (tooBig) return { ok: false as const, error: tooBig };
  const totals = computeTotals(lines, input.vatBps);
  const issue = input.issueDate || today();
  const validDays = [7, 14, 30, 60].includes(input.validDays) ? input.validDays : 30;
  const sending = mode === "send";
  const values = {
    customerId: customer.id, currency: customer.currency, category: input.category || "General", issueDate: issue, validDays, validUntil: dueFrom(issue, validDays),
    template: input.template, brandColor: input.brandColor, note: input.note, vatBps: input.vatBps, lines, ...totals,
    ...(sending ? { status: "sent", sentAt: new Date(), customerSnapshot: { name: customer.name, email: customer.email, address: customer.address } } : {}),
  };

  let est: typeof s.estimates.$inferSelect;
  if (id) {
    const { est: cur } = await ownEstimate(id);
    if (cur.status !== "draft") return { ok: false as const, error: "Only drafts can be edited. Make a new estimate instead." };
    [est] = await db.update(s.estimates).set(values).where(eq(s.estimates.id, cur.id)).returning();
  } else {
    est = await db.transaction(async (tx) => {
      const [w] = await tx.update(s.workspaces).set({ nextEstimate: sql`${s.workspaces.nextEstimate} + 1` }).where(eq(s.workspaces.id, ws.id)).returning();
      const number = `${w.estimatePrefix}${String(w.nextEstimate - 1).padStart(4, "0")}`;
      const [e] = await tx.insert(s.estimates).values({ workspaceId: ws.id, number, createdBy: session.member.id, ...values }).returning();
      return e;
    });
    await log(session, est.id, "Estimate created");
  }
  await rememberCategory(db, ws, input.category);

  let delivery: string | undefined;
  if (sending) {
    const amount = formatMoney(est.total / 100, est.currency as Currency);
    const validUntil = formatDate(est.validUntil!, { year: true });
    const to = input.email?.to || customer.email;
    const mail = estimateEmail({
      brand: est.brandColor, business: ws.name, number: est.number, amount, validUntil, url: `${appUrl()}/e/${est.publicToken}`,
      message: input.email?.message || `Hi ${customer.name.split(" ")[0]},\n\nHere's estimate ${est.number} for ${amount}. You can accept it online; it's valid until ${validUntil}.\n\nThanks,\n${session.member.name.split(" ")[0]}`,
    });
    const res = await sendEmail({ workspaceId: ws.id, to, subject: input.email?.subject || `Estimate ${est.number} from ${ws.name}`, ...mail, replyTo: ws.email, fromName: ws.name });
    delivery = res.status;
    await log(session, est.id, `Estimate sent to ${to}`);
  }
  refresh();
  return { ok: true as const, id: est.id, number: est.number, delivery };
}

/** Record a decision made outside InVin (by phone, email, in person). */
export async function markEstimate(id: string, decision: "accepted" | "declined", note?: string) {
  const { session, est } = await ownEstimate(id);
  if (!["sent", "viewed", "accepted", "declined"].includes(est.status)) return { ok: false as const, error: "Send the estimate first." };
  await db
    .update(s.estimates)
    .set(decision === "accepted" ? { status: "accepted", acceptedAt: new Date(), acceptedBy: `${session.member.name} (recorded)` } : { status: "declined", declineReason: note?.trim() || null })
    .where(eq(s.estimates.id, est.id));
  await log(session, est.id, decision === "accepted" ? "Marked as accepted" : "Marked as declined", note);
  refresh();
  return { ok: true as const };
}

export async function deleteEstimate(id: string) {
  const { est } = await ownEstimate(id);
  if (est.status !== "draft") return { ok: false as const, error: "Only drafts can be deleted. Sent estimates stay on record." };
  await db.delete(s.events).where(eq(s.events.estimateId, est.id));
  await db.delete(s.estimates).where(eq(s.estimates.id, est.id));
  refresh();
  return { ok: true as const };
}

/**
 * Turn an accepted estimate into invoice drafts, ready to check and send.
 * - "full": one invoice with the estimate's items.
 * - "deposit": an invoice for a share of the total now; "rest" later bills what's left.
 */
export async function convertEstimate(id: string, how: { kind: "full" } | { kind: "deposit"; pct: number } | { kind: "rest" }) {
  const { session, est } = await ownEstimate(id);
  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, est.customerId));
  const base = { customerId: customer.id, issueDate: today(), termsDays: customer.termsDays, category: est.category, note: est.note, template: est.template, brandColor: est.brandColor, bankAccountId: "" };
  const make = (lines: { description: string; quantity: number; unitPrice: number }[], vatBps: number, title: string) =>
    issueInvoice({ ws: session.workspace, customer, mode: "draft", actor: actor(session), createdBy: session.member.id, createdTitle: title, input: { ...base, vatBps, lines } });
  const [acct] = await db.select().from(s.bankAccounts).where(and(eq(s.bankAccounts.workspaceId, session.workspace.id), eq(s.bankAccounts.currency, customer.currency)));
  if (acct) base.bankAccountId = acct.id;

  if (how.kind === "full") {
    if (est.status !== "accepted") return { ok: false as const, error: "Only accepted estimates can be invoiced." };
    const r = await make(est.lines, est.vatBps, `Invoice created from estimate ${est.number}`);
    await db.update(s.estimates).set({ status: "converted", invoiceId: r.id }).where(eq(s.estimates.id, est.id));
    await log(session, est.id, `Turned into invoice ${r.number}`);
    refresh();
    return { ok: true as const, number: r.number, id: r.id };
  }
  if (how.kind === "deposit") {
    if (est.status !== "accepted") return { ok: false as const, error: "Only accepted estimates can be invoiced." };
    const pct = Math.round(how.pct);
    if (!(pct >= 5 && pct <= 95)) return { ok: false as const, error: "Choose a deposit between 5% and 95%." };
    const amount = Math.round((est.subtotal * pct) / 100);
    const r = await make([{ description: `Deposit (${pct}%) for estimate ${est.number}`, quantity: 1, unitPrice: amount }], est.vatBps, `Deposit invoice created from estimate ${est.number}`);
    await db.update(s.estimates).set({ depositBps: pct * 100, depositInvoiceId: r.id }).where(eq(s.estimates.id, est.id));
    await log(session, est.id, `Deposit invoice ${r.number} created (${pct}%)`);
    refresh();
    return { ok: true as const, number: r.number, id: r.id };
  }
  // The rest: everything not covered by the deposit, as one clear line
  if (!est.depositBps || !est.depositInvoiceId) return { ok: false as const, error: "There's no deposit invoice to follow up." };
  const depositAmount = Math.round((est.subtotal * est.depositBps) / 10000);
  const [dep] = await db.select({ number: s.invoices.number }).from(s.invoices).where(eq(s.invoices.id, est.depositInvoiceId));
  const r = await make([{ description: `Balance for estimate ${est.number}, after deposit ${dep?.number ?? ""}`.trim(), quantity: 1, unitPrice: est.subtotal - depositAmount }], est.vatBps, `Final invoice created from estimate ${est.number}`);
  await db.update(s.estimates).set({ status: "converted", invoiceId: r.id }).where(eq(s.estimates.id, est.id));
  await log(session, est.id, `Final invoice ${r.number} created`);
  refresh();
  return { ok: true as const, number: r.number, id: r.id };
}
