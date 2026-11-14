"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Avatar, Tabs } from "@/components/ui/identity";
import { Money } from "@/components/invoice/money";
import { EstimatePill } from "@/components/invoice/estimate-pill";
import type { Currency } from "@/lib/format";
import { formatDate } from "@/lib/invoice-math";
import type { EstimateRow } from "@/server/estimates";

const TABS = [
  { value: "all", label: "All", test: () => true },
  { value: "open", label: "Waiting for an answer", test: (r: EstimateRow) => r.status === "sent" || r.status === "viewed" },
  { value: "accepted", label: "Accepted", test: (r: EstimateRow) => r.status === "accepted" },
  { value: "done", label: "Invoiced", test: (r: EstimateRow) => r.status === "converted" },
  { value: "closed", label: "Declined or expired", test: (r: EstimateRow) => r.status === "declined" || r.status === "expired" },
  { value: "drafts", label: "Drafts", test: (r: EstimateRow) => r.status === "draft" },
] as const;

/** Every estimate, with what each one is waiting on. Rows open the estimate. */
export function EstimatesView({ rows }: { rows: EstimateRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("all");
  const list = useMemo(() => rows.filter(TABS.find((t) => t.value === tab)!.test), [rows, tab]);
  const accepted = rows.filter((r) => r.status === "accepted").length;
  return (
    <div className="wrap">
      <div className="ph">
        <div>
          <h1>Estimates</h1>
          <p className="sub">Prices your customers can accept online. {accepted ? `${accepted} accepted and ready to invoice.` : "Accepted ones become invoices in one click."}</p>
        </div>
        <div className="acts">
          <Link className="iv-btn iv-btn--primary" href="/estimates/new"><Icon name="plus" />New estimate</Link>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: rows.filter(t.test).length }))} />
      <table className="tbl" data-m="est" style={{ marginTop: 8 }}>
        <thead>
          <tr><th aria-hidden="true" /><th>Customer</th><th>Sent</th><th>Valid until</th><th>Status</th><th className="r">Amount</th></tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr><td colSpan={6} style={{ height: 160, textAlign: "center", whiteSpace: "normal" }}>
              <b className="font-medium">{rows.length ? "Nothing here" : "No estimates yet"}</b><br />
              <span className="text-text-2">{rows.length ? "Estimates in this view will show up here." : "Send a price before the work starts. When they accept, it becomes an invoice."}</span>
            </td></tr>
          )}
          {list.map((r) => (
            <tr key={r.id} data-row tabIndex={0} onClick={() => router.push(`/estimates/${r.number}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/estimates/${r.number}`)}>
              <td aria-hidden="true" />
              <td><span className="cust"><Avatar name={r.customer} size="md" /><span><b>{r.customer}</b><small>{r.number}</small></span></span></td>
              <td className="text-text-2">{r.stored === "draft" ? "Not sent" : r.issueDate ? formatDate(r.issueDate, { year: true }) : "—"}</td>
              <td className={r.status === "expired" ? "late" : "text-text-2"}>{r.validUntil ? formatDate(r.validUntil, { year: true }) : "—"}</td>
              <td><EstimatePill status={r.status} /></td>
              <td className="r font-medium"><Money value={r.total / 100} currency={r.currency as Currency} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
