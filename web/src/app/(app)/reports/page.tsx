import type { Metadata } from "next";
import { ReportsView } from "@/components/screens/reports-view";
import { previousRange, report, resolveRange } from "@/server/reports";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Reports · InVin" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const session = await requireSession();
  const range = resolveRange({ range: pick("range"), from: pick("from"), to: pick("to") });
  const [data, prev] = await Promise.all([report(session, range), report(session, previousRange(range))]);
  return <ReportsView data={{ ...data, previous: { invoiced: prev.invoiced, collected: prev.collected } }} rangeKey={range.key} />;
}
