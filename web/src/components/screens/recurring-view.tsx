"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/identity";
import { Money } from "@/components/invoice/money";
import { useWorkspaceCurrency } from "@/components/shell/workspace-context";
import type { Currency } from "@/lib/format";
import { toHomeMinor } from "@/lib/fx";
import { formatDate } from "@/lib/invoice-math";
import type { SeriesRow } from "@/server/queries";

const PER_MONTH = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

export function SeriesPill({ status }: { status: SeriesRow["status"] }) {
  const label = { active: "Active", paused: "Paused", ended: "Ended" }[status];
  return (
    <span className={`iv-pill sr-${status}`}>
      <Icon name={status === "active" ? "repeat" : status === "paused" ? "clock" : "check"} size={13} />
      {label}
    </span>
  );
}

/** Every recurring series, active first. Each row opens its series page. */
export function RecurringView({ rows }: { rows: SeriesRow[] }) {
  const router = useRouter();
  const home = useWorkspaceCurrency() as Currency;
  const active = rows.filter((r) => r.status === "active");
  const monthly = active.reduce((a, r) => a + toHomeMinor(r.total, r.currency, home) * PER_MONTH[r.frequency], 0);
  const next = active.filter((r) => r.nextRun).sort((a, b) => a.nextRun!.localeCompare(b.nextRun!))[0];

  return (
    <div className="wrap">
      <div className="ph">
        <div>
          <h1>Recurring</h1>
          <p className="sub">Invoices that repeat on a schedule. InVin makes each one on time, then sends it or drafts it for you to check.</p>
        </div>
        <div className="acts">
          <Link className="iv-btn iv-btn--primary" href="/invoices/new?repeat=1">
            <Icon name="plus" />
            New recurring invoice
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty" style={{ paddingTop: 40 }}>
          <b>Nothing repeats yet.</b>
          Bill a retainer or subscription once, and turn on <i>Repeat</i> in the editor. You can also open any invoice and choose <i>Make recurring</i>.
        </div>
      ) : (
        <>
          <dl className="cfacts" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <div>
              <dt>Billed each month</dt>
              <dd><Money value={Math.round(monthly) / 100} currency={home} /></dd>
              <small>From {active.length} active series, in {home}</small>
            </div>
            <div>
              <dt>Next invoice</dt>
              <dd>{next ? formatDate(next.nextRun!, {}) : "None scheduled"}</dd>
              <small>{next ? `${next.customer}, ${next.mode === "send" ? "sends by itself" : "as a draft"}` : "Every series is paused or ended"}</small>
            </div>
            <div>
              <dt>Series</dt>
              <dd>{rows.length}</dd>
              <small>{active.length} active · {rows.filter((r) => r.status === "paused").length} paused · {rows.filter((r) => r.status === "ended").length} ended</small>
            </div>
          </dl>

          <table className="tbl" data-m="rec" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th aria-hidden="true" />
                <th>Customer</th>
                <th>Next invoice</th>
                <th>Each time</th>
                <th>Made</th>
                <th>Status</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-row tabIndex={0} onClick={() => router.push(`/recurring/${r.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/recurring/${r.id}`)}>
                  <td aria-hidden="true" />
                  <td>
                    <span className="cust">
                      <Avatar name={r.customer} size="md" />
                      <span><b>{r.customer}</b><small className="sr-sched">{r.schedule}</small></span>
                    </span>
                  </td>
                  <td>{r.status === "active" && r.nextRun ? formatDate(r.nextRun, { year: true }) : <span className="text-text-2">—</span>}</td>
                  <td className="text-text-2">{r.mode === "send" ? "Sends itself" : "Draft to check"}</td>
                  <td className="text-text-2">{r.endAfter != null ? `${r.invoicesMade} of ${r.endAfter}` : r.invoicesMade}</td>
                  <td><SeriesPill status={r.status} /></td>
                  <td className="r font-medium"><Money value={r.total / 100} currency={r.currency as Currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
