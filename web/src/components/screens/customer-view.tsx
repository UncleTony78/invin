"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/identity";
import { useToast } from "@/components/ui/toast";
import { Money } from "@/components/invoice/money";
import { StatusPill } from "@/components/invoice/status";
import { useInvoiceSheet } from "@/components/shell/invoice-sheet";
import { formatMoney, type Currency } from "@/lib/format";
import { formatDate } from "@/lib/invoice-math";
import type { CustomerSummary, InvoiceRow } from "@/server/queries";
import { CustomerDialog } from "./customer-form";

export function CustomerView({ customer: c, invoices, credit = 0 }: { customer: CustomerSummary; invoices: InvoiceRow[]; credit?: number }) {
  const router = useRouter();
  const sheet = useInvoiceSheet();
  const toast = useToast();
  const cur = c.currency as Currency;
  useEffect(() => {
    sheet.setOrder(invoices.map((r) => r.id));
  });

  const facts: [string, React.ReactNode, string?][] = [
    ["Owed now", <Money key="o" value={c.outstanding / 100} currency={cur} />, credit > 0 ? `${formatMoney(credit / 100, cur)} in credit, used on their next invoice` : c.overdue ? undefined : "Nothing overdue"],
    ["Overdue", c.overdue ? <span key="v" className="late"><Money value={c.overdue / 100} currency={cur} /></span> : "—"],
    ["Billed in total", <Money key="b" value={c.billed / 100} currency={cur} />, `${c.invoices} invoice${c.invoices === 1 ? "" : "s"}`],
    ["Usually pays", c.avgDaysToPay === null ? "—" : c.avgDaysToPay <= 1 ? "Same day" : `In ${c.avgDaysToPay} days`, `Their terms: ${c.termsDays ? `${c.termsDays} days` : "on receipt"}`],
  ];

  return (
    <div className="wrap">
      <div className="ph">
        <div className="flex items-center gap-4">
          <Avatar name={c.name} size="lg" />
          <div>
            <h1>{c.name}</h1>
            <p className="sub">{[c.email, c.address, `Pays in ${c.currency}`].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="acts">
          <CustomerDialog
            id={c.id}
            initial={{ name: c.name, email: c.email, address: c.address, currency: c.currency, termsDays: c.termsDays }}
            trigger={<Button icon="pencil">Edit details</Button>}
            onSaved={() => {
              toast({ title: "Customer details saved" });
              router.refresh();
            }}
          />
          <Button variant="primary" icon="plus" onClick={() => router.push(`/invoices/new?customer=${c.id}`)}>New invoice</Button>
        </div>
      </div>

      <dl className="cfacts">
        {facts.map(([k, v, hint]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
            {hint && <small>{hint}</small>}
          </div>
        ))}
      </dl>

      <h2 className="sec-h" style={{ marginTop: 36 }}>Invoices <span className="ct">{invoices.length}</span></h2>
      {invoices.length === 0 ? (
        <div className="empty">
          <b>No invoices for {c.name} yet.</b>
          <Link className="iv-link" href={`/invoices/new?customer=${c.id}`}>Create their first invoice</Link>
        </div>
      ) : (
        <table className="tbl" data-m="cinv" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th aria-hidden="true" />
              <th>Invoice</th>
              <th>Sent</th>
              <th>Due</th>
              <th>Status</th>
              <th className="r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((r) => (
              <tr key={r.id} data-row data-selected={sheet.current === r.id || undefined} onClick={() => sheet.open(r.id)}>
                <td aria-hidden="true" />
                <td className="iv-mono">{r.number}</td>
                <td className="text-text-2">{r.issueDate ? formatDate(r.issueDate, { year: true }) : "Not sent"}</td>
                <td className={r.status === "overdue" ? "late" : "text-text-2"}>{r.due}</td>
                <td><StatusPill status={r.status} /></td>
                <td className="r">
                  <span className="amt-c">
                    <b><Money value={r.total / 100} currency={r.currency as Currency} /></b>
                    {r.stored === "partial" && <small><Money value={r.left / 100} currency={r.currency as Currency} /> left</small>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
