"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/identity";
import { useToast } from "@/components/ui/toast";
import { Money } from "@/components/invoice/money";
import { formatShort, type Currency } from "@/lib/format";
import { toHomeMinor, toUsdMinor } from "@/lib/fx";
import { useWorkspaceCurrency } from "@/components/shell/workspace-context";
import { formatDate } from "@/lib/invoice-math";
import type { CustomerSummary } from "@/server/queries";
import { CustomerDialog } from "./customer-form";

type Sort = "owed" | "name" | "recent";

export function CustomersView({ customers }: { customers: CustomerSummary[] }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("owed");

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    const f = customers.filter((c) => !n || `${c.name} ${c.email}`.toLowerCase().includes(n));
    const usd = (c: CustomerSummary) => toUsdMinor(c.outstanding, c.currency);
    return [...f].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "recent" ? (b.lastInvoice ?? "").localeCompare(a.lastInvoice ?? "") : usd(b) - usd(a)));
  }, [customers, q, sort]);

  const home = useWorkspaceCurrency() as Currency;
  const owed = customers.reduce((a, c) => a + toHomeMinor(c.outstanding, c.currency, home), 0);
  const lateCount = customers.filter((c) => c.overdue > 0).length;

  return (
    <div className="wrap">
      <div className="ph">
        <div>
          <h1>Customers</h1>
          <p className="sub">
            {customers.length} customers · about {formatShort(owed / 100, home)} owed{lateCount ? ` · ${lateCount} with overdue invoices` : ""}
          </p>
        </div>
        <div className="acts">
          <CustomerDialog
            trigger={<Button variant="primary" icon="plus">New customer</Button>}
            onSaved={(id, v) => {
              toast({ title: `${v.name} added` });
              router.push(`/customers/${id}`);
            }}
          />
        </div>
      </div>

      <div className="toolbar">
        <label className="field-s">
          <Icon name="search" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers" aria-label="Search customers by name or email" />
        </label>
        <span className="sp" />
        <Segmented
          label="Sort customers"
          value={sort}
          onChange={setSort}
          options={[
            { value: "owed", label: "Most owed" },
            { value: "name", label: "A to Z" },
            { value: "recent", label: "Latest invoice" },
          ]}
        />
      </div>

      <table className="tbl" data-m="cust">
        <thead>
          <tr>
            <th aria-hidden="true" />
            <th>Customer</th>
            <th>Pays in</th>
            <th>Usually pays</th>
            <th>Latest invoice</th>
            <th className="r">Billed in total</th>
            <th className="r">Owed now</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={7} style={{ height: 160, textAlign: "center", whiteSpace: "normal" }}>
                {q ? <><b className="font-medium">No customers match “{q}”</b><br /><span className="text-text-2">Check the spelling, or search by email.</span></> : <><b className="font-medium">No customers yet</b><br /><span className="text-text-2">Add your first customer to start invoicing them.</span></>}
              </td>
            </tr>
          )}
          {list.map((c) => {
            const cur = c.currency as Currency;
            return (
              <tr key={c.id} data-row onClick={() => router.push(`/customers/${c.id}`)}>
                <td aria-hidden="true" />
                <td>
                  <span className="cust">
                    <Avatar name={c.name} size="md" />
                    <span><b>{c.name}</b><small style={{ fontFamily: "inherit" }}>{c.email}</small></span>
                  </span>
                </td>
                <td className="text-text-2">{c.currency}</td>
                <td className="text-text-2">{c.avgDaysToPay === null ? "—" : c.avgDaysToPay <= 1 ? "Same day" : `In ${c.avgDaysToPay} days`}</td>
                <td className="text-text-2">{c.lastInvoice ? formatDate(c.lastInvoice, { year: true }) : "—"}</td>
                <td className="r text-text-2"><Money value={c.billed / 100} currency={cur} /></td>
                <td className="r">
                  <span className="amt-c">
                    <b>{c.outstanding ? <Money value={c.outstanding / 100} currency={cur} /> : <span className="text-text-2">—</span>}</b>
                    {c.overdue > 0 && <small className="late"><Money value={c.overdue / 100} currency={cur} /> overdue</small>}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
