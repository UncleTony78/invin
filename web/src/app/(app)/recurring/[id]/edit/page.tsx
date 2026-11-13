import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EditorView } from "@/components/screens/editor-view";
import { getSeries, listBankAccounts, listCatalog, listCustomers } from "@/server/queries";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Edit recurring invoice · InVin" };

export default async function EditSeriesPage({ params }: PageProps<"/recurring/[id]/edit">) {
  const { id } = await params;
  const session = await requireSession();
  const sr = await getSeries(session, id);
  if (!sr) notFound();
  if (sr.status === "ended") redirect(`/recurring/${id}`);
  const [customers, accounts, catalog] = await Promise.all([listCustomers(session), listBankAccounts(session), listCatalog(session)]);
  const ws = session.workspace;
  return (
    <EditorView
      key={sr.id}
      series={{ id: sr.id, nextRun: sr.nextRun }}
      nextNumber="Next in series"
      draft={{ id: sr.id, customerId: sr.customerId, issueDate: sr.nextRun ?? new Date().toISOString().slice(0, 10), ...sr.invoice }}
      business={{ name: ws.name, mark: ws.mark, address: ws.address, email: ws.email }}
      defaults={{ template: ws.template, brandColor: ws.brandColor, categories: ws.categories }}
      sender={session.member.name.split(" ")[0]}
      customers={customers.map((c) => ({ id: c.id, name: c.name, email: c.email, address: c.address, currency: c.currency, termsDays: c.termsDays }))}
      accounts={accounts.map((a) => ({ id: a.id, currency: a.currency, bank: a.bank, rows: a.rows }))}
      catalog={catalog.map((c) => ({ id: c.id, name: c.name, unitPrice: c.unitPrice, currency: c.currency, unit: c.unit }))}
    />
  );
}
