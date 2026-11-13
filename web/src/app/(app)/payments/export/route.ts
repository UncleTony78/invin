import { listPayments } from "@/server/queries";
import { requireSession } from "@/server/session";

export const dynamic = "force-dynamic";

/* CSV for accountants and spreadsheets. Amounts in major units with their currency, never converted. */
const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function GET() {
  const session = await requireSession();
  const rows = await listPayments(session);
  const lines = [
    ["Date received", "Customer", "Invoice", "Amount", "Currency", "Method", "Reference", "Recorded by"],
    ...rows.map((p) => [p.receivedOn, p.customer, p.number, (p.amount / 100).toFixed(2), p.currency, p.method, p.reference, p.recordedBy]),
  ];
  const csv = "﻿" + lines.map((l) => l.map((v) => cell(String(v))).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
