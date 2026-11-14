import { pdfReady, renderHtmlPdf } from "@/server/pdf";
import { statement, statementHtml } from "@/server/statements";
import { requireSession } from "@/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, ctx: RouteContext<"/customers/[id]/statement/pdf">) {
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const st = await statement(await requireSession(), id, sp.get("from") ?? "", sp.get("to") ?? "");
  if (!st) return new Response("Customer not found", { status: 404 });
  if (!pdfReady()) return new Response("PDF rendering isn't set up yet (CHROME_PATH).", { status: 503 });
  const pdf = await renderHtmlPdf(statementHtml(st));
  const name = `Statement ${st.customer.name} ${st.from} to ${st.to}.pdf`.replace(/[^\w .-]/g, "");
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" },
  });
}
