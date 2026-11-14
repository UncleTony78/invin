import type { Metadata } from "next";
import { EditorView } from "@/components/screens/editor-view";
import { FirstCustomer } from "@/components/screens/first-customer";
import { listBankAccounts, listCatalog, listCustomers } from "@/server/queries";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "New estimate · InVin" };

export default async function NewEstimatePage({ searchParams }: PageProps<"/estimates/new">) {
  const { customer } = await searchParams;
  const session = await requireSession();
  const [customers, accounts, catalog] = await Promise.all([listCustomers(session), listBankAccounts(session), listCatalog(session)]);
  if (customers.length === 0) return <FirstCustomer />;
  const ws = session.workspace;
  return (
    <EditorView
      estimate={{ id: null }}
      preselect={typeof customer === "string" ? customer : undefined}
      nextNumber={`${ws.estimatePrefix}${String(ws.nextEstimate).padStart(4, "0")}`}
      business={{ name: ws.name, mark: ws.mark, address: ws.address, email: ws.email }}
      defaults={{ template: ws.template, brandColor: ws.brandColor, category: ws.work, categories: ws.categories }}
      sender={session.member.name.split(" ")[0]}
      customers={customers.map((c) => ({ id: c.id, name: c.name, email: c.email, address: c.address, currency: c.currency, termsDays: c.termsDays }))}
      accounts={accounts.map((a) => ({ id: a.id, currency: a.currency, bank: a.bank, rows: a.rows }))}
      catalog={catalog.map((c) => ({ id: c.id, name: c.name, unitPrice: c.unitPrice, currency: c.currency, unit: c.unit }))}
    />
  );
}
