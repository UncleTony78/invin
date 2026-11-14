import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicEstimateView } from "@/components/screens/public-estimate";
import { getPublicEstimate } from "@/server/estimates";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/e/[token]">): Promise<Metadata> {
  const est = await getPublicEstimate((await params).token);
  return { title: est ? `Estimate ${est.number} from ${est.business.name}` : "Estimate not found", robots: { index: false, follow: false } };
}

export default async function CustomerEstimatePage({ params, searchParams }: PageProps<"/e/[token]">) {
  const [{ token }, { preview }] = await Promise.all([params, searchParams]);
  const est = await getPublicEstimate(token);
  if (!est) notFound();
  return <PublicEstimateView est={est} preview={preview === "1"} />;
}
