import { notFound } from "next/navigation";
import { InvoicePaper, type Template } from "@/components/invoice/paper";
import { toPaper } from "@/lib/public-paper";
import type { Currency } from "@/lib/format";
import { getPublicInvoice } from "@/server/public";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/* Paper only, sized to A4. The PDF route prints this page, so the PDF is the same renderer as the screen. */
export default async function PrintInvoice({ params }: PageProps<"/i/[token]/print">) {
  const { token } = await params;
  const inv = await getPublicInvoice(token);
  if (!inv) notFound();
  const cur = inv.currency as Currency;
  return (
    <div className="print-page">
      <InvoicePaper
        invoice={toPaper(inv)}
        business={inv.business}
        account={{ id: "a", currency: cur, bank: inv.bank?.bank ?? "", rows: inv.bank?.rows ?? [] }}
        template={(inv.template as Template) || "stacked"}
        brand={inv.brandColor}
        fontSize={15.5}
        stamp={inv.stored === "paid" ? { kind: "paid" } : inv.stored === "cancelled" ? { kind: "cancelled" } : undefined}
      />
    </div>
  );
}
