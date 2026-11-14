import { notFound } from "next/navigation";
import { InvoicePaper, type Template } from "@/components/invoice/paper";
import type { Currency } from "@/lib/format";
import { formatDate } from "@/lib/invoice-math";
import { getPublicEstimate } from "@/server/estimates";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/* Paper only, sized to A4, for the PDF route. */
export default async function PrintEstimate({ params }: PageProps<"/e/[token]/print">) {
  const est = await getPublicEstimate((await params).token);
  if (!est) notFound();
  const cur = est.currency as Currency;
  return (
    <div className="print-page">
      <InvoicePaper
        invoice={{
          number: est.number, issued: formatDate(est.issueDate, { year: true }), due: formatDate(est.validUntil, { year: true }), currency: cur, doc: "estimate",
          customer: { ...est.customer, currency: cur }, items: est.lines.map((l) => ({ description: l.description, quantity: l.quantity, price: l.unitPrice / 100 })),
          vatRate: est.vatBps / 10000, note: est.note,
        }}
        business={est.business}
        account={{ id: "", currency: cur, bank: "", rows: [] }}
        template={(est.template as Template) || "stacked"}
        brand={est.brandColor}
        fontSize={15.5}
      />
    </div>
  );
}
