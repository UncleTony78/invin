import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { isoDate } from "@/lib/invoice-math";
import type { Session } from "./session";

export type EstimateStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "converted" | "expired";

/** "Expired" isn't stored: it's a sent or opened estimate past its valid-until date. */
export function estimateStatus(stored: string, validUntil: string | null, day = isoDate(new Date())): EstimateStatus {
  if ((stored === "sent" || stored === "viewed") && validUntil && validUntil < day) return "expired";
  return stored as EstimateStatus;
}

export type EstimateRow = { id: string; number: string; customer: string; customerId: string; status: EstimateStatus; stored: string; total: number; currency: string; validUntil: string | null; issueDate: string | null };

export async function listEstimates(session: Session): Promise<EstimateRow[]> {
  const rows = await db
    .select({ e: s.estimates, customer: s.customers.name })
    .from(s.estimates)
    .innerJoin(s.customers, eq(s.customers.id, s.estimates.customerId))
    .where(eq(s.estimates.workspaceId, session.workspace.id))
    .orderBy(desc(s.estimates.number));
  return rows.map(({ e, customer }) => ({ id: e.id, number: e.number, customer, customerId: e.customerId, status: estimateStatus(e.status, e.validUntil), stored: e.status, total: e.total, currency: e.currency, validUntil: e.validUntil, issueDate: e.issueDate }));
}

export async function getEstimate(session: Session, idOrNumber: string) {
  const [hit] = await db
    .select({ e: s.estimates, c: s.customers })
    .from(s.estimates)
    .innerJoin(s.customers, eq(s.customers.id, s.estimates.customerId))
    .where(and(eq(s.estimates.workspaceId, session.workspace.id), or(eq(s.estimates.number, idOrNumber), eq(s.estimates.id, idOrNumber))));
  if (!hit) return null;
  const { e, c } = hit;
  const [events, invoices] = await Promise.all([
    db.select().from(s.events).where(eq(s.events.estimateId, e.id)).orderBy(desc(s.events.createdAt)),
    [e.invoiceId, e.depositInvoiceId].some(Boolean)
      ? db.select({ id: s.invoices.id, number: s.invoices.number, status: s.invoices.status, total: s.invoices.total }).from(s.invoices).where(inArray(s.invoices.id, [e.invoiceId, e.depositInvoiceId].filter((x): x is string => !!x)))
      : Promise.resolve([]),
  ]);
  return {
    ...e,
    displayStatus: estimateStatus(e.status, e.validUntil),
    customer: e.customerSnapshot ?? { name: c.name, email: c.email, address: c.address },
    customerTerms: c.termsDays,
    events: events.map((v) => ({ id: v.id, at: v.createdAt.toISOString(), title: v.title, actor: { type: v.actorType, label: v.actorLabel }, note: v.note })),
    invoices: invoices.map((i) => ({ ...i, kind: i.id === e.depositInvoiceId ? ("deposit" as const) : ("final" as const) })),
  };
}

export type EstimateDetail = NonNullable<Awaited<ReturnType<typeof getEstimate>>>;

/** For the customer's page: everything they may see, nothing else. Drafts are never public. */
export async function getPublicEstimate(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const [e] = await db.select().from(s.estimates).where(eq(s.estimates.publicToken, token));
  if (!e || e.status === "draft") return null;
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, e.workspaceId));
  return {
    token: e.publicToken, number: e.number, stored: e.status, status: estimateStatus(e.status, e.validUntil), currency: e.currency, issueDate: e.issueDate, validUntil: e.validUntil,
    total: e.total, vatBps: e.vatBps, note: e.note, template: e.template, brandColor: e.brandColor, lines: e.lines, customer: e.customerSnapshot!,
    acceptedBy: e.acceptedBy, acceptedAt: e.acceptedAt?.toISOString() ?? null, declineReason: e.declineReason,
    business: { name: ws.name, mark: ws.mark, address: ws.address, email: ws.email },
  };
}

export type PublicEstimate = NonNullable<Awaited<ReturnType<typeof getPublicEstimate>>>;
