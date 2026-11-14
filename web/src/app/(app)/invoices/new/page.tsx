import type { Metadata } from "next";
import { EditorView } from "@/components/screens/editor-view";
import { FirstCustomer } from "@/components/screens/first-customer";
import { remindersNote } from "@/lib/schedule";
import { listBankAccounts, listCatalog, listCustomers } from "@/server/queries";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "New invoice · InVin" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const { customer, repeat } = await searchParams;
  const session = await requireSession();
  const [customers, accounts, catalog] = await Promise.all([listCustomers(session), listBankAccounts(session), listCatalog(session)]);
  if (customers.length === 0) return <FirstCustomer />;
  const ws = session.workspace;
  return (
    <EditorView
      preselect={typeof customer === "string" ? customer : undefined}
      repeat={repeat === "1"}
      nextNumber={`${ws.numberPrefix}${String(ws.nextNumber).padStart(4, "0")}`}
      business={{ name: ws.name, mark: ws.mark, address: ws.address, email: ws.email }}
      defaults={{ template: ws.template, brandColor: ws.brandColor, category: ws.work, remindersNote: remindersNote(ws.remindersOn, ws.reminderOffsets), categories: ws.categories, customFields: ws.customFields }}
      sender={session.member.name.split(" ")[0]}
      customers={customers.map((c) => ({ id: c.id, name: c.name, email: c.email, address: c.address, currency: c.currency, termsDays: c.termsDays }))}
      accounts={accounts.map((a) => ({ id: a.id, currency: a.currency, bank: a.bank, rows: a.rows }))}
      catalog={catalog.map((c) => ({ id: c.id, name: c.name, unitPrice: c.unitPrice, currency: c.currency, unit: c.unit }))}
    />
  );
}
