import { getPublicInvoice } from "@/server/public";
import { pdfName, pdfReady, renderInvoicePdf } from "@/server/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: RouteContext<"/i/[token]/pdf">) {
  const { token } = await ctx.params;
  const inv = await getPublicInvoice(token);
  if (!inv) return new Response("Invoice not found", { status: 404 });
  if (!pdfReady()) return new Response("PDF rendering isn't set up yet (CHROME_PATH).", { status: 503 });
  const pdf = await renderInvoicePdf(token);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfName(inv.business.name, inv.number)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
