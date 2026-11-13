import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerView } from "@/components/screens/customer-view";
import { listCustomerSummaries, listInvoices } from "@/server/queries";
import { requireSession } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/customers/[id]">): Promise<Metadata> {
  const { id } = await params;
  const c = (await listCustomerSummaries(await requireSession())).find((x) => x.id === id);
  return { title: `${c?.name ?? "Customer"} · InVin` };
}

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  const session = await requireSession();
  const [summaries, rows] = await Promise.all([listCustomerSummaries(session), listInvoices(session)]);
  const customer = summaries.find((c) => c.id === id);
  if (!customer) notFound();
  return <CustomerView customer={customer} invoices={rows.filter((r) => r.customerId === id)} />;
}
