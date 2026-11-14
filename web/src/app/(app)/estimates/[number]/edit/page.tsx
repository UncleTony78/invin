import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EditorView } from "@/components/screens/editor-view";
import { getEstimate } from "@/server/estimates";
import { listBankAccounts, listCatalog, listCustomers } from "@/server/queries";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Edit estimate · InVin" };

export default async function EditEstimatePage({ params }: PageProps<"/estimates/[number]/edit">) {
  const { number } = await params;
  const session = await requireSession();
  const e = await getEstimate(session, decodeURIComponent(number));
  if (!e) notFound();
  if (e.status !== "draft") redirect(`/estimates/${e.number}`);
  const [customers, accounts, catalog] = await Promise.all([listCustomers(session), listBankAccounts(session), listCatalog(session)]);
  const ws = session.workspace;
  return (
    <EditorView
      key={e.id}
      estimate={{ id: e.id, validDays: e.validDays }}
      nextNumber={e.number}
      draft={{ id: e.id, customerId: e.customerId, issueDate: e.issueDate ?? new Date().toISOString().slice(0, 10), termsDays: e.customerTerms, category: e.category, vatBps: e.vatBps, note: e.note, template: e.template, brandColor: e.brandColor, bankAccountId: null, lines: e.lines }}
      business={{ name: ws.name, mark: ws.mark, address: ws.address, email: ws.email }}
      defaults={{ template: ws.template, brandColor: ws.brandColor, categories: ws.categories }}
      sender={session.member.name.split(" ")[0]}
      customers={customers.map((c) => ({ id: c.id, name: c.name, email: c.email, address: c.address, currency: c.currency, termsDays: c.termsDays }))}
      accounts={accounts.map((a) => ({ id: a.id, currency: a.currency, bank: a.bank, rows: a.rows }))}
      catalog={catalog.map((c) => ({ id: c.id, name: c.name, unitPrice: c.unitPrice, currency: c.currency, unit: c.unit }))}
    />
  );
}
