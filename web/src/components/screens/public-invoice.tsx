"use client";

import { useEffect, useState } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Dialog, DialogClose, DialogContent, TooltipProvider } from "@/components/ui/overlay";
import { Money } from "@/components/invoice/money";
import { InvoicePaper, type Template } from "@/components/invoice/paper";
import { formatMoney, type Currency } from "@/lib/format";
import { formatDate, isoDate, toMinor } from "@/lib/invoice-math";
import { submitClaim, trackView } from "@/server/public-actions";
import { toPaper } from "@/lib/public-paper";
import type { PublicInvoice } from "@/server/public";

export function PublicInvoiceView({ inv, preview }: { inv: PublicInvoice; preview: boolean }) {
  const cur = inv.currency as Currency;
  const m = (minor: number) => formatMoney(minor / 100, cur);
  const open = ["sent", "viewed", "partial"].includes(inv.stored);
  const [claimed, setClaimed] = useState(inv.pendingClaim);

  // The customer's page is always light: it's their document, not our app
  // Dialogs render outside this page, so the brand colour lives on <html> where they can see it
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = "light";
    root.style.setProperty("--brand", inv.brandColor);
    return () => {
      root.style.removeProperty("--brand");
    };
  }, [inv.brandColor]);
  useEffect(() => {
    if (!preview) trackView(inv.token);
  }, [inv.token, preview]);

  const refRow: [string, string] = ["Payment reference", inv.number];

  return (
    <TooltipProvider>
      <div className="pub" style={{ ["--brand" as string]: inv.brandColor }}>
        {preview && <div className="pub-preview">Preview: this is what your customer sees. Opening it here doesn&apos;t count as them viewing it.</div>}
        <header className="pub-top">
          <div className="pub-biz">
            <span className="mk">{inv.business.mark}</span>
            <span>{inv.business.name}</span>
          </div>
          <a className="iv-btn iv-btn--secondary" href={`/i/${inv.token}/pdf`} download>
            <Icon name="download" />
            Download PDF
          </a>
        </header>

        <main className="pub-grid">
          <aside className="pub-panel" aria-label="Payment">
            {inv.stored === "paid" ? (
              <div className="pub-state">
                <span className="pub-tick" aria-hidden="true"><Icon name="check" size={20} /></span>
                <h1>Paid in full</h1>
                <p>Thank you. {inv.business.name} has received {m(inv.total)} for invoice {inv.number}.</p>
              </div>
            ) : inv.stored === "cancelled" ? (
              <div className="pub-state">
                <h1>This invoice was cancelled</h1>
                <p>You don&apos;t need to pay it. If you have questions, contact {inv.business.name}.</p>
              </div>
            ) : (
              <>
                <span className="pub-l">Amount due</span>
                <div className="pub-amt"><Money value={inv.left / 100} currency={cur} /></div>
                <p className={inv.status === "overdue" ? "pub-due late" : "pub-due"}>
                  {inv.status === "overdue" ? `Was due ${formatDate(inv.dueDate, { year: true })} · ${inv.daysLate} day${inv.daysLate === 1 ? "" : "s"} late` : `Due ${formatDate(inv.dueDate, { year: true })}`}
                </p>
                {inv.paid > 0 && (
                  <>
                    <div className="prog" aria-hidden="true"><i style={{ transform: `scaleX(${inv.paid / inv.total})`, background: "var(--brand)" }} /></div>
                    <p className="pub-due">{m(inv.paid)} of {m(inv.total)} already paid</p>
                  </>
                )}
              </>
            )}

            {open && (
              <>
                <section className="pub-bank" aria-labelledby="howpay">
                  <h2 id="howpay">Pay by bank transfer</h2>
                  {inv.bank ? (
                    <dl>
                      <CopyRow k="Bank" v={inv.bank.bank} />
                      {inv.bank.rows.map(([k, v]) => (
                        <CopyRow key={k} k={k} v={v} mono={/\d/.test(v)} />
                      ))}
                      <CopyRow k={refRow[0]} v={refRow[1]} mono strong />
                    </dl>
                  ) : (
                    <p className="pub-due">{inv.business.name} hasn&apos;t added bank details. Contact them to pay.</p>
                  )}
                </section>

                {claimed ? (
                  <div className="pub-claimed" role="status">
                    <Icon name="clock" />
                    <span>
                      You told {inv.business.name} you paid <b>{m(claimed.amount)}</b> on {formatDate(claimed.paidOn, { year: true })}. They&apos;ll confirm once it arrives.
                    </span>
                  </div>
                ) : (
                  <ClaimDialog inv={inv} onDone={setClaimed} />
                )}
              </>
            )}

            <a className="pub-ask" href={`mailto:${inv.business.email}?subject=${encodeURIComponent(`Question about invoice ${inv.number}`)}`}>
              <Icon name="mail" />
              Questions? Email {inv.business.name}
            </a>
          </aside>

          <section className="pub-paper" aria-label={`Invoice ${inv.number}`}>
            <InvoicePaper
              invoice={toPaper(inv)}
              business={inv.business}
              account={{ id: "a", currency: cur, bank: inv.bank?.bank ?? "", rows: inv.bank?.rows ?? [] }}
              template={(inv.template as Template) || "stacked"}
              brand={inv.brandColor}
              fontSize={10.5}
              stamp={inv.stored === "paid" ? { kind: "paid" } : inv.stored === "cancelled" ? { kind: "cancelled" } : undefined}
            />
          </section>
        </main>

        <footer className="pub-foot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lockup.svg" alt="" height={14} style={{ height: 14 }} />
          <span>Sent with InVin</span>
        </footer>
      </div>
    </TooltipProvider>
  );
}

