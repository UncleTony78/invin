"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Segmented, TextArea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Avatar, Tabs, type Actor } from "@/components/ui/identity";
import { Dialog, DialogClose, DialogContent, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Sheet, SheetClose, SheetContent, Tooltip } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { Money } from "@/components/invoice/money";
import { InvoicePaper, type Template } from "@/components/invoice/paper";
import { StatusPill } from "@/components/invoice/status";
import { Timeline, type TimelineEvent } from "@/components/invoice/timeline";
import { formatMoney, tintFor, type Currency } from "@/lib/format";
import { formatDate, isoDate, toMinor } from "@/lib/invoice-math";
import { cancelInvoice, confirmClaim, dismissClaim, fetchInvoiceDetail, recordPayment, sendReceiptNow, sendReminder, setInvoiceReminders, togglePin, undoPayment } from "@/server/actions";
import { makeRecurring } from "@/server/series-actions";
import { DEFAULT_SCHEDULE, ScheduleDialog } from "@/components/screens/schedule-fields";
import { describeOffset } from "@/lib/schedule";
import Link from "next/link";
import { flyToSidebar } from "@/lib/fly";
import type { EventDTO, InvoiceDetail } from "@/server/queries";

type SheetApi = { open: (key: string, opts?: { pay?: boolean }) => void; setOrder: (keys: string[]) => void; current: string | null };
const SheetCtx = createContext<SheetApi | null>(null);
export const useInvoiceSheet = () => {
  const c = useContext(SheetCtx);
  if (!c) throw new Error("useInvoiceSheet outside provider");
  return c;
};

const isTyping = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? "") || (document.activeElement as HTMLElement | null)?.isContentEditable;

