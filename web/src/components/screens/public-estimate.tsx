"use client";

import { useEffect, useState } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Dialog, DialogClose, DialogContent, TooltipProvider } from "@/components/ui/overlay";
import { Money } from "@/components/invoice/money";
import { InvoicePaper, type Template } from "@/components/invoice/paper";
import type { Currency } from "@/lib/format";
import { formatDate } from "@/lib/invoice-math";
import { decideEstimate, trackEstimateView } from "@/server/public-actions";
import type { PublicEstimate } from "@/server/estimates";

/** The customer's page for an estimate: read it, then accept (by typing their name) or decline. */
export function PublicEstimateView({ est, preview }: { est: PublicEstimate; preview: boolean }) {
  const cur = est.currency as Currency;
  const [state, setState] = useState<"open" | "accepted" | "declined">(est.status === "accepted" || est.status === "converted" ? "accepted" : est.status === "declined" ? "declined" : "open");
  const [acceptedBy, setAcceptedBy] = useState(est.acceptedBy ?? "");
  const expired = est.status === "expired";

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = "light";
    root.style.setProperty("--brand", est.brandColor);
    return () => {
      root.style.removeProperty("--brand");
    };
  }, [est.brandColor]);
  useEffect(() => {
    if (!preview) trackEstimateView(est.token);
  }, [est.token, preview]);

  return (
    <TooltipProvider>
      <div className="pub" style={{ ["--brand" as string]: est.brandColor }}>
        {preview && <div className="pub-preview">Preview: this is what your customer sees. Opening it here doesn&apos;t count as them viewing it.</div>}
        <header className="pub-top">
          <div className="pub-biz"><span className="mk">{est.business.mark}</span><span>{est.business.name}</span></div>
          <a className="iv-btn iv-btn--secondary" href={`/e/${est.token}/pdf`} download><Icon name="download" />Download PDF</a>
        </header>

        <main className="pub-grid">
          <aside className="pub-panel" aria-label="Your answer">
            {state === "accepted" ? (
              <div className="pub-state">
                <span className="pub-tick" aria-hidden="true"><Icon name="check" size={20} /></span>
                <h1>Accepted</h1>
                <p>Thanks{acceptedBy ? `, ${acceptedBy.split(" ")[0]}` : ""}. {est.business.name} has been told and will send an invoice.</p>
              </div>
            ) : state === "declined" ? (
              <div className="pub-state">
                <h1>You declined this estimate</h1>
                <p>{est.business.name} has been told. If you change your mind, ask them for a new one.</p>
              </div>
            ) : (
              <>
                <span className="pub-l">Estimate {est.number}</span>
                <div className="pub-amt"><Money value={est.total / 100} currency={cur} /></div>
                <p className={expired ? "pub-due late" : "pub-due"}>{expired ? `This estimate expired on ${formatDate(est.validUntil, { year: true })}.` : `Valid until ${formatDate(est.validUntil, { year: true })}`}</p>
                {!expired && !preview && (
                  <div className="pub-decide">
                    <AcceptDialog est={est} onDone={(name) => { setAcceptedBy(name); setState("accepted"); }} />
                    <DeclineDialog est={est} onDone={() => setState("declined")} />
                  </div>
                )}
                {preview && !expired && <p className="pub-due" style={{ marginTop: 16 }}>Your customer sees Accept and Decline buttons here.</p>}
                {expired && <p className="pub-due" style={{ marginTop: 12 }}>Ask {est.business.name} for an updated estimate.</p>}
              </>
            )}
            <a className="pub-ask" href={`mailto:${est.business.email}?subject=${encodeURIComponent(`Question about estimate ${est.number}`)}`}>
              <Icon name="mail" />
              Questions? Email {est.business.name}
            </a>
          </aside>

          <section className="pub-paper" aria-label={`Estimate ${est.number}`}>
            <InvoicePaper
              invoice={{
                number: est.number, issued: formatDate(est.issueDate, { year: true }), due: formatDate(est.validUntil, { year: true }), currency: cur, doc: "estimate",
                customer: { ...est.customer, currency: cur }, items: est.lines.map((l) => ({ description: l.description, quantity: l.quantity, price: l.unitPrice / 100 })),
                vatRate: est.vatBps / 10000, note: est.note,
              }}
              business={est.business}
              account={{ id: "", currency: cur, bank: "", rows: [] }}
              template={(est.template as Template) || "stacked"}
              brand={est.brandColor}
              fontSize={11}
            />
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}

function AcceptDialog({ est, onDone }: { est: PublicEstimate; onDone: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(""); }}>
      <Button variant="primary" className="pub-brand pub-wide" icon="check" onClick={() => setOpen(true)}>Accept estimate</Button>
      <DialogContent
        title={`Accept estimate ${est.number}`}
        description={`You're agreeing to the work and price in this estimate from ${est.business.name}. They'll send an invoice next; nothing is charged here.`}
        footer={
          <>
            <span className="iv-sp" />
            <DialogClose render={<Button>Cancel</Button>} />
            <Button
              variant="primary"
              className="pub-brand"
              disabled={busy || name.trim().length < 2}
              style={{ minWidth: 150 }}
              onClick={async () => {
                setBusy(true);
                const r = await decideEstimate(est.token, { accept: true, name });
                setBusy(false);
                if (!r.ok) return setError(r.error);
                setOpen(false);
                onDone(name.trim());
              }}
            >
              <MorphLabel id={busy ? "b" : "i"}>{busy ? "Accepting…" : <><Icon name="check" />I accept</>}</MorphLabel>
            </Button>
          </>
        }
      >
        <TextField label="Your full name" autoFocus autoComplete="name" description="This works as your signature." value={name} onChange={(e) => setName(e.target.value)} />
        {error && <div className="form-error"><Icon name="alert" />{error}</div>}
      </DialogContent>
    </Dialog>
  );
}

function DeclineDialog({ est, onDone }: { est: PublicEstimate; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" className="pub-wide" onClick={() => setOpen(true)}>Decline</Button>
      <DialogContent
        title="Decline this estimate?"
        description={`${est.business.name} will be told. A short reason helps them, but it's optional.`}
        footer={
          <>
            <span className="iv-sp" />
            <DialogClose render={<Button>Go back</Button>} />
            <Button variant="danger" disabled={busy} onClick={async () => { setBusy(true); const r = await decideEstimate(est.token, { accept: false, reason }); setBusy(false); if (r.ok) { setOpen(false); onDone(); } }}>Decline estimate</Button>
          </>
        }
      >
        <TextArea label="Reason (optional)" placeholder="e.g. The budget changed" value={reason} onChange={(e) => setReason(e.target.value)} />
      </DialogContent>
    </Dialog>
  );
}