/** Each detail copies with one tap; the icon turns into a tick for 1.5s. */
function CopyRow({ k, v, mono, strong }: { k: string; v: string; mono?: boolean; strong?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="pub-row" data-strong={strong || undefined}>
      <dt>{k}</dt>
      <dd className={mono ? "iv-mono" : undefined}>{v}</dd>
      <button
        type="button"
        className="pub-copy"
        aria-label={`Copy ${k}`}
        onClick={async () => {
          await navigator.clipboard?.writeText(v.replace(/\s+/g, k === "IBAN" ? "" : " "));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <MorphLabel id={copied ? "y" : "n"}>{copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}</MorphLabel>
        <span className="sr-only" aria-live="polite">{copied ? `${k} copied` : ""}</span>
      </button>
    </div>
  );
}

function ClaimDialog({ inv, onDone }: { inv: PublicInvoice; onDone: (c: PublicInvoice["pendingClaim"]) => void }) {
  const cur = inv.currency as Currency;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((inv.left / 100).toFixed(2));
  const [paidOn, setPaidOn] = useState(isoDate(new Date()));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setState("sending");
    const res = await submitClaim(inv.token, { amount: toMinor(parseFloat(amount) || 0), paidOn, reference, note });
    if (!res.ok) {
      setState("idle");
      return setError(res.error);
    }
    setState("done");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && state === "done") onDone({ amount: toMinor(parseFloat(amount) || 0), paidOn, reference });
      }}
    >
      <button type="button" className="iv-btn pub-cta" onClick={() => setOpen(true)}>
        <Icon name="check" />
        I&apos;ve paid
      </button>
      {state === "done" ? (
        <DialogContent
          title="Thanks, we've let them know"
          description={`${inv.business.name} will check their bank and confirm your payment of ${formatMoney(parseFloat(amount) || 0, cur)}. This page will show it as paid once they do.`}
          footer={
            <>
              <span className="iv-sp" />
              <DialogClose render={<Button variant="primary">Done</Button>} />
            </>
          }
        >
          <div className="pub-done" aria-hidden="true">
            <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg>
          </div>
        </DialogContent>
      ) : (
        <DialogContent
          title="Tell them you've paid"
          description={`This lets ${inv.business.name} know to look for your payment. Nothing is charged here.`}
          footer={
            <>
              <span className="iv-sp" />
              <DialogClose render={<Button disabled={state === "sending"}>Cancel</Button>} />
              <button type="button" className="iv-btn iv-btn--primary pub-brand" style={{ minWidth: 140 }} disabled={state === "sending"} onClick={submit}>
                <MorphLabel id={state}>{state === "sending" ? "Sending…" : <><Icon name="send" />Let them know</>}</MorphLabel>
              </button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3.5">
            <TextField label={`Amount paid (${cur})`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <TextField label="Date you paid" type="date" max={isoDate(new Date())} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>
          <TextField label="Payment reference (optional)" placeholder="e.g. the reference from your bank" value={reference} onChange={(e) => setReference(e.target.value)} />
          <TextArea label="Note (optional)" placeholder="Anything they should know" value={note} onChange={(e) => setNote(e.target.value)} style={{ height: 70 }} />
          {error && <div className="form-error"><Icon name="alert" />{error}</div>}
        </DialogContent>
      )}
    </Dialog>
  );
}
