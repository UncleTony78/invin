"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { formatMoney, type Currency } from "@/lib/format";
import { formatDate } from "@/lib/invoice-math";
import { appUrl, sendEmail } from "./email";
import { claimNotice } from "./email-templates";
import { today } from "./queries";

/* Actions a customer can take on their invoice page. No session: the public token is the key,
   so every action re-reads the invoice by token and checks it is in a state that allows it. */

async function byToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const [inv] = await db.select().from(s.invoices).where(eq(s.invoices.publicToken, token));
  return inv ?? null;
}

/** First open by the customer moves Sent → Opened and is logged once. */
export async function trackView(token: string) {
  const inv = await byToken(token);
  if (!inv || inv.status !== "sent") return;
  const [c] = await db.select().from(s.customers).where(eq(s.customers.id, inv.customerId));
  await db.update(s.invoices).set({ status: "viewed" }).where(and(eq(s.invoices.id, inv.id), eq(s.invoices.status, "sent")));
  await db.insert(s.events).values({ workspaceId: inv.workspaceId, invoiceId: inv.id, title: "Customer opened the invoice", actorType: "customer", actorLabel: c?.name ?? "Customer" });
  revalidatePath("/", "layout");
}

export async function submitClaim(token: string, input: { amount: number; paidOn: string; reference: string; note: string }) {
  const inv = await byToken(token);
  if (!inv) return { ok: false as const, error: "We couldn't find this invoice." };
  if (!["sent", "viewed", "partial"].includes(inv.status)) return { ok: false as const, error: "This invoice isn't waiting for payment." };
  const left = inv.total - inv.amountPaid;
  const amount = Math.round(input.amount);
  const cur = inv.currency as Currency;
  if (!(amount > 0)) return { ok: false as const, error: "Enter the amount you paid." };
  if (amount > left) return { ok: false as const, error: `That's more than the ${formatMoney(left / 100, cur)} left to pay.` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn) || input.paidOn > today()) return { ok: false as const, error: "Choose the date you paid. It can't be in the future." };
  const pending = await db.select().from(s.paymentClaims).where(and(eq(s.paymentClaims.invoiceId, inv.id), eq(s.paymentClaims.status, "pending")));
  if (pending.length >= 3) return { ok: false as const, error: "You've already told them about this payment. They'll confirm it soon." };

  const reference = input.reference.trim().slice(0, 80);
  const note = input.note.trim().slice(0, 500);
  const [c] = await db.select().from(s.customers).where(eq(s.customers.id, inv.customerId));
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, inv.workspaceId));
  const amountLabel = formatMoney(amount / 100, cur);

  await db.insert(s.paymentClaims).values({ invoiceId: inv.id, amount, paidOn: input.paidOn, reference, note });
  await db.insert(s.events).values({
    workspaceId: inv.workspaceId, invoiceId: inv.id, actorType: "customer", actorLabel: c?.name ?? "Customer",
    title: `Customer says they paid ${amountLabel}`, note: [reference && `Reference ${reference}`, note].filter(Boolean).join(" · ") || null,
  });
  const mail = claimNotice({ customer: c?.name ?? "Your customer", number: inv.number, amount: amountLabel, paidOn: formatDate(input.paidOn, { year: true }), reference, note, url: `${appUrl()}/invoices?inv=${inv.number}` });
  await sendEmail({ workspaceId: inv.workspaceId, invoiceId: inv.id, to: ws.email, subject: `${c?.name ?? "A customer"} says they paid ${inv.number}`, ...mail });
  revalidatePath("/", "layout");
  revalidatePath(`/i/${token}`);
  return { ok: true as const, business: ws.name };
}
