import { listCustomers } from "@/server/queries";
import { requireSession } from "@/server/session";

export const dynamic = "force-dynamic";

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Customers as CSV, in the same columns the importer reads, so a round trip works. */
export async function GET() {
  const session = await requireSession();
  const rows = await listCustomers(session);
  const lines = [["Name", "Email", "Address", "Currency", "Payment terms"], ...rows.map((c) => [c.name, c.email, c.address, c.currency, String(c.termsDays)])];
  const csv = "﻿" + lines.map((l) => l.map((v) => cell(String(v))).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
