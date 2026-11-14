"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Segmented, TextArea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/identity";
import { Dialog, DialogClose, DialogContent, Menu, MenuContent, MenuItem, MenuTrigger, Tooltip } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { Money } from "@/components/invoice/money";
import { EstimatePill } from "@/components/invoice/estimate-pill";
import { InvoicePaper, type Template } from "@/components/invoice/paper";
import { formatMoney, type Currency } from "@/lib/format";
import { formatDate } from "@/lib/invoice-math";
import { convertEstimate, deleteEstimate, markEstimate } from "@/server/estimate-actions";
import type { EstimateDetail } from "@/server/estimates";

const ago = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** One estimate: where it stands, the one next step that matters, and the document itself. */
export function EstimateView({ e, business }: { e: EstimateDetail; business: { name: string; mark: string; address: string; email: string } }) {
  const router = useRouter();
  const toast = useToast();
  const cur = e.currency as Currency;
  const m = (minor: number) => formatMoney(minor / 100, cur);
  const [convert, setConvert] = useState(false);
  const [how, setHow] = useState<"full" | "deposit">("full");
  const [pct, setPct] = useState<"25" | "30" | "50">("50");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "" : `${location.origin}/e/${e.publicToken}`;
  const st = e.displayStatus;
  const deposit = e.invoices.find((i) => i.kind === "deposit");
  const final = e.invoices.find((i) => i.kind === "final");
  const waiting = st === "sent" || st === "viewed" || st === "expired";

  async function doConvert(kind: "full" | "deposit" | "rest") {
    setBusy(true);
    const r = await convertEstimate(e.id, kind === "deposit" ? { kind, pct: Number(pct) } : { kind });
    setBusy(false);
    if (!r.ok) return toast({ title: r.error });
    setConvert(false);
    toast({ title: `${r.number} is ready as a draft. Check it, then send.` });
    router.push(`/invoices/${r.number}/edit`);
  }

  return (
    <div className="est">
      <div className="est-main">
        <div className="est-head">
          <div className="flex items-center gap-2.5">
            <span className="iv-mono font-medium">{e.number}</span>
            <EstimatePill status={st} />
          </div>
          <div className="est-who">
            <Avatar name={e.customer.name} size="md" />
            <span><b>{e.customer.name}</b><small>{e.customer.email}</small></span>
          </div>
          <div className="est-amt"><Money value={e.total / 100} currency={cur} /></div>
          <p className="est-line">
            {st === "draft" && "Not sent yet."}
            {waiting && <>Valid until <b>{formatDate(e.validUntil, { year: true })}</b>{st === "expired" ? ". It has expired; send a new one if the price still stands." : st === "viewed" ? ". They've opened it." : "."}</>}
            {st === "accepted" && <>Accepted by <b>{e.acceptedBy}</b>{e.acceptedAt ? ` on ${formatDate(new Date(e.acceptedAt).toISOString().slice(0, 10), { year: true })}` : ""}. {deposit ? "The deposit is billed; bill the rest when you're ready." : "Turn it into an invoice when you're ready."}</>}
            {st === "declined" && <>Declined{e.declineReason ? <>: “{e.declineReason}”</> : "."}</>}
            {st === "converted" && <>Accepted by <b>{e.acceptedBy}</b> and invoiced.</>}
          </p>
        </div>

        <div className="sh-acts">
          {st === "draft" && (
            <>
              <Link className="iv-btn iv-btn--primary" href={`/estimates/${e.number}/edit`}><Icon name="pencil" />Finish and send</Link>
              <Button
                icon="trash"
                variant="ghost"
                onClick={async () => {
                  const r = await deleteEstimate(e.id);
                  if (!r.ok) return toast({ title: r.error });
                  toast({ title: `${e.number} deleted` });
                  router.push("/estimates");
                }}
              >
                Delete draft
              </Button>
            </>
          )}
          {st === "accepted" && !deposit && <Button variant="primary" icon="file" onClick={() => setConvert(true)}>Turn into an invoice</Button>}
          {st === "accepted" && deposit && <Button variant="primary" icon="file" disabled={busy} onClick={() => doConvert("rest")}>Bill the rest</Button>}
          {e.invoices.map((i) => (
            <Link key={i.id} className="iv-btn iv-btn--secondary" href={i.status === "draft" ? `/invoices/${i.number}/edit` : `/invoices?inv=${i.number}`}>
              <Icon name="file" />{i.kind === "deposit" ? "Deposit" : final && deposit ? "Final" : "Invoice"} {i.number}
            </Link>
          ))}
          {st === "declined" && <Link className="iv-btn iv-btn--secondary" href={`/estimates/new?customer=${e.customerId}`}><Icon name="plus" />New estimate for them</Link>}
          {st !== "draft" && (
            <Tooltip label={copied ? "Copied" : "Copy the customer's link"}>
              <Button iconOnly icon={copied ? "check" : "link"} className="copy-btn" data-copied={copied || undefined} aria-label="Copy the customer's link" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1400); }} />
            </Tooltip>
          )}
          {st !== "draft" && (
            <Menu>
              <MenuTrigger><Button iconOnly variant="ghost" icon="more" aria-label="More actions" /></MenuTrigger>
              <MenuContent align="end">
                <MenuItem onClick={() => window.open(`/e/${e.publicToken}?preview=1`, "_blank")}><Icon name="eye" />View as customer</MenuItem>
                <MenuItem render={<a href={`/e/${e.publicToken}/pdf`} download />}><Icon name="download" />Download PDF</MenuItem>
                {waiting && (
                  <>
                    <MenuItem onClick={async () => { await markEstimate(e.id, "accepted"); toast({ title: `${e.number} marked as accepted` }); router.refresh(); }}><Icon name="check" />They accepted (by phone or email)</MenuItem>
                    <MenuItem onClick={() => setDeclining(true)}><Icon name="x" />They declined</MenuItem>
                  </>
                )}
              </MenuContent>
            </Menu>
          )}
        </div>

        <section className="est-log">
          <h3>Activity</h3>
          <ol>
            {e.events.map((v) => (
              <li key={v.id} data-actor={v.actor.type}>
                <b>{v.title}</b>
                <small>{v.actor.label} · {ago(v.at)}</small>
                {v.note && <p>{v.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="est-prev">
        <InvoicePaper
          invoice={{
            number: e.number, issued: formatDate(e.issueDate, { year: true }), due: formatDate(e.validUntil, { year: true }), currency: cur, doc: "estimate",
            customer: { ...e.customer, currency: cur }, items: e.lines.map((l) => ({ description: l.description, quantity: l.quantity, price: l.unitPrice / 100 })),
            vatRate: e.vatBps / 10000, note: e.note,
          }}
          business={business}
          account={{ id: "", currency: cur, bank: "", rows: [] }}
          template={(e.template as Template) || "stacked"}
          brand={e.brandColor}
          fontSize={9.4}
        />
      </div>

      <Dialog open={convert} onOpenChange={setConvert}>
        <DialogContent
          title={`Turn ${e.number} into an invoice`}
          description="InVin makes a draft for you to check before it goes to the customer."
          footer={
            <>
              <span className="iv-sp" />
              <DialogClose render={<Button>Cancel</Button>} />
              <Button variant="primary" disabled={busy} style={{ minWidth: 160 }} onClick={() => doConvert(how)}>
                <MorphLabel id={busy ? "b" : "i"}>{busy ? "Making it…" : how === "full" ? `Invoice ${m(e.total)}` : `Invoice the ${pct}% deposit`}</MorphLabel>
              </Button>
            </>
          }
        >
          <div className="accts" role="radiogroup" aria-label="How to bill it">
            <button type="button" role="radio" aria-checked={how === "full"} className="acct" onClick={() => setHow("full")}>
              <span className="rad" />
              <span><b>Bill it all now</b><small>One invoice for {m(e.total)}, with the same items.</small></span>
            </button>
            <button type="button" role="radio" aria-checked={how === "deposit"} className="acct" onClick={() => setHow("deposit")}>
              <span className="rad" />
              <span><b>Bill a deposit first</b><small>An invoice for part of it now, and the rest when the work is done.</small></span>
            </button>
          </div>
          {how === "deposit" && (
            <div className="iv-field">
              <span className="iv-label">Deposit</span>
              <Segmented fill label="Deposit size" value={pct} onChange={setPct} options={[{ value: "25", label: "25%" }, { value: "30", label: "30%" }, { value: "50", label: "50%" }]} />
              <span className="iv-hint">{m(Math.round((e.subtotal * Number(pct)) / 100))} before VAT now, {m(e.subtotal - Math.round((e.subtotal * Number(pct)) / 100))} later.</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={declining} onOpenChange={setDeclining}>
        <DialogContent
          title={`Mark ${e.number} as declined`}
          description="For when they told you outside InVin. The estimate stays on record."
          footer={
            <>
              <span className="iv-sp" />
              <DialogClose render={<Button>Cancel</Button>} />
              <Button variant="danger" onClick={async () => { await markEstimate(e.id, "declined", reason); setDeclining(false); toast({ title: `${e.number} marked as declined` }); router.refresh(); }}>Mark as declined</Button>
            </>
          }
        >
          <TextArea label="Why (optional)" placeholder="e.g. Went with a smaller scope" value={reason} onChange={(ev) => setReason(ev.target.value)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
