import { getPublicEstimate } from "@/server/estimates";
import { pdfName, pdfReady, renderPathPdf } from "@/server/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: RouteContext<"/e/[token]/pdf">) {
  const { token } = await ctx.params;
  const est = await getPublicEstimate(token);
  if (!est) return new Response("Estimate not found", { status: 404 });
  if (!pdfReady()) return new Response("PDF rendering isn't set up yet (CHROME_PATH).", { status: 503 });
  const pdf = await renderPathPdf(`/e/${token}/print`);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdfName(est.business.name, est.number)}"`, "Cache-Control": "private, no-store" },
  });
}
