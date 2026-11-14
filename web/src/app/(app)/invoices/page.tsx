import type { Metadata } from "next";
import { InvoicesView } from "@/components/screens/invoices-view";
import { listInvoices, paymentsSummary, pipeline } from "@/server/queries";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Invoices · InVin" };

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const { view, fresh, q } = await searchParams;
  const session = await requireSession();
  const [rows, pay] = await Promise.all([listInvoices(session), paymentsSummary(session)]);
  return <InvoicesView rows={rows} pipeline={pipeline(rows, pay.paidThisMonthUsd, pay.paidThisMonthCount, session.workspace.defaultCurrency)} initialView={typeof view === "string" ? view : "all"} fresh={typeof fresh === "string" ? fresh : undefined} initialQ={typeof q === "string" ? q : undefined} categories={session.workspace.categories} />;
}
