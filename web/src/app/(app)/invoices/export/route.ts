import { listInvoices } from "@/server/queries";
import { requireSession } from "@/server/session";

export const dynamic = "force-dynamic";

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const STATUS: Record<string, string> = { draft: "Draft", scheduled: "Scheduled", sent: "Sent", viewed: "Opened", partial: "Partly paid", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled" };

/** Invoices as CSV. `?ids=a,b,c` exports just those (the current view or a selection); no ids exports everything. */
export async function GET(req: Request) {
  const session = await requireSession();
  const ids = new URL(req.url).searchParams.get("ids")?.split(",").filter(Boolean);
  const rows = (await listInvoices(session)).filter((r) => !ids?.length || ids.includes(r.id));
  const lines = [
    ["Invoice", "Customer", "Category", "Status", "Issued", "Due", "Currency", "Total", "Paid", "Left to pay"],
    ...rows.map((r) => [r.number, r.customer, r.category ?? "", STATUS[r.status] ?? r.status, r.issueDate ?? "", r.dueDate ?? "", r.currency, (r.total / 100).toFixed(2), (r.paid / 100).toFixed(2), (r.left / 100).toFixed(2)]),
  ];
  const csv = "﻿" + lines.map((l) => l.map((v) => cell(String(v))).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
