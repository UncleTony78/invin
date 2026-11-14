import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EstimateView } from "@/components/screens/estimate-view";
import { getEstimate } from "@/server/estimates";
import { requireSession } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/estimates/[number]">): Promise<Metadata> {
  return { title: `${decodeURIComponent((await params).number)} · InVin` };
}

export default async function EstimatePage({ params }: PageProps<"/estimates/[number]">) {
  const session = await requireSession();
  const e = await getEstimate(session, decodeURIComponent((await params).number));
  if (!e) notFound();
  const ws = session.workspace;
  return <EstimateView e={e} business={{ name: ws.name, mark: ws.mark, address: ws.address, email: ws.email }} />;
}
