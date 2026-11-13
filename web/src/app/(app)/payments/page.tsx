import type { Metadata } from "next";
import { PaymentsView } from "@/components/screens/payments-view";
import { listPayments, today } from "@/server/queries";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Payments · InVin" };

export default async function PaymentsPage() {
  const session = await requireSession();
  return <PaymentsView payments={await listPayments(session)} month={today().slice(0, 7)} />;
}
