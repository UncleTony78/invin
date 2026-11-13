"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/identity";
import { Money } from "@/components/invoice/money";
import { useInvoiceSheet } from "@/components/shell/invoice-sheet";
import type { Currency } from "@/lib/format";
import { formatDate } from "@/lib/invoice-math";
import type { PaymentRow } from "@/server/queries";

/** Every payment recorded, newest first. Totals stay per currency: they're never added across currencies. */
export function PaymentsView({ payments, month }: { payments: PaymentRow[]; month: string }) {
  const sheet = useInvoiceSheet();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return payments.filter((p) => !n || `${p.customer} ${p.number} ${p.reference} ${p.method}`.toLowerCase().includes(n));
  }, [payments, q]);
  useEffect(() => {
    sheet.setOrder(list.map((p) => p.invoiceId));
  });

  const byCur = new Map<string, { month: number; all: number }>();
  for (const p of payments) {
    const t = byCur.get(p.currency) ?? { month: 0, all: 0 };
    t.all += p.amount;
    if (p.receivedOn.startsWith(month)) t.month += p.amount;
    byCur.set(p.currency, t);
  }

  return (
    <div className="wrap">
      <div className="ph">
        <div>
          <h1>Payments</h1>
          <p className="sub">{payments.length} payments recorded. Click one to open its invoice.</p>
        </div>
        <div className="acts">
          <a className="iv-btn iv-btn--secondary" href="/payments/export" download>
            <Icon name="download" />
            Export CSV
          </a>
        </div>
      </div>

      <dl className="cfacts" style={{ gridTemplateColumns: `repeat(${Math.max(2, byCur.size)}, minmax(0, 1fr))` }}>
        {[...byCur.entries()].map(([cur, t]) => (
          <div key={cur}>
            <dt>{cur} this month</dt>
            <dd><Money value={t.month / 100} currency={cur as Currency} /></dd>
            <small><Money value={t.all / 100} currency={cur as Currency} /> in total</small>
          </div>
        ))}
      </dl>

      <div className="toolbar">
        <label className="field-s">
          <Icon name="search" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search payments" aria-label="Search payments by customer, invoice or reference" />
        </label>
      </div>

      <table className="tbl" data-m="pay">
        <thead>
          <tr>
            <th aria-hidden="true" />
            <th>Received</th>
            <th>From</th>
            <th>How</th>
            <th>Reference</th>
            <th>Recorded by</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr><td colSpan={7} style={{ height: 140, textAlign: "center", whiteSpace: "normal" }}>{q ? `No payments match “${q}”.` : "No payments yet. Record one from an invoice when money arrives."}</td></tr>
          )}
          {list.map((p) => (
            <tr key={p.id} data-row data-selected={sheet.current === p.invoiceId || undefined} onClick={() => sheet.open(p.invoiceId)}>
              <td aria-hidden="true" />
              <td>{formatDate(p.receivedOn, { year: true })}</td>
              <td>
                <span className="cust">
                  <Avatar name={p.customer} size="md" />
                  <span><b>{p.customer}</b><small>{p.number}</small></span>
                </span>
              </td>
              <td className="text-text-2">{p.method}</td>
              <td className="text-text-2 iv-mono">{p.reference || "—"}</td>
              <td className="text-text-2">{p.recordedBy}</td>
              <td className="r font-medium"><Money value={p.amount / 100} currency={p.currency as Currency} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
