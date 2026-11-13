import type { Metadata } from "next";
import { RecurringView } from "@/components/screens/recurring-view";
import { listSeries } from "@/server/queries";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Recurring · InVin" };

export default async function RecurringPage() {
  return <RecurringView rows={await listSeries(await requireSession())} />;
}
