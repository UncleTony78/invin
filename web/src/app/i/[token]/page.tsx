import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicInvoiceView } from "@/components/screens/public-invoice";
import { getPublicInvoice } from "@/server/public";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/i/[token]">): Promise<Metadata> {
  const { token } = await params;
  const inv = await getPublicInvoice(token);
  return {
    title: inv ? `Invoice ${inv.number} from ${inv.business.name}` : "Invoice not found",
    robots: { index: false, follow: false }, // private link: never in search results
  };
}

export default async function CustomerInvoicePage({ params, searchParams }: PageProps<"/i/[token]">) {
  const [{ token }, { preview }] = await Promise.all([params, searchParams]);
  const inv = await getPublicInvoice(token);
  if (!inv) notFound();
  return <PublicInvoiceView inv={inv} preview={preview === "1"} />;
}
