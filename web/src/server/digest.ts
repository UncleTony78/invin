import "server-only";
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { formatMoney, type Currency } from "@/lib/format";
import { isoDate } from "@/lib/invoice-math";
import { appUrl, sendEmail } from "./email";
import { digestEmail } from "./email-templates";

/*
 * Email summaries. Each member picks off, daily or weekly (Monday). They go out from 8am,
 * once per period, and only when there's something to say.
 */

export type DigestKind = "off" | "daily" | "weekly";
const DAY = 24 * 60 * 60 * 1000;
const SEND_HOUR = 8;
const OPEN = ["sent", "viewed", "partial"] as const;

/** Sum minor units per currency, then "$1,200.00 + ₦50,000.00" */
function moneyLine(rows: { currency: string; amount: number }[]) {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.currency, (by.get(r.currency) ?? 0) + r.amount);
  const parts = [...by].filter(([, v]) => v !== 0).map(([c, v]) => formatMoney(v / 100, c as Currency));
  return parts.length ? parts.join(" + ") : null;
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What happened in a workspace between two moments. Null when there's nothing worth an email. */
export async function buildDigest(workspaceId: string, from: Date, to: Date, kind: Exclude<DigestKind, "off">) {
  const [ws] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  if (!ws) return null;
  const today = isoDate(to);
  const [paid, refunded, open, sent, events] = await Promise.all([
    db
      .select({ currency: s.invoices.currency, amount: s.payments.amount })
      .from(s.payments)
      .innerJoin(s.invoices, eq(s.invoices.id, s.payments.invoiceId))
      .where(and(eq(s.invoices.workspaceId, workspaceId), gte(s.payments.createdAt, from), lt(s.payments.createdAt, to))),
    db
      .select({ currency: s.invoices.currency, amount: s.refunds.amount })
      .from(s.refunds)
      .innerJoin(s.invoices, eq(s.invoices.id, s.refunds.invoiceId))
      .where(and(eq(s.invoices.workspaceId, workspaceId), gte(s.refunds.createdAt, from), lt(s.refunds.createdAt, to))),
    db
      .select({ currency: s.invoices.currency, left: sql<number>`${s.invoices.total} - ${s.invoices.amountPaid}`.mapWith(Number), due: s.invoices.dueDate })
      .from(s.invoices)
      .where(and(eq(s.invoices.workspaceId, workspaceId), inArray(s.invoices.status, [...OPEN]))),
    db
      .select({ currency: s.invoices.currency, amount: s.invoices.total })
      .from(s.invoices)
      .where(and(eq(s.invoices.workspaceId, workspaceId), gte(s.invoices.sentAt, from), lt(s.invoices.sentAt, to))),
    db
      .select({ title: s.notifications.title })
      .from(s.notifications)
      .where(and(eq(s.notifications.workspaceId, workspaceId), gte(s.notifications.createdAt, from), lt(s.notifications.createdAt, to)))
      .orderBy(desc(s.notifications.createdAt))
      .limit(9),
  ]);
  const late = open.filter((o) => o.due && o.due < today);
  if (!paid.length && !refunded.length && !sent.length && !events.length && !late.length) return null;

  const net = moneyLine([...paid, ...refunded.map((r) => ({ ...r, amount: -r.amount }))]);
  const stats = [
    { label: "Paid to you", value: net ?? "Nothing yet", note: paid.length ? plural(paid.length, "payment") + (refunded.length ? `, ${plural(refunded.length, "refund")}` : "") : undefined },
    { label: "Sent", value: plural(sent.length, "invoice"), note: moneyLine(sent) ?? undefined },
    { label: "Still to collect", value: moneyLine(open.map((o) => ({ currency: o.currency, amount: o.left }))) ?? "Nothing", note: open.length ? plural(open.length, "invoice") : undefined },
    { label: "Overdue", value: moneyLine(late.map((o) => ({ currency: o.currency, amount: o.left }))) ?? "Nothing", note: late.length ? plural(late.length, "invoice") : "All on time" },
  ];
  const period = kind === "daily" ? "your day" : "your week";
  const lead = net ? (net.includes(" + ") ? `${plural(paid.length, "payment")} in` : `${net} paid`) : late.length ? `${plural(late.length, "invoice")} overdue` : `${plural(sent.length, "invoice")} sent`;
  const shown = events.slice(0, 8).map((e) => e.title);
  if (events.length > 8) shown.push("And more in your notifications");
  return digestEmail({
    subject: `Your ${kind === "daily" ? "day" : "week"} at ${ws.name}: ${lead}`,
    business: ws.name,
    period,
    stats,
    events: shown,
    url: `${appUrl()}/`,
    settingsUrl: `${appUrl()}/settings#summary`,
  });
}

/** Whether a member's summary is due at `now` (server local time). */
export function digestDue(kind: string, lastSent: Date | null, now: Date) {
  if (kind !== "daily" && kind !== "weekly") return false;
  if (now.getHours() < SEND_HOUR) return false;
  if (kind === "weekly" && now.getDay() !== 1) return false;
  if (!lastSent) return true;
  const gap = kind === "daily" ? DAY / 2 : DAY * 6;
  return now.getTime() - lastSent.getTime() > gap && isoDate(lastSent) !== isoDate(now);
}

/** Runner job: send every summary that's due. Claims each one first so two runners never double-send. */
export async function runDigests(now = new Date()) {
  if (now.getHours() < SEND_HOUR) return 0;
  const rows = await db
    .select()
    .from(s.members)
    .where(and(inArray(s.members.digest, ["daily", "weekly"]), sql`${s.members.userId} is not null`, or(isNull(s.members.digestSentAt), lt(s.members.digestSentAt, new Date(now.getTime() - DAY / 2)))));
  let sent = 0;
  for (const m of rows) {
    if (!digestDue(m.digest, m.digestSentAt, now)) continue;
    const claimed = await db
      .update(s.members)
      .set({ digestSentAt: now })
      .where(and(eq(s.members.id, m.id), m.digestSentAt ? eq(s.members.digestSentAt, m.digestSentAt) : isNull(s.members.digestSentAt)))
      .returning({ id: s.members.id });
    if (!claimed.length) continue;
    const kind = m.digest as "daily" | "weekly";
    // From the last one, but never further back than the period (a first summary covers just that period)
    const span = kind === "daily" ? DAY : 7 * DAY;
    const from = new Date(Math.max(now.getTime() - span, m.digestSentAt?.getTime() ?? 0));
    try {
      const mail = await buildDigest(m.workspaceId, from, now, kind);
      if (!mail) continue; // Quiet period: nothing to send, and the claim stops us checking again today
      await sendEmail({ workspaceId: m.workspaceId, to: m.email, ...mail });
      sent++;
    } catch (e) {
      console.error("[invin] summary not sent:", e instanceof Error ? e.message : e);
    }
  }
  return sent;
}
