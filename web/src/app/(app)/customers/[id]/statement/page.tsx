import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatementView } from "@/components/screens/statement-view";
import { isoDate } from "@/lib/invoice-math";
import { statement, statementHtml } from "@/server/statements";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Statement · InVin" };

const valid = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

export default async function StatementPage({ params, searchParams }: PageProps<"/customers/[id]/statement">) {
  const { id } = await params;
  const sp = await searchParams;
  const now = new Date();
  const from = valid(sp.from) ? (sp.from as string) : `${now.getFullYear()}-01-01`;
  const to = valid(sp.to) ? (sp.to as string) : isoDate(now);
  const st = await statement(await requireSession(), id, from, to);
  if (!st) notFound();
  return <StatementView st={st} html={statementHtml(st)} />;
}
