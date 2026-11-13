"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/identity";
import { Dialog, DialogClose, DialogContent, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { Money } from "@/components/invoice/money";
import { StatusPill } from "@/components/invoice/status";
import { useInvoiceSheet } from "@/components/shell/invoice-sheet";
import { formatMoney, type Currency } from "@/lib/format";
import { formatDate } from "@/lib/invoice-math";
import { describeEnding } from "@/lib/schedule";
import type { SeriesDetail } from "@/server/queries";
import { endSeries, pauseSeries, resumeSeries, runNow, skipNext, undoSkip, updateSchedule } from "@/server/series-actions";
import { SeriesPill } from "./recurring-view";
import { ScheduleDialog } from "./schedule-fields";

/** One recurring series: what it bills, when it runs next, and every invoice it has made. */
export function SeriesView({ s }: { s: SeriesDetail }) {
  const router = useRouter();
  const toast = useToast();
  const sheet = useInvoiceSheet();
  const [busy, setBusy] = useState<"" | "run" | "pause" | "skip">("");
  const [endOpen, setEndOpen] = useState(false);
  const cur = s.currency as Currency;
  const made = s.occurrences.filter((o) => o.kind === "made");
  const firstUpcoming = s.occurrences.filter((o) => o.kind === "upcoming").at(-1);
  useEffect(() => {
    sheet.setOrder(made.map((o) => o.invoiceId!));
  });

  async function act<T>(kind: typeof busy, fn: () => Promise<T>) {
    setBusy(kind);
    try {
      return await fn();
    } finally {
      setBusy("");
      router.refresh();
    }
  }

  return (
    <div className="wrap">
      <div className="ph">
        <div className="flex items-center gap-4">
          <Avatar name={s.customer} size="lg" />
          <div>
            <h1>{s.customer}</h1>
            <p className="sub">{s.schedule} · {describeEnding(s)}</p>
          </div>
        </div>
        <div className="acts">
          {s.status !== "ended" && (
            <ScheduleDialog
              trigger={<Button icon="clock">Change schedule</Button>}
              title="Change schedule"
              description="Invoices already made stay as they are. The change applies from the next one."
              initial={{ frequency: s.frequency, endAfter: s.endAfter, endOn: s.endOn, mode: s.mode as "send" | "draft" }}
              start={s.nextRun ?? new Date().toISOString().slice(0, 10)}
              startIsNext
              saveLabel="Save schedule"
              onSave={async (sc) => {
                const r = await updateSchedule(s.id, sc);
                if (!r.ok) return r.error;
                toast({ title: "Schedule saved" });
                router.refresh();
                return null;
              }}
            />
          )}
          {s.status === "active" && (
            <Button
              icon="clock"
              disabled={!!busy}
              onClick={() =>
                act("pause", async () => {
                  await pauseSeries(s.id);
                  toast({ title: "Paused. Nothing will be made until you resume.", undo: async () => { await resumeSeries(s.id); router.refresh(); } });
                })
              }
            >
              Pause
            </Button>
          )}
          {s.status === "paused" && (
            <Button
              variant="primary"
              icon="repeat"
              disabled={!!busy}
              onClick={() =>
                act("pause", async () => {
                  const r = await resumeSeries(s.id);
                  if (r.ok) toast({ title: r.missed ? `Resumed. ${r.missed} date${r.missed === 1 ? " was" : "s were"} missed while paused and won't be billed.` : "Resumed" });
                })
              }
            >
              Resume
            </Button>
          )}
          {s.status !== "ended" && (
            <Menu>
              <MenuTrigger>
                <Button iconOnly icon="more" aria-label="More actions for this series" />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem
                  onClick={() =>
                    act("run", async () => {
                      const r = await runNow(s.id);
                      if (!r.ok) return toast({ title: r.error });
                      toast({ title: r.mode === "send" ? `${r.number} made and sent to ${s.customer}` : `${r.number} is ready as a draft` });
                      sheet.open(r.id);
                    })
                  }
                >
                  <Icon name="plus" />
                  {s.mode === "send" ? "Make and send the next one now" : "Make the next draft now"}
                </MenuItem>
                <MenuItem render={<Link href={`/recurring/${s.id}/edit`} />}>
                  <Icon name="pencil" />
                  Edit what&apos;s on the invoice
                </MenuItem>
                <MenuSeparator />
                <MenuItem onClick={() => setEndOpen(true)}>
                  <Icon name="x" />
                  End this series
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
        </div>
      </div>

      {s.lastError && (
        <div className="form-error" style={{ marginBottom: 16 }}>
          <Icon name="alert" />
          The last run didn&apos;t finish: {s.lastError}
        </div>
      )}

      <dl className="cfacts">
        <div>
          <dt>Each invoice</dt>
          <dd><Money value={s.total / 100} currency={cur} /></dd>
          <small>{s.invoice.lines.length} item{s.invoice.lines.length === 1 ? "" : "s"}, due {s.invoice.termsDays ? `${s.invoice.termsDays} days after` : "on receipt"}</small>
        </div>
        <div>
          <dt>Next invoice</dt>
          <dd>{s.status === "active" && s.nextRun ? formatDate(s.nextRun, {}) : s.status === "paused" ? "Paused" : "None"}</dd>
          <small>{s.status === "ended" ? "This series has ended" : s.mode === "send" ? "Sent to the customer for you" : "Made as a draft for you to check"}</small>
        </div>
        <div>
          <dt>Made so far</dt>
          <dd>{s.endAfter != null ? `${s.invoicesMade} of ${s.endAfter}` : s.invoicesMade}</dd>
          <small>{made.filter((o) => o.status === "paid").length} paid</small>
        </div>
        <div>
          <dt>Status</dt>
          <dd><SeriesPill status={s.status} /></dd>
          <small>{s.customerEmail}</small>
        </div>
      </dl>

      <div className="sr-grid">
        <section>
          <h2 className="sec-h">Invoices in this series <span className="ct">{made.length}</span></h2>
          <table className="tbl" data-m="occ" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th aria-hidden="true" />
                <th>Date</th>
                <th>Invoice</th>
                <th>Status</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {s.occurrences.map((o) =>
                o.kind === "made" ? (
                  <tr key={o.invoiceId} data-row data-selected={sheet.current === o.invoiceId || undefined} onClick={() => sheet.open(o.invoiceId!)}>
                    <td aria-hidden="true" />
                    <td>{formatDate(o.date, { year: true })}</td>
                    <td className="iv-mono">{o.number}</td>
                    <td><StatusPill status={o.status!} /></td>
                    <td className="r font-medium">
                      <Money value={o.total! / 100} currency={cur} />
                      {o.left! > 0 && o.left! < o.total! && <small className="block text-[12px] font-normal text-text-2">{formatMoney(o.left! / 100, cur)} left</small>}
                    </td>
                  </tr>
                ) : (
                  <tr key={`${o.kind}-${o.date}`} className="sr-future" data-kind={o.kind}>
                    <td aria-hidden="true" />
                    <td>{formatDate(o.date, { year: true })}</td>
                    <td className="text-text-2">{o.kind === "skipped" ? "Skipped" : s.status === "paused" ? "On hold" : s.mode === "send" ? "Will be sent" : "Will be drafted"}</td>
                    <td>
                      {o.kind === "upcoming" && o === firstUpcoming && s.status === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!!busy}
                          onClick={() =>
                            act("skip", async () => {
                              const r = await skipNext(s.id);
                              if (r.ok) toast({ title: `Skipped ${formatDate(r.skippedDate, {})}`, undo: async () => { await undoSkip(s.id, r.skippedDate); router.refresh(); } });
                            })
                          }
                        >
                          <MorphLabel id={busy === "skip" ? "b" : "i"}>{busy === "skip" ? "Skipping…" : "Skip this one"}</MorphLabel>
                        </Button>
                      )}
                    </td>
                    <td className="r text-text-2">{o.kind === "upcoming" ? <Money value={s.total / 100} currency={cur} /> : "—"}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </section>

        <aside className="sr-card">
          <header>
            <h2 className="sec-h">On each invoice</h2>
            {s.status !== "ended" && <Link className="iv-link text-[13px]" href={`/recurring/${s.id}/edit`}>Edit</Link>}
          </header>
          <ul>
            {s.invoice.lines.map((l, i) => (
              <li key={i}>
                <span>{l.description}{l.quantity !== 1 && <small> × {l.quantity}</small>}</span>
                <Money value={(l.unitPrice * l.quantity) / 100} currency={cur} />
              </li>
            ))}
          </ul>
          <div className="sr-total">
            <span>Total{s.invoice.vatBps ? ` with VAT ${s.invoice.vatBps / 100}%` : ""}</span>
            <b><Money value={s.total / 100} currency={cur} /></b>
          </div>
          <p>Category: {s.invoice.category}. Changes here apply to future invoices only.</p>
        </aside>
      </div>

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent
          title="End this series?"
          description={`No more invoices will be made for ${s.customer}. Invoices already sent stay as they are, and you can still collect on them.`}
          footer={
            <>
              <span className="iv-sp" />
              <DialogClose render={<Button>Keep it</Button>} />
              <Button
                variant="danger"
                onClick={async () => {
                  await endSeries(s.id);
                  setEndOpen(false);
                  toast({ title: "Series ended" });
                  router.refresh();
                }}
              >
                End series
              </Button>
            </>
          }
        />
      </Dialog>
    </div>
  );
}
