import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EditorView } from "@/components/screens/editor-view";
import { remindersNote } from "@/lib/schedule";
import { getInvoiceDetail, listBankAccounts, listCatalog, listCustomers } from "@/server/queries";
import { requireSession } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/invoices/[number]/edit">): Promise<Metadata> {
  return { title: `Edit ${(await params).number} · InVin` };
}

export default async function EditDraftPage({ params }: PageProps<"/invoices/[number]/edit">) {
  const { number } = await params;
  const session = await requireSession();
  const d = await getInvoiceDetail(session, decodeURIComponent(number));
  if (!d) notFound();
  // Sent invoices are a record of what the customer got; only drafts are editable
  if (d.row.stored !== "draft") redirect(`/invoices?fresh=${d.row.number}`);
  const [customers, accounts, catalog] = await Promise.all([listCustomers(session), listBankAccounts(session), listCatalog(session)]);
  const ws = session.workspace;
  return (
    <EditorView
      key={d.row.id}
      nextNumber={d.row.number}
      draft={{
        id: d.row.id,
        customerId: d.row.customerId,
        issueDate: d.invoice.issueDate ?? new Date().toISOString().slice(0, 10),
        termsDays: d.invoice.termsDays,
        category: d.invoice.category,
        vatBps: d.invoice.vatBps,
        note: d.invoice.note,
        template: d.invoice.template,
        brandColor: d.invoice.brandColor,
        bankAccountId: d.invoice.bankAccountId,
        lines: d.lines,
      }}
      business={{ name: ws.name, mark: ws.mark, address: ws.address, email: ws.email }}
      defaults={{ template: ws.template, brandColor: ws.brandColor, remindersNote: remindersNote(ws.remindersOn, ws.reminderOffsets), categories: ws.categories }}
      sender={session.member.name.split(" ")[0]}
      customers={customers.map((c) => ({ id: c.id, name: c.name, email: c.email, address: c.address, currency: c.currency, termsDays: c.termsDays }))}
      accounts={accounts.map((a) => ({ id: a.id, currency: a.currency, bank: a.bank, rows: a.rows }))}
      catalog={catalog.map((c) => ({ id: c.id, name: c.name, unitPrice: c.unitPrice, currency: c.currency, unit: c.unit }))}
    />
  );
}
