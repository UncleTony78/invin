import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { displayStatus, type StoredStatus } from "@/lib/status";
import { today } from "./queries";

/* Read model for the customer's invoice page. Reached only by the unguessable public token,
   and returns only what the customer is allowed to see. */
export type PublicInvoice = {
  token: string;
  number: string;
  stored: StoredStatus;
  status: ReturnType<typeof displayStatus>["status"];
  daysLate: number;
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  total: number;
  paid: number;
  left: number;
  vatBps: number;
  note: string;
  template: string;
  brandColor: string;
  business: { name: string; mark: string; address: string; email: string };
  customer: { name: string; email: string; address: string };
  lines: { description: string; quantity: number; unitPrice: number }[];
  bank: { bank: string; rows: [string, string][] } | null;
  pendingClaim: { amount: number; paidOn: string; reference: string } | null;
};

export async function getPublicInvoice(token: string): Promise<PublicInvoice | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const [row] = await db
    .select({ inv: s.invoices, ws: s.workspaces, cust: s.customers })
    .from(s.invoices)
    .innerJoin(s.workspaces, eq(s.workspaces.id, s.invoices.workspaceId))
    .innerJoin(s.customers, eq(s.customers.id, s.invoices.customerId))
    .where(eq(s.invoices.publicToken, token));
  // Drafts and not-yet-sent invoices are private
  if (!row || row.inv.status === "draft" || row.inv.status === "scheduled") return null;
  const { inv, ws, cust } = row;
  const [lines, bank, claims] = await Promise.all([
    db.select().from(s.lineItems).where(eq(s.lineItems.invoiceId, inv.id)).orderBy(asc(s.lineItems.position)),
    inv.bankAccountId ? db.select().from(s.bankAccounts).where(eq(s.bankAccounts.id, inv.bankAccountId)) : Promise.resolve([]),
    db.select().from(s.paymentClaims).where(and(eq(s.paymentClaims.invoiceId, inv.id), eq(s.paymentClaims.status, "pending"))),
  ]);
  const d = displayStatus(inv.status, inv.dueDate, today());
  const claim = claims.at(-1);
  return {
    token,
    number: inv.number,
    stored: inv.status,
    status: d.status,
    daysLate: d.daysLate,
    currency: inv.currency,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    total: inv.total,
    paid: inv.amountPaid,
    left: Math.max(0, inv.total - inv.amountPaid),
    vatBps: inv.vatBps,
    note: inv.note,
    template: inv.template,
    brandColor: inv.brandColor,
    business: { name: ws.name, mark: ws.mark, address: ws.address, email: ws.email },
    customer: inv.customerSnapshot ?? { name: cust.name, email: cust.email, address: cust.address },
    lines: lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })),
    bank: bank[0] ? { bank: bank[0].bank, rows: bank[0].rows } : null,
    pendingClaim: claim ? { amount: claim.amount, paidOn: claim.paidOn, reference: claim.reference } : null,
  };
}
