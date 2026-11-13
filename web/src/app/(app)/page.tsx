import type { Metadata } from "next";
import { HomeView } from "@/components/screens/home-view";
import { toHomeMinor } from "@/lib/fx";
import type { Currency } from "@/lib/format";
import { isoDate } from "@/lib/invoice-math";
import { insights, listInvoices, paymentsSummary, pipeline, today } from "@/server/queries";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Home · InVin" };

export default async function HomePage() {
  const session = await requireSession();
  const [rows, pay, ins] = await Promise.all([listInvoices(session), paymentsSummary(session), insights(session)]);
  const t = today();
  const home = session.workspace.defaultCurrency;
  const pipe = pipeline(rows, pay.paidThisMonthUsd, pay.paidThisMonthCount, home);

  // Last six months of money in, plus next month's expected (open + scheduled due then)
  const now = new Date();
  const months = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = isoDate(d).slice(0, 7);
    const invoiced = rows.filter((r) => r.issueDate?.startsWith(key) && r.stored !== "cancelled").reduce((a, r) => a + toHomeMinor(r.total, r.currency, home), 0);
    const expected = i === 6 ? rows.filter((r) => (r.dueDate?.startsWith(key) || r.stored === "scheduled") && !["paid", "cancelled", "draft"].includes(r.stored)).reduce((a, r) => a + toHomeMinor(r.left, r.currency, home), 0) : 0;
    return { label: d.toLocaleDateString("en-US", { month: "short" }), invoiced, paid: i === 6 ? null : toHomeMinor(pay.byMonth.get(key) ?? 0, "USD", home), expected };
  });

  const soon = isoDate(now, 14);
  const upcoming = rows
    .filter((r) => (r.stored === "scheduled" && r.issueDate) || (["sent", "viewed", "partial"].includes(r.stored) && r.status !== "overdue" && r.dueDate && r.dueDate <= soon))
    .map((r) => ({ id: r.id, customer: r.customer, date: (r.stored === "scheduled" ? r.issueDate : r.dueDate)!, what: r.stored === "scheduled" ? `Scheduled invoice ${r.number} sends` : `${r.number} is due`, amount: r.left || r.total, currency: r.currency }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <HomeView
      greeting={`${greeting}, ${session.member.name.split(" ")[0]}`}
      dateLabel={now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
      pipeline={pipe}
      rows={rows}
      months={months}
      upcoming={upcoming}
      today={t}
      currency={home as Currency}
      insights={ins}
    />
  );
}
