import type { Metadata } from "next";
import { EstimatesView } from "@/components/screens/estimates-view";
import { listEstimates } from "@/server/estimates";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Estimates · InVin" };

export default async function EstimatesPage() {
  return <EstimatesView rows={await listEstimates(await requireSession())} />;
}