export function InvoiceSheetProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [stampPress, setStampPress] = useState(false);
  const [tab, setTab] = useState<"invoice" | "activity">("invoice");
  const order = useRef<string[]>([]);
  const cache = useRef(new Map<string, InvoiceDetail>());

  // Only the most recently requested invoice may land; slower, older responses are dropped.
  const wanted = useRef<string | null>(null);
  const load = useCallback((k: string) => {
    wanted.current = k;
    fetchInvoiceDetail(k).then((d) => {
      if (!d) return;
      cache.current.set(d.row.id, d);
      cache.current.set(d.row.number, d);
      if (wanted.current === k) setDetail(d);
    });
  }, []);

  const openSheet = useCallback(
    (k: string, opts?: { pay?: boolean }) => {
      setKey(k);
      setOpen(true);
      setPayOpen(!!opts?.pay);
      setStampPress(false);
      if (opts?.pay) setTab("invoice");
      const hit = cache.current.get(k);
      setDetail(hit ?? null);
      load(k);
    },
    [load],
  );

  // Shareable link: ?inv=INV-0142 opens the sheet on load and follows J/K
  useEffect(() => {
    const inv = new URLSearchParams(location.search).get("inv");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open a shared ?inv= link once on load
    if (inv) openSheet(inv);
  }, [openSheet]);
  useEffect(() => {
    const url = new URL(location.href);
    if (open && detail) url.searchParams.set("inv", detail.row.number);
    else url.searchParams.delete("inv");
    history.replaceState(history.state, "", url);
  }, [open, detail]);

  const step = useCallback(
    (d: number) => {
      if (!detail) return;
      const list = order.current;
      const i = list.findIndex((x) => x === detail.row.id || x === detail.row.number);
      const next = list[Math.max(0, Math.min(list.length - 1, i + d))];
      if (next && i !== -1 && next !== list[i]) {
        setKey(next);
        setPayOpen(false);
        setStampPress(false);
        const hit = cache.current.get(next);
        if (hit) setDetail(hit);
        load(next);
        // warm the neighbour so the next J feels instant
        const after = list[Math.max(0, Math.min(list.length - 1, i + d * 2))];
        if (after && !cache.current.has(after)) fetchInvoiceDetail(after).then((x) => x && cache.current.set(x.row.id, x));
      }
    },
    [detail, load],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        step(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  const api: SheetApi = { open: openSheet, setOrder: (k) => {
      order.current = k;
    }, current: open ? (detail?.row.id ?? key) : null };

  return (
    <SheetCtx.Provider value={api}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          label={detail ? `Invoice ${detail.row.number}` : "Invoice"}
          top={
            <SheetTop
              detail={detail}
              onStep={step}
              onPinned={(pinned) => detail && cache.current.set(detail.row.id, { ...detail, pinned }) && setDetail({ ...detail, pinned })}
              onChanged={() => detail && load(detail.row.id)}
            />
          }
        >
          {detail ? (
            <SheetBody
              key={detail.row.id}
              d={detail}
              tab={tab}
              setTab={setTab}
              payOpen={payOpen}
              setPayOpen={setPayOpen}
              stampPress={stampPress}
              onPaid={() => {
                setStampPress(true);
                load(detail.row.id);
              }}
              onChanged={() => load(detail.row.id)}
            />
          ) : (
            <SheetSkeleton />
          )}
        </SheetContent>
      </Sheet>
    </SheetCtx.Provider>
  );
}

function SheetSkeleton() {
  return (
    <div className="sh-hero" aria-busy="true" aria-label="Loading invoice">
      <div className="sk" style={{ width: 180, height: 16 }} />
      <div className="sk" style={{ width: 220, height: 36, marginTop: 16 }} />
      <div className="sk" style={{ width: "100%", height: 6, marginTop: 20 }} />
      <div className="sk" style={{ width: "100%", height: 420, marginTop: 28 }} />
    </div>
  );
}

function SheetTop({ detail, onStep, onPinned, onChanged }: { detail: InvoiceDetail | null; onStep: (d: number) => void; onPinned: (p: boolean) => void; onChanged: () => void }) {
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const canCancel = detail && ["draft", "scheduled", "sent", "viewed"].includes(detail.row.stored);
  const link = detail ? `${typeof location !== "undefined" ? location.origin : ""}/i/${detail.invoice.publicToken}` : "";
  return (
    <>
      <Tooltip label="Previous" kbd="K">
        <Button variant="ghost" iconOnly icon="up" aria-label="Previous invoice" onClick={() => onStep(-1)} />
      </Tooltip>
      <Tooltip label="Next" kbd="J">
        <Button variant="ghost" iconOnly icon="down" aria-label="Next invoice" onClick={() => onStep(1)} />
      </Tooltip>
      <span className="mr-auto ml-2 flex items-center gap-2.5">
        <span className="iv-mono whitespace-nowrap font-medium">{detail?.row.number ?? ""}</span>
        {detail && <StatusPill status={detail.row.status} />}
      </span>
      {detail && (
        <Button
          variant="ghost"
          icon="pin"
          className="pin-btn"
          data-pinned={detail.pinned || undefined}
          onClick={async (e) => {
            // Pinning sends a tile to the sidebar right away; the server catches up behind it
            if (!detail.pinned) flyToSidebar(e.currentTarget, detail.row.number, tintFor(detail.row.number));
            const r = await togglePin({ kind: "invoice", ref: detail.row.id, label: detail.row.number });
            onPinned(r.pinned);
            toast({ title: r.pinned ? `Pinned ${detail.row.number} to the sidebar` : `Unpinned ${detail.row.number}` });
          }}
        >
          {/* On phones the pin icon alone is enough; the label returns from 560px */}
          <span className="max-[560px]:sr-only">{detail.pinned ? "Pinned" : "Pin to sidebar"}</span>
        </Button>
      )}
      {detail && (
        <Menu>
          <MenuTrigger>
            <Button variant="ghost" iconOnly icon="more" aria-label="More actions" />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onClick={() => window.open(`/i/${detail.invoice.publicToken}?preview=1`, "_blank")}>
              <Icon name="eye" />
              View as customer
            </MenuItem>
            <MenuItem
              onClick={() => {
                navigator.clipboard?.writeText(link);
                toast({ title: "Invoice link copied" });
              }}
            >
              <Icon name="link" />
              Copy invoice link
            </MenuItem>
            {canCancel && (
              <>
                <MenuSeparator />
                <MenuItem danger onClick={() => setCancelOpen(true)}>
                  <Icon name="x" />
                  Cancel invoice…
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>
      )}
      <SheetClose render={<Button variant="ghost" iconOnly icon="x" aria-label="Close" />} />
      {detail && (
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent
            title={`Cancel ${detail.row.number}?`}
            description={`${detail.customer.name} won't be able to pay it, and reminders stop. You can't undo this.`}
            footer={
              <>
                <span className="iv-sp" />
                <DialogClose render={<Button>Keep invoice</Button>} />
                <Button
                  variant="danger"
                  onClick={async () => {
                    await cancelInvoice(detail.row.id, reason);
                    setCancelOpen(false);
                    setReason("");
                    toast({ title: `${detail.row.number} cancelled` });
                    onChanged();
                  }}
                >
                  Cancel invoice
                </Button>
              </>
            }
          >
            <TextArea label="Reason (only your team sees this)" placeholder="e.g. Sent to the wrong contact" value={reason} onChange={(e) => setReason(e.target.value)} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function toActor(a: EventDTO["actor"]): Actor {
  if (a.type === "system") return { kind: "system" };
  if (a.type === "customer") return { kind: "customer", name: a.label };
  if (a.type === "agent") return { kind: "agent", name: a.label, owner: a.label.replace(/'s agent$/, "") };
  const parts = a.label.split(" ");
  return { kind: "person", name: a.label, short: parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : a.label, role: a.role ? a.role[0].toUpperCase() + a.role.slice(1) : "Member", email: a.email ?? "" };
}

const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
};

function SheetBody({
  d,
  tab,
  setTab,
  payOpen,
  setPayOpen,
  stampPress,
  onPaid,
  onChanged,
}: {
  d: InvoiceDetail;
  tab: "invoice" | "activity";
  setTab: (t: "invoice" | "activity") => void;
  payOpen: boolean;
  setPayOpen: (o: boolean) => void;
  stampPress: boolean;
  onPaid: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const r = d.row;
  const cur = r.currency as Currency;
  const m = (minor: number) => formatMoney(minor / 100, cur);
  const open = ["sent", "viewed", "partial"].includes(r.stored);
  const [amount, setAmount] = useState((r.left / 100).toFixed(2));
  const [method, setMethod] = useState<"Bank transfer" | "Cash" | "Card" | "Other">("Bank transfer");
  const [date, setDate] = useState(isoDate(new Date()));
  const [ref, setRef] = useState("");
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");
  const amountMinor = toMinor(parseFloat(amount) || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("saving");
    const res = await recordPayment({ invoiceId: r.id, amount: amountMinor, receivedOn: date, method, reference: ref });
    setState("idle");
    if (!res.ok) return setError(res.error);
    setPayOpen(false);
    if (res.status === "paid") onPaid();
    else onChanged();
    toast({
      title: `${res.status === "paid" ? `${r.number} is paid in full` : `Part payment recorded on ${r.number}`}${res.receipt ? `. A receipt goes to ${d.customer.name} in a minute.` : ""}`,
      undo: async () => {
        await undoPayment(r.id, res.paymentId);
        onChanged();
      },
    });
  }

  const events: TimelineEvent[] = d.events.map((e) => ({
    id: e.id,
    time: when(e.at),
    title: e.title,
    actor: toActor(e.actor),
    note: e.note ?? undefined,
    execution: e.details?.map(([label, value]) => ({ label, value })),
  }));

  const paperInvoice = {
    number: r.number,
    issued: formatDate(d.invoice.issueDate, { year: true }),
    due: formatDate(d.invoice.dueDate, { year: true }),
    currency: cur,
    customer: { ...d.customer, currency: cur },
    items: d.lines.map((l) => ({ description: l.description, quantity: l.quantity, price: l.unitPrice / 100 })),
    vatRate: d.invoice.vatBps / 10000,
    paid: r.stored === "partial" ? r.paid / 100 : 0,
    note: d.invoice.note,
    settled: r.stored === "paid" ? ("paid" as const) : r.stored === "cancelled" ? ("cancelled" as const) : undefined,
  };

  return (
    <>
      <div className="sh-hero">
        <div className="flex items-center gap-2.5 text-text-2">
          <Avatar name={d.customer.name} size="md" />
          <span>
            <b className="font-medium text-text">{d.customer.name}</b>
            <br />
            <span className="text-[13px]">{d.customer.email}</span>
          </span>
        </div>
        <div className="sh-amt">
          <Money value={r.total / 100} currency={cur} />
        </div>
        {!["draft", "scheduled", "cancelled"].includes(r.stored) && (
          <div className="prog" aria-hidden="true">
            <i style={{ transform: `scaleX(${r.total ? Math.min(1, r.paid / r.total) : 0})` }} />
          </div>
        )}
        <div className="sh-line">
          {r.stored === "paid" ? (
            <span><b>Paid in full</b></span>
          ) : r.stored === "cancelled" ? (
            <span>Cancelled</span>
          ) : r.stored === "draft" ? (
            <span>Draft · not sent yet</span>
          ) : r.stored === "scheduled" ? (
            <span>Sends on {formatDate(d.invoice.issueDate)}</span>
          ) : r.paid ? (
            <span><b>{m(r.paid)}</b> paid · <b>{m(r.left)}</b> left</span>
          ) : (
            <span><b>{m(r.left)}</b> to pay</span>
          )}
          {open && <span className={r.status === "overdue" ? "late" : undefined}>{r.status === "overdue" ? r.due : `Due ${formatDate(r.dueDate)} · ${r.due.toLowerCase()}`}</span>}
        </div>
        {d.claims.map((c) => (
          <div key={c.id} className="claim" role="status">
            <div>
              <b>{d.customer.name} says they paid {m(c.amount)}</b>
              <span>
                on {formatDate(c.paidOn, { year: true })}
                {c.reference ? ` · reference ${c.reference}` : ""}
                {c.note ? ` · “${c.note}”` : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                icon="check"
                onClick={async () => {
                  const res = await confirmClaim(c.id);
                  if (!res.ok) return toast({ title: res.error });
                  if (res.status === "paid") onPaid();
                  else onChanged();
                  toast({ title: res.status === "paid" ? `${r.number} is paid in full` : `Payment confirmed on ${r.number}` });
                }}
              >
                Confirm payment
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  await dismissClaim(c.id);
                  onChanged();
                  toast({ title: "Marked as not received yet" });
                }}
              >
                Not received
              </Button>
            </div>
          </div>
        ))}
        <div className="sh-acts">
          {open && (
            <>
              <Button variant="primary" icon="cash" aria-expanded={payOpen} onClick={() => setPayOpen(!payOpen)}>
                Record payment
              </Button>
              <Button
                icon="bell"
                onClick={async () => {
                  const res = await sendReminder(r.id);
                  toast({ title: res.delivery === "sent" ? `Reminder sent to ${res.to}` : res.delivery === "failed" ? "Reminder saved, but the email failed. See Sent emails." : `Reminder saved. Email is in test mode, see Sent emails.` });
                  onChanged();
                }}
              >
                Send reminder
              </Button>
            </>
          )}
          {d.lastPayment && (r.stored === "paid" || r.stored === "partial") && (
            <Button
              icon="mail"
              onClick={async () => {
                const res = await sendReceiptNow(r.id, d.lastPayment!.id);
                if (!res.ok) return toast({ title: res.error });
                toast({ title: res.delivery === "failed" ? "Receipt saved, but the email failed. See Sent emails." : `Receipt sent to ${res.to}` });
                onChanged();
              }}
            >
              {d.lastPayment.receiptSentAt ? "Resend receipt" : "Send receipt"}
            </Button>
          )}
          {r.stored === "draft" && <SheetClose render={<Button variant="primary" icon="pencil" />} onClick={() => router.push(`/invoices/${r.number}/edit`)}>Finish draft</SheetClose>}
          <Tooltip label={copied ? "Copied" : "Copy invoice link"}>
            <Button
              iconOnly
              icon={copied ? "check" : "link"}
              className="copy-btn"
              data-copied={copied || undefined}
              aria-label={copied ? "Link copied" : "Copy invoice link"}
              onClick={() => {
                navigator.clipboard?.writeText(`${location.origin}/i/${d.invoice.publicToken}`);
                // The icon answers in place; no toast needed for something this small
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }}
            />
          </Tooltip>
        </div>
        {r.stored !== "cancelled" && (
          <ul className="sh-auto">
            <li>
              <Icon name="repeat" />
              {d.series ? (
                <>
                  <span>
                    {d.series.label}
                    <small>{d.series.status === "active" && d.series.nextRun ? `Next invoice ${formatDate(d.series.nextRun)}` : d.series.status === "paused" ? "Series paused" : "Series ended"}</small>
                  </span>
                  <SheetClose nativeButton={false} render={<Link className="iv-link" href={`/recurring/${d.series.id}`} />}>View series</SheetClose>
                </>
              ) : (
                <>
                  <span>Doesn&apos;t repeat</span>
                  <ScheduleDialog
                    trigger={<button type="button" className="iv-link">Make recurring</button>}
                    title={`Make ${r.number} recurring`}
                    description={`InVin will make a copy for ${d.customer.name} on each date, with a new number and dates. This invoice stays as the first one.`}
                    initial={DEFAULT_SCHEDULE}
                    start={d.invoice.issueDate ?? isoDate(new Date())}
                    saveLabel="Make recurring"
                    onSave={async (sc) => {
                      const res = await makeRecurring(r.id, sc);
                      if (!res.ok) return res.error;
                      toast({ title: res.nextRun ? `${r.number} now repeats. Next one ${formatDate(res.nextRun, { year: true })}.` : `${r.number} now repeats.` });
                      onChanged();
                      return null;
                    }}
                  />
                </>
              )}
            </li>
            {open && (
              <li>
                <Icon name="bell" />
                {!d.reminders.on ? (
                  <>
                    <span>Automatic reminders are off<small>Turn them on in Settings</small></span>
                    <SheetClose nativeButton={false} render={<Link className="iv-link" href="/settings#reminders" />}>Settings</SheetClose>
                  </>
                ) : d.reminders.customerPaused ? (
                  <span>Reminders are paused for {d.customer.name}</span>
                ) : (
                  <>
                    <span>
                      {d.reminders.paused ? "Automatic reminders paused" : d.reminders.next ? `Next reminder ${formatDate(d.reminders.next.date)}` : "No more automatic reminders"}
                      {!d.reminders.paused && d.reminders.next && <small>{describeOffset(d.reminders.next.offset)}</small>}
                    </span>
                    <button
                      type="button"
                      className="iv-link"
                      onClick={async () => {
                        const res = await setInvoiceReminders(r.id, !d.reminders.paused);
                        toast({ title: res.paused ? `Automatic reminders paused for ${r.number}` : `Automatic reminders back on for ${r.number}` });
                        onChanged();
                      }}
                    >
                      {d.reminders.paused ? "Turn back on" : "Pause"}
                    </button>
                  </>
                )}
              </li>
            )}
          </ul>
        )}
        {open && (
          <div className="payf" data-open={payOpen || undefined}>
            <div>
              <form onSubmit={submit} autoComplete="off">
                <label className="iv-field">
                  <span className="iv-label">Amount received</span>
                  <input className="iv-input iv-num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <span className="iv-hint">{m(r.left)} is left to pay</span>
                </label>
                <label className="iv-field">
                  <span className="iv-label">Date received</span>
                  <input className="iv-input" type="date" value={date} max={isoDate(new Date())} onChange={(e) => setDate(e.target.value)} />
                </label>
                <div className="iv-field full">
                  <span className="iv-label">How they paid</span>
                  <Segmented label="How they paid" value={method} onChange={setMethod} options={(["Bank transfer", "Cash", "Card", "Other"] as const).map((v) => ({ value: v, label: v }))} fill />
                </div>
                <label className="iv-field full">
                  <span className="iv-label">Reference (optional)</span>
                  <input className="iv-input" placeholder="e.g. the bank reference" value={ref} onChange={(e) => setRef(e.target.value)} />
                </label>
                {error && <div className="form-error full"><Icon name="alert" />{error}</div>}
                <div className="full flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancel</Button>
                  <Button variant="primary" type="submit" disabled={amountMinor <= 0 || state === "saving"} style={{ minWidth: 150 }}>
                    <MorphLabel id={state}>{state === "saving" ? "Saving…" : <><Icon name="check" />Record {m(Math.min(amountMinor, r.left))}</>}</MorphLabel>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <div className="sh-tabs">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: "invoice", label: "Invoice" }, { value: "activity", label: "Activity", count: d.events.length }]} />
      </div>
      <div className="sh-tab">
        {tab === "activity" ? (
          <div className="pt-6">
            <Timeline events={events} />
          </div>
        ) : (
          <>
            <div className="pt-6">
              <InvoicePaper
                invoice={paperInvoice}
                business={d.business}
                account={{ id: "a", currency: cur, bank: d.bank?.bank ?? "Add a bank account in Settings", rows: d.bank?.rows ?? [] }}
                template={(d.invoice.template as Template) || "stacked"}
                brand={d.invoice.brandColor}
                fontSize={8.3}
                stamp={r.stored === "paid" ? { kind: "paid", press: stampPress } : r.stored === "cancelled" ? { kind: "cancelled" } : undefined}
              />
            </div>
            <div className="facts">
              <div>
                <h3>Invoice</h3>
                <dl>
                  <div><dt>Category</dt><dd>{d.invoice.category}</dd></div>
                  <div><dt>Currency</dt><dd>{cur}</dd></div>
                  <div><dt>Issued</dt><dd>{formatDate(d.invoice.issueDate, { year: true })}</dd></div>
                  <div><dt>Due</dt><dd>{formatDate(d.invoice.dueDate, { year: true })}</dd></div>
                </dl>
              </div>
              <div>
                <h3>Customer</h3>
                <dl>
                  <div><dt>Name</dt><dd>{d.customer.name}</dd></div>
                  <div><dt>Email</dt><dd className="truncate">{d.customer.email}</dd></div>
                  <div><dt>Address</dt><dd>{d.customer.address || "—"}</dd></div>
                </dl>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
