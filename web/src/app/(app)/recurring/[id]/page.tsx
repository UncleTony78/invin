import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeriesView } from "@/components/screens/series-view";
import { getSeries } from "@/server/queries";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Recurring series · InVin" };

export default async function SeriesPage({ params }: PageProps<"/recurring/[id]">) {
  const series = await getSeries(await requireSession(), (await params).id);
  if (!series) notFound();
  return <SeriesView s={series} />;
}
