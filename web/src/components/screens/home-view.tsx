"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/identity";
import { Tooltip } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { Money } from "@/components/invoice/money";
import { MoneyPipeline, type PipelineKey } from "@/components/invoice/pipeline";
import { useInvoiceSheet } from "@/components/shell/invoice-sheet";
import { formatShort, type Currency } from "@/lib/format";
import { sendReminder } from "@/server/actions";
import type { Insight, InvoiceRow, PipelineData } from "@/server/queries";

type Month = { label: string; invoiced: number; paid: number | null; expected: number };
type Upcoming = { id: string; customer: string; date: string; what: string; amount: number; currency: string };

const VIEW_FOR: Record<PipelineKey, string> = { draft: "drafts", open: "open", overdue: "overdue", paid: "paid" };

export function HomeView({ greeting, dateLabel, pipeline, rows, months, upcoming, currency, insights }: { greeting: string; dateLabel: string; pipeline: PipelineData; rows: InvoiceRow[]; months: Month[]; upcoming: Upcoming[]; today: string; currency: Currency; insights: { customers: Insight[]; services: Insight[]; categories: Insight[]; total: number } }) {
  const router = useRouter();
  const sheet = useInvoiceSheet();
  const overdue = rows.filter((r) => r.status === "overdue").sort((a, b) => b.daysLate - a.daysLate);
  const opened = rows.filter((r) => r.status === "viewed");
  const drafts = rows.filter((r) => r.status === "draft");
  const owed = pipeline.open[0] + pipeline.overdue[0];
  useEffect(() => {
    sheet.setOrder([...overdue, ...opened, ...drafts].map((r) => r.id));
  });

  return (
    <div className="wrap">
      <div className="ph">
        <div>
          <h1>{greeting}</h1>
          <p className="sub">
            {dateLabel} · {overdue.length ? `${overdue.length} invoice${overdue.length === 1 ? " needs" : "s need"} a nudge` : "nothing is overdue"}
          </p>
        </div>
        <div className="acts">
          {overdue[0] && (
            <Button icon="cash" onClick={() => sheet.open(overdue[0].id, { pay: true })}>
              Record a payment
            </Button>
          )}
          <Button variant="primary" icon="plus" onClick={() => router.push("/invoices/new")}>
            New invoice
          </Button>
        </div>
      </div>

      <div className="pipe">
        <div className="owed">
          <span className="lbl">Owed to you</span>
          <div><Money value={owed / 100} currency={currency} /></div>
          <small>
            across {pipeline.open[1] + pipeline.overdue[1]} invoices, {pipeline.overdue[1]} overdue
          </small>
        </div>
        <MoneyPipeline
          currency={currency}
          onSelect={(k) => router.push(`/invoices?view=${VIEW_FOR[k]}`)}
          segments={[
            { key: "draft", label: "Drafts", value: pipeline.draft[0] / 100, count: pipeline.draft[1], note: "not sent" },
            { key: "open", label: "Not due yet", value: pipeline.open[0] / 100, count: pipeline.open[1] },
            { key: "overdue", label: "Overdue", value: pipeline.overdue[0] / 100, count: pipeline.overdue[1] },
            { key: "paid", label: "Paid this month", value: pipeline.paid[0] / 100, count: pipeline.paid[1] },
          ]}
        />
      </div>

      <div className="home">
        <section aria-labelledby="todo">
          <h2 className="sec-h" id="todo">
            To do <span className="ct">{overdue.length + opened.length + drafts.length}</span>
            <span className="sp" />
            <Link className="iv-link text-[13px]" href="/invoices">All invoices</Link>
          </h2>
          <p className="sec-hint">Invoices waiting on you, most urgent first.</p>
          {overdue.length + opened.length + drafts.length === 0 ? (
            <div className="empty"><b>You&apos;re all caught up.</b>New invoices that need you will show up here.</div>
          ) : (
            <>
              <QueueGroup title="Overdue" rows={overdue} why={(r) => <span className="late">{r.due}</span>} />
              <QueueGroup title="Opened, not paid yet" rows={opened} why={(r) => `due ${r.due.toLowerCase()}`} />
              <QueueGroup title="Drafts to finish" rows={drafts} why={() => "not sent yet"} draft />
            </>
          )}
        </section>
        <div className="grid content-start gap-10">
          <section aria-labelledby="in">
            <h2 className="sec-h" id="in">Money in</h2>
            <div className="stat-line">
              <div><b><Money value={pipeline.paid[0] / 100} currency={currency} /></b>paid this month</div>
              <div><b>{pipeline.paid[1]}</b>invoice{pipeline.paid[1] === 1 ? "" : "s"} paid</div>
            </div>
            <Chart months={months} currency={currency} />
            <p className="mt-2 text-[12px] text-text-2">Shown in {currency}. Other currencies are converted at approximate rates.</p>
          </section>
          <section aria-labelledby="up">
            <h2 className="sec-h" id="up">Coming up</h2>
            <div className="mt-2">
              {upcoming.length === 0 && <div className="empty">Nothing due in the next two weeks.</div>}
              {upcoming.map((u) => {
                const [y, m, d] = u.date.split("-").map(Number);
                const dt = new Date(y, m - 1, d);
                return (
                  <button key={u.id} type="button" className="urow w-full text-left" onClick={() => sheet.open(u.id)}>
                    <span className="date-chip"><b>{dt.getDate()}</b><small>{dt.toLocaleDateString("en-US", { month: "short" })}</small></span>
                    <span className="who"><b>{u.customer}</b><small>{u.what}</small></span>
                    <span><Money value={u.amount / 100} currency={u.currency as Currency} /></span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {insights.total > 0 && (
        <section className="ins" aria-labelledby="ins-h">
          <header>
            <h2 className="sec-h" id="ins-h">Where your money comes from</h2>
            <p className="sec-hint">The last 12 months of invoices you sent, in {currency}.</p>
          </header>
          <div className="ins-grid">
            <InsightList title="Top customers" items={insights.customers} currency={currency} />
            <InsightList title="Best sellers" items={insights.services} currency={currency} />
            <InsightList title="By category" items={insights.categories} currency={currency} />
          </div>
        </section>
      )}
    </div>
  );
}

/** A short ranked list: each row's bar shows its share of everything billed, growing in once on load. */
function InsightList({ title, items, currency }: { title: string; items: Insight[]; currency: Currency }) {
  const max = Math.max(...items.map((i) => i.share), 0.0001);
  return (
    <div className="ins-col">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="text-[13px] text-text-2">Nothing here yet.</p>
      ) : (
        <ol>
          {items.map((it, k) => {
            const row = (
              <>
                <span className="ins-top">
                  <span className="min-w-0 truncate">{it.label}</span>
                  <b><Money value={it.value / 100} currency={currency} /></b>
                </span>
                <span className="ins-bar" aria-hidden="true"><i style={{ transform: `scaleX(${it.share / max})`, animationDelay: `${k * 50}ms` }} /></span>
                <small>{it.sub} · {Math.round(it.share * 100)}% of the total</small>
              </>
            );
            return <li key={it.label}>{it.href ? <Link href={it.href} className="ins-row">{row}</Link> : <div className="ins-row">{row}</div>}</li>;
          })}
        </ol>
      )}
    </div>
  );
}

function QueueGroup({ title, rows, why, draft }: { title: string; rows: InvoiceRow[]; why: (r: InvoiceRow) => React.ReactNode; draft?: boolean }) {
  const sheet = useInvoiceSheet();
  const toast = useToast();
  const [sent, setSent] = useState<Set<string>>(new Set());
  if (!rows.length) return null;
  return (
    <div className="queue-g">
      <header><b>{title}</b><span>{rows.length}</span></header>
      {rows.map((r) => (
        <div key={r.id} className="qrow" role="button" tabIndex={0} onClick={() => sheet.open(r.id)} onKeyDown={(e) => e.key === "Enter" && sheet.open(r.id)}>
          <Avatar name={r.customer} size="md" />
          <span className="who">
            <b>{r.customer}</b>
            <small><span className="iv-mono">{r.number}</span> · {why(r)}</small>
          </span>
          <span className="amt"><Money value={(draft ? r.total : r.left) / 100} currency={r.currency as Currency} /></span>
          <span className="go" onClick={(e) => e.stopPropagation()}>
            {draft ? (
              <Button size="sm" onClick={() => sheet.open(r.id)}>Finish</Button>
            ) : (
              <>
                <Button
                  size="sm"
                  disabled={sent.has(r.id)}
                  onClick={async () => {
                    setSent(new Set(sent).add(r.id));
                    const res = await sendReminder(r.id);
                    toast({ title: res.delivery === "sent" ? `Reminder sent to ${res.to}` : `Reminder saved. Email is in test mode, see Sent emails.` });
                  }}
                >
                  {sent.has(r.id) ? "Sent" : "Remind"}
                </Button>
                <Tooltip label="Record payment">
                  <Button size="sm" variant="ghost" iconOnly icon="cash" aria-label={`Record payment for ${r.number}`} onClick={() => sheet.open(r.id, { pay: true })} />
                </Tooltip>
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Invoiced (grey) vs paid (green) per month; next month dashed = expected. Crosshair follows the pointer. */
function Chart({ months, currency }: { months: Month[]; currency: Currency }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520, H = 190, pl = 40, pb = 22;
  // Round axis steps (1, 2 or 5 × 10ⁿ) so labels read $2k, $4k, $6k rather than $9.63k
  // Floor of 300 (major units) keeps an empty chart readable: 0, 100, 200, 300
  const peak = Math.max(30000, ...months.map((m) => Math.max(m.invoiced, m.paid ?? 0, m.expected)));
  const raw = peak / 3, pow = 10 ** Math.floor(Math.log10(raw));
  const stepV = [1, 2, 5, 10].map((f) => f * pow).find((v) => v >= raw)!;
  const max = stepV * Math.ceil(peak / stepV);
  const cw = (W - pl) / months.length;
  const y = (v: number) => H - pb - (v / max) * (H - pb - 6);
  const ticks = Array.from({ length: Math.round(max / stepV) + 1 }, (_, i) => Math.round((i * stepV) / 100));
  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Invoiced and paid per month">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pl} x2={W} y1={y(t * 100)} y2={y(t * 100)} stroke="var(--line)" />
            <text x={pl - 8} y={y(t * 100) + 4} textAnchor="end" fontSize="11" fill="var(--text-2)">{t ? formatShort(t, currency) : "0"}</text>
          </g>
        ))}
        {months.map((m, i) => {
          const x = pl + i * cw + cw * 0.28, w = cw * 0.44, last = m.paid === null;
          const top = last ? m.expected : m.invoiced;
          return (
            <g key={m.label} onMouseEnter={() => setHover(i)}>
              <rect x={pl + i * cw} y={0} width={cw} height={H} fill="transparent" />
              {top > 0 && <rect x={x} y={y(top)} width={w} height={y(0) - y(top)} rx="4" fill={last ? "none" : "var(--line-2)"} stroke={last ? "var(--text-2)" : undefined} strokeDasharray={last ? "3 3" : undefined} />}
              {!last && (m.paid ?? 0) > 0 && <rect x={x} y={y(m.paid!)} width={w} height={y(0) - y(m.paid!)} rx="4" fill="var(--st-paid)" opacity=".85" />}
              <text x={x + w / 2} y={H - 4} textAnchor="middle" fontSize="12" fill="var(--text-2)">{m.label}</text>
            </g>
          );
        })}
        {hover !== null && <line x1={pl + hover * cw + cw / 2} x2={pl + hover * cw + cw / 2} y1={4} y2={H - pb} stroke="var(--text-2)" strokeDasharray="3 3" pointerEvents="none" />}
      </svg>
      {hover !== null && (
        <div className="ctip" style={{ opacity: 1, left: `min(calc(${((pl + hover * cw + cw / 2) / W) * 100}% + 12px), calc(100% - 150px))`, top: 4 }}>
          <b className="font-medium">{months[hover].label}</b>
          <br />
          {months[hover].paid === null ? <>Expected <Money value={months[hover].expected / 100} currency={currency} /></> : <>Invoiced <Money value={months[hover].invoiced / 100} currency={currency} /><br />Paid <Money value={(months[hover].paid ?? 0) / 100} currency={currency} /></>}
        </div>
      )}
    </div>
  );
}
