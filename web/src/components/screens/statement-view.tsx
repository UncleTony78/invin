"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Dialog, DialogClose, DialogContent, DialogTrigger, Menu, MenuContent, MenuItem, MenuTrigger, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { Money } from "@/components/invoice/money";
import { formatDate, isoDate } from "@/lib/invoice-math";
import { emailStatement } from "@/server/crm-actions";
import type { Statement } from "@/server/statements";

const now = new Date();
const PERIODS = [
  { label: "This year", from: `${now.getFullYear()}-01-01`, to: isoDate(now) },
  { label: "Last 12 months", from: isoDate(new Date(now.getFullYear(), now.getMonth() - 11, 1)), to: isoDate(now) },
  { label: "This quarter", from: isoDate(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), to: isoDate(now) },
  { label: "Last year", from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` },
];

/** The statement exactly as the customer gets it (the same HTML as the PDF), with ways to send it. */
export function StatementView({ st, html }: { st: Statement; html: string }) {
  const router = useRouter();
  const toast = useToast();
  const [from, setFrom] = useState(st.from);
  const [to, setTo] = useState(st.to);
  const [mail, setMail] = useState({ to: st.customer.email, message: "" });
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const period = PERIODS.find((p) => p.from === st.from && p.to === st.to)?.label ?? `${formatDate(st.from, { year: true })} to ${formatDate(st.to, { year: true })}`;
  const go = (f: string, t: string) => router.push(`/customers/${st.customer.id}/statement?from=${f}&to=${t}`);
  const pdf = `/customers/${st.customer.id}/statement/pdf?from=${st.from}&to=${st.to}`;

  return (
    <div className="wrap stm">
      <div className="ph">
        <div>
          <h1>Statement</h1>
          <p className="sub"><Link className="iv-link" href={`/customers/${st.customer.id}`}>{st.customer.name}</Link> · {period}</p>
        </div>
        <div className="acts">
          <Menu>
            <MenuTrigger>
              <Button icon="clock">{PERIODS.some((p) => p.label === period) ? period : "Period"}<Icon name="chevron" /></Button>
            </MenuTrigger>
            <MenuContent align="end">
              {PERIODS.map((p) => (
                <MenuItem key={p.label} onClick={() => go(p.from, p.to)}>
                  {p.label}
                  {p.label === period && <span className="iv-right"><Icon name="check" /></span>}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
          <Popover>
            <PopoverTrigger><Button variant="ghost">Custom dates</Button></PopoverTrigger>
            <PopoverContent align="end" width={280}>
              <form className="rep-dates" onSubmit={(e) => { e.preventDefault(); if (from <= to) go(from, to); }}>
                <label className="iv-field"><span className="iv-label">From</span><input className="iv-input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
                <label className="iv-field"><span className="iv-label">To</span><input className="iv-input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
                <Button type="submit" variant="primary" icon="check">Show these dates</Button>
              </form>
            </PopoverContent>
          </Popover>
          <a className="iv-btn iv-btn--secondary" href={pdf} download><Icon name="download" />PDF</a>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setError(""); }}>
            <DialogTrigger><Button variant="primary" icon="mail">Email to customer</Button></DialogTrigger>
            <DialogContent
              title={`Email this statement to ${st.customer.name}`}
              description="The PDF is attached. Replies come to your business email."
              footer={
                <>
                  <span className="iv-sp" />
                  <DialogClose render={<Button>Cancel</Button>} />
                  <Button
                    variant="primary"
                    disabled={state === "sending"}
                    style={{ minWidth: 140 }}
                    onClick={async () => {
                      setError("");
                      setState("sending");
                      const res = await emailStatement(st.customer.id, st.from, st.to, mail);
                      setState("idle");
                      if (!res.ok) return setError(res.error);
                      setOpen(false);
                      toast({ title: res.delivery === "sent" ? `Statement sent to ${mail.to}` : res.delivery === "failed" ? "Saved, but the email failed. See Sent emails." : "Statement saved. Email is in test mode, see Sent emails." });
                    }}
                  >
                    <MorphLabel id={state}>{state === "sending" ? "Sending…" : <><Icon name="send" />Send statement</>}</MorphLabel>
                  </Button>
                </>
              }
            >
              <TextField label="To" type="email" value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} />
              <TextArea label="Message (optional)" placeholder={`Hi ${st.customer.name.split(" ")[0]}, here's your statement…`} value={mail.message} onChange={(e) => setMail({ ...mail, message: e.target.value })} />
              {error && <div className="form-error"><Icon name="alert" />{error}</div>}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <dl className="cfacts">
        <div><dt>Balance on {formatDate(st.from)}</dt><dd><Money value={st.opening / 100} currency={st.currency} /></dd><small>Brought forward</small></div>
        <div><dt>Invoiced</dt><dd><Money value={st.invoiced / 100} currency={st.currency} /></dd><small>{(() => { const n = st.lines.filter((l) => l.kind === "invoice").length; return `${n} invoice${n === 1 ? "" : "s"} in the period`; })()}</small></div>
        <div><dt>Paid</dt><dd><Money value={st.paid / 100} currency={st.currency} /></dd><small>{(() => { const n = st.lines.filter((l) => l.kind === "payment").length; return `${n} payment${n === 1 ? "" : "s"}`; })()}</small></div>
        <div><dt>Balance on {formatDate(st.to)}</dt><dd><Money value={st.closing / 100} currency={st.currency} /></dd><small>{st.open.length ? `${st.open.length} invoice${st.open.length === 1 ? "" : "s"} still to pay` : "Nothing left to pay"}</small></div>
      </dl>

      <div className="stm-paper">
        <iframe title={`Statement for ${st.customer.name}`} srcDoc={html} />
      </div>
      <p className="mt-3 text-center text-[12px] text-text-2">This is exactly what {st.customer.name} gets as a PDF. Amounts in {st.currency}; invoices in other currencies aren&apos;t included.</p>
    </div>
  );
}
