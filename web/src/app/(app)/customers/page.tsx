import type { Metadata } from "next";
import { CustomersView } from "@/components/screens/customers-view";
import { listCustomerSummaries } from "@/server/queries";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Customers · InVin" };

export default async function CustomersPage() {
  const session = await requireSession();
  return <CustomersView customers={await listCustomerSummaries(session)} />;
}
