import type { Metadata } from "next";
import { CatalogueView } from "@/components/screens/catalogue-view";
import { catalogUsage, listCatalog } from "@/server/queries";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Catalogue · InVin" };

export default async function CataloguePage() {
  const session = await requireSession();
  const [items, used] = await Promise.all([listCatalog(session), catalogUsage(session)]);
  return <CatalogueView items={items.map((i) => ({ id: i.id, name: i.name, price: i.unitPrice / 100, currency: i.currency, unit: i.unit, used: used(i.name) }))} />;
}
