"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { Money } from "@/components/invoice/money";
import { formatShort, type Currency } from "@/lib/format";
import { formatDate } from "@/lib/invoice-math";
import type { Report } from "@/server/reports";

const RANGES = [
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "year", label: "This year" },
  { key: "12m", label: "Last 12 months" },
  { key: "last-year", label: "Last year" },
];

function change(now: number, before: number) {
  if (!before) return null;
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  return { pct, up: pct >= 0 };
}

/** Money in and out over a period, what's still owed and how late, and where it comes from. */
export function ReportsView({ data: r, rangeKey }: { data: Report; rangeKey: string }) {
  const router = useRouter();
  const cur = r.home as Currency;
  const [from, setFrom] = useState(r.range.from);
  const [to, setTo] = useState(r.range.to);
  const label = RANGES.find((x) => x.key === rangeKey)?.label ?? "Custom dates";
  const go = (qs: string) => router.push(`/reports?${qs}`);
  const inv = change(r.invoiced, r.previous?.invoiced ?? 0);
  const col = change(r.collected, r.previous?.collected ?? 0);
  const owedTotal = r.buckets.reduce((a, b) => a + b.amount, 0) || 1;

  return (
    <div className="wrap rep">
      <div className="ph">
        <div>
          <h1>Reports</h1>
          <p className="sub">{formatDate(r.range.from, { year: true })} to {formatDate(r.range.to, { year: true })} · in {r.home}, other currencies converted at approximate rates</p>
        </div>
        <div className="acts">
          <Menu>
            <MenuTrigger>
              <Button icon="clock">{label}<Icon name="chevron" /></Button>
            </MenuTrigger>
            <MenuContent align="end">
              {RANGES.map((x) => (
                <MenuItem key={x.key} onClick={() => go(`range=${x.key}`)}>
                  {x.label}
                  {x.key === rangeKey && <span className="iv-right"><Icon name="check" /></span>}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
          <Popover>
            <PopoverTrigger>
              <Button variant={rangeKey === "custom" ? "secondary" : "ghost"}>Custom dates</Button>
            </PopoverTrigger>
            <PopoverContent align="end" width={280}>
              <form className="rep-dates" onSubmit={(e) => { e.preventDefault(); if (from <= to) go(`range=custom&from=${from}&to=${to}`); }}>
                <label className="iv-field"><span className="iv-label">From</span><input className="iv-input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
                <label className="iv-field"><span className="iv-label">To</span><input className="iv-input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
                <Button type="submit" variant="primary" icon="check">Show these dates</Button>
              </form>
            </PopoverContent>
          </Popover>
          <Menu>
            <MenuTrigger>
              <Button iconOnly icon="download" aria-label="Export this report" />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem render={<a href={`/reports/export?from=${r.range.from}&to=${r.range.to}`} download />}><Icon name="download" />Download CSV</MenuItem>
              <MenuSeparator />
              <MenuItem onClick={() => window.print()}><Icon name="file" />Print or save as PDF</MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      <dl className="cfacts">
        <div>
          <dt>Invoiced</dt>
          <dd><Money value={r.invoiced / 100} currency={cur} /></dd>
          <small>{r.issuedCount} invoice{r.issuedCount === 1 ? "" : "s"}{inv && <Delta d={inv} />}</small>
        </div>
        <div>
          <dt>Collected</dt>
          <dd><Money value={r.collected / 100} currency={cur} /></dd>
          <small>After refunds{col && <Delta d={col} />}</small>
        </div>
        <div>
          <dt>Owed to you now</dt>
          <dd><Money value={r.outstanding / 100} currency={cur} /></dd>
          <small>{r.overdue ? <span className="late"><Money value={r.overdue / 100} currency={cur} /> overdue</span> : "Nothing overdue"}</small>
        </div>
        <div>
          <dt>Usually paid in</dt>
          <dd>{r.avgDays === null ? "—" : r.avgDays <= 1 ? "Same day" : `${r.avgDays} days`}</dd>
          <small>From issue to paid, this period</small>
        </div>
      </dl>

      <section className="rep-sec">
        <header>
          <h2 className="sec-h">Invoiced and collected</h2>
          <span className="rep-key"><i data-k="inv" />Invoiced <i data-k="col" />Collected</span>
        </header>
        <MonthChart months={r.months} currency={cur} />
      </section>

      <div className="rep-two">
        <section className="rep-sec">
          <header><h2 className="sec-h">What&apos;s owed, by how late</h2></header>
          <div className="aging" aria-hidden="true">
            {r.buckets.filter((b) => b.amount).map((b) => <i key={b.key} data-k={b.key} style={{ flexGrow: b.amount }} />)}
          </div>
          <ul className="aging-list">
            {r.buckets.map((b) => (
              <li key={b.key} data-empty={!b.count || undefined}>
                <span className="aging-dot" data-k={b.key} />
                <span className="flex-1">{b.label}<small>{b.count} invoice{b.count === 1 ? "" : "s"}{b.numbers.length ? ` · ${b.numbers.slice(0, 3).join(", ")}${b.numbers.length > 3 ? "…" : ""}` : ""}</small></span>
                <span className="text-right">
                  <b><Money value={b.amount / 100} currency={cur} /></b>
                  <small>{Math.round((b.amount / owedTotal) * 100)}%</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rep-sec">
          <header><h2 className="sec-h">At a glance</h2></header>
          <dl className="rep-glance">
            <div><dt>Recurring each month</dt><dd><Money value={r.recurring / 100} currency={cur} /></dd><small>From {r.activeSeries} active series · <Link className="iv-link" href="/recurring">See them</Link></small></div>
            <div><dt>VAT on invoices issued</dt><dd><Money value={r.tax / 100} currency={cur} /></dd><small>What you&apos;ve charged, to set aside for tax</small></div>
          </dl>
        </section>
      </div>

      <Breakdown title="By customer" rows={r.customers} currency={cur} />
      <Breakdown title="By category" rows={r.categories} currency={cur} />

      <section className="rep-sec">
        <header>
          <h2 className="sec-h">By currency</h2>
          <p className="sec-hint">The original amounts, not converted.</p>
        </header>
        <table className="tbl" data-m="rcur">
          <thead><tr><th aria-hidden="true" /><th>Currency</th><th className="r">Invoiced</th><th className="r">Collected</th><th className="r">Owed now</th><th className="r">VAT</th></tr></thead>
          <tbody>
            {r.currencies.length === 0 && <tr><td colSpan={6} className="text-text-2" style={{ height: 80, textAlign: "center" }}>No invoices in this period.</td></tr>}
            {r.currencies.map((c) => (
              <tr key={c.currency}>
                <td aria-hidden="true" />
                <td className="font-medium">{c.currency}</td>
                <td className="r"><Money value={c.invoiced / 100} currency={c.currency as Currency} /></td>
                <td className="r"><Money value={c.collected / 100} currency={c.currency as Currency} /></td>
                <td className="r"><Money value={c.outstanding / 100} currency={c.currency as Currency} /></td>
                <td className="r text-text-2"><Money value={c.tax / 100} currency={c.currency as Currency} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Delta({ d }: { d: { pct: number; up: boolean } }) {
  return <span className="delta" data-up={d.up || undefined}> · {d.up ? "▲" : "▼"} {Math.abs(d.pct)}% on the period before</span>;
}

function Breakdown({ title, rows, currency }: { title: string; rows: Report["customers"]; currency: Currency }) {
  const max = Math.max(...rows.map((r) => r.invoiced), 1);
  return (
    <section className="rep-sec">
      <header><h2 className="sec-h">{title}</h2></header>
      <table className="tbl" data-m="rbrk">
        <thead><tr><th aria-hidden="true" /><th>{title.replace("By ", "").replace(/^./, (c) => c.toUpperCase())}</th><th className="r">Invoiced</th><th className="r">Collected</th><th className="r">Owed now</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="text-text-2" style={{ height: 80, textAlign: "center" }}>Nothing in this period.</td></tr>}
          {rows.map((r) => (
            <tr key={r.key}>
              <td aria-hidden="true" />
              <td>
                {r.href ? <Link href={r.href} className="rep-name">{r.label}</Link> : r.label}
                <span className="rep-bar" aria-hidden="true"><i style={{ transform: `scaleX(${r.invoiced / max})` }} /></span>
              </td>
              <td className="r"><Money value={r.invoiced / 100} currency={currency} /><small className="block text-[12px] text-text-2">{r.count} invoice{r.count === 1 ? "" : "s"}</small></td>
              <td className="r"><Money value={r.collected / 100} currency={currency} /></td>
              <td className="r">{r.outstanding ? <Money value={r.outstanding / 100} currency={currency} /> : <span className="text-text-2">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Two bars a month: invoiced (outline) and collected (solid). Hover a month for the numbers. */
function MonthChart({ months, currency }: { months: Report["months"]; currency: Currency }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 960, H = 220, pl = 52, pb = 26;
  const peak = Math.max(30000, ...months.flatMap((m) => [m.invoiced, m.collected]));
  const raw = peak / 3, pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((f) => f * pow).find((v) => v >= raw)!;
  const max = step * Math.ceil(peak / step);
  const y = (v: number) => H - pb - (Math.max(0, v) / max) * (H - pb - 8);
  const cw = (W - pl) / Math.max(1, months.length);
  const bw = Math.min(26, cw * 0.3);
  if (!months.length) return <p className="text-text-2">No months in this range.</p>;
  return (
    <div className="chart rep-chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Invoiced and collected per month">
        {Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step).map((t, i) => (
          <g key={i}>
            <line x1={pl} x2={W} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-2)">{t ? formatShort(t / 100, currency) : "0"}</text>
          </g>
        ))}
        {months.map((m, i) => {
          const cx = pl + cw * i + cw / 2;
          return (
            <g key={m.key} onMouseEnter={() => setHover(i)} opacity={hover === null || hover === i ? 1 : 0.45} style={{ transition: "opacity 140ms ease" }}>
              <rect x={pl + cw * i} y={0} width={cw} height={H - pb} fill="transparent" />
              <rect className="bar-in" x={cx - bw - 2} y={y(m.invoiced)} width={bw} height={H - pb - y(m.invoiced)} rx={4} fill="none" stroke="var(--text-2)" strokeWidth={1.25} style={{ animationDelay: `${i * 30}ms` }} />
              <rect className="bar-in" x={cx + 2} y={y(m.collected)} width={bw} height={H - pb - y(m.collected)} rx={4} fill="var(--st-paid)" style={{ animationDelay: `${i * 30 + 60}ms` }} />
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-2)">{m.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="ctip" style={{ left: `min(calc(${((pl + cw * hover + cw / 2) / W) * 100}% + 12px), calc(100% - 180px))`, top: 8 }}>
          <b>{months[hover].label}</b>
          <br />Invoiced <Money value={months[hover].invoiced / 100} currency={currency} />
          <br />Collected <Money value={months[hover].collected / 100} currency={currency} />
        </div>
      )}
    </div>
  );
}
