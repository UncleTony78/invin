"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button, Kbd, MorphLabel } from "@/components/ui/button";
import { Segmented, Switch, TextArea, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/identity";
import { Dialog, DialogClose, DialogContent, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { Money } from "@/components/invoice/money";
import { ColourSwatches, InvoicePaper, TemplatePicker, type Template } from "@/components/invoice/paper";
import { useInvoiceSheet } from "@/components/shell/invoice-sheet";
import { formatMoney, tintFor, type Currency } from "@/lib/format";
import { amountProblem, computeTotals, formatDate, isoDate, toMinor } from "@/lib/invoice-math";
import { BRAND_COLOURS } from "@/lib/sample";
import { createInvoice, updateDraft } from "@/server/actions";
import { createRecurringInvoice, updateSeriesInvoice, type Schedule } from "@/server/series-actions";
import { DEFAULT_SCHEDULE, ScheduleFields } from "@/components/screens/schedule-fields";
import { CustomerDialog } from "@/components/screens/customer-form";

type Customer = { id: string; name: string; email: string; address: string; currency: string; termsDays: number };
type Account = { id: string; currency: string; bank: string; rows: [string, string][] };
type CatalogItem = { id: string; name: string; unitPrice: number; currency: string; unit: string };
type Line = { key: number; description: string; quantity: string; price: string; entering?: boolean };

const TERMS = [
  { value: "0", label: "On receipt" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
] as const;
type Terms = (typeof TERMS)[number]["value"];

export type DraftInput = {
  fields?: Record<string, string>;
  id: string; customerId: string; issueDate: string; termsDays: number; category: string; vatBps: number; note: string;
  template: string; brandColor: string; bankAccountId: string | null; lines: { description: string; quantity: number; unitPrice: number }[];
};

export function EditorView({
  nextNumber, business, defaults, sender, customers: initialCustomers, accounts, catalog, draft, preselect, series, repeat: startRepeating,
}: {
  nextNumber: string;
  /** Editing what a recurring series puts on its future invoices (no sending from here) */
  series?: { id: string; nextRun: string | null };
  /** Open with "Repeat" already on (from the Recurring page) */
  repeat?: boolean;
  /** Editing an existing draft: everything starts from it, and saving updates it in place. */
  draft?: DraftInput;
  /** Customer id from ?customer= (e.g. "New invoice" on a customer's page). */
  preselect?: string;
  business: { name: string; mark: string; address: string; email: string };
  defaults: { template: string; brandColor: string; category?: string; remindersNote?: string; categories?: string[]; customFields?: { id: string; label: string; print: boolean }[] };
  sender: string;
  customers: Customer[];
  accounts: Account[];
  catalog: CatalogItem[];
}) {
  const router = useRouter();
  const sheet = useInvoiceSheet();
  const toast = useToast();
  const [customers, setCustomers] = useState(initialCustomers);
  const first = initialCustomers.find((c) => c.id === (draft?.customerId ?? preselect)) ?? initialCustomers[0];
  const termsOf = (days: number) => ((["0", "7", "14", "30"].includes(String(days)) ? String(days) : "14") as Terms);
  const [customer, setCustomer] = useState<Customer>(first);
  const [issue, setIssue] = useState(draft?.issueDate ?? isoDate(new Date()));
  const [terms, setTerms] = useState<Terms>(termsOf(draft?.termsDays ?? first?.termsDays ?? 14));
  const [category, setCategory] = useState(draft?.category ?? (defaults.category || "Retainer"));
  const [lines, setLines] = useState<Line[]>(
    draft?.lines.length
      ? draft.lines.map((l, i) => ({ key: i + 1, description: l.description, quantity: String(l.quantity), price: (l.unitPrice / 100).toFixed(2) }))
      : [{ key: 1, description: "", quantity: "1", price: "" }],
  );
  const [vat, setVat] = useState(draft ? draft.vatBps > 0 : false);
  const [accountId, setAccountId] = useState(draft?.bankAccountId ?? accounts.find((a) => a.currency === first?.currency)?.id ?? accounts[0]?.id ?? "");
  const [note, setNote] = useState(draft?.note ?? "Thank you. Please use the invoice number as your payment reference.");
  const [template, setTemplate] = useState<Template>(((draft?.template ?? defaults.template) as Template) || "stacked");
  const [brand, setBrand] = useState(draft?.brandColor ?? defaults.brandColor);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"idle" | "draft">("idle");
  const customFields = defaults.customFields ?? [];
  const [fieldVals, setFieldVals] = useState<Record<string, string>>(draft?.fields ?? {});
  const canRepeat = !draft && !series;
  const [repeat, setRepeat] = useState(!!startRepeating && canRepeat);
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE);
  const keySeq = useRef((draft?.lines.length ?? 0) + 2);
  const save = (inp: Parameters<typeof createInvoice>[0], mode: "draft" | "send") =>
    draft ? updateDraft(draft.id, inp, mode) : repeat ? createRecurringInvoice(inp, mode, schedule) : createInvoice(inp, mode);

  const cur = customer.currency as Currency;
  const parsed = lines.map((l) => ({ description: l.description, quantity: parseFloat(l.quantity) || 0, unitPrice: toMinor(parseFloat(l.price) || 0) }));
  const totals = computeTotals(parsed, vat ? 750 : 0);
  const tooBig = amountProblem(parsed, vat ? 750 : 0);
  // Numbers only: digits and one decimal point, so pasted text like "1,000" or "₦500" still works
  const numeric = (v: string) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
  const dueIso = useMemo(() => {
    const [y, m, d] = issue.split("-").map(Number);
    return isoDate(new Date(y, m - 1, d), Number(terms));
  }, [issue, terms]);
  const account = accounts.find((a) => a.id === accountId);

  function withTransition(fn: () => void) {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(() => flushSync(fn));
    else fn();
  }

  function pickCustomer(c: Customer) {
    const switched = c.currency !== customer.currency;
    withTransition(() => {
      setCustomer(c);
      setTerms(termsOf(c.termsDays));
      const match = accounts.find((a) => a.currency === c.currency);
      if (match) setAccountId(match.id);
    });
    if (switched) toast({ title: `Currency and bank account switched to ${c.currency}` });
  }

  function addLine(item?: CatalogItem) {
    const key = keySeq.current++;
    setLines((ls) => [...ls.filter((l) => l.description || l.price || ls.length === 1 ? true : false), { key, description: item?.name ?? "", quantity: "1", price: item ? (item.unitPrice / 100).toFixed(2) : "", entering: true }]);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setLines((ls) => ls.map((l) => (l.key === key ? { ...l, entering: false } : l)));
        document.querySelector<HTMLInputElement>(`[data-line="${key}"]`)?.focus();
      }),
    );
  }
  function removeLine(key: number) {
    const idx = lines.findIndex((l) => l.key === key);
    const removed = lines[idx];
    setLines(lines.filter((l) => l.key !== key));
    toast({ title: "Item removed", undo: () => setLines((ls) => [...ls.slice(0, idx), removed, ...ls.slice(idx)]) });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        addLine();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const input = {
    customerId: customer.id, issueDate: issue, termsDays: Number(terms), category, vatBps: vat ? 750 : 0, note, template, brandColor: brand, bankAccountId: accountId,
    lines: parsed.filter((l) => l.description.trim() || l.unitPrice > 0),
    fields: fieldVals,
  };

  async function saveSeries() {
    if (!series) return;
    setError("");
    setSaving("draft");
    const res = await updateSeriesInvoice(series.id, input);
    setSaving("idle");
    if (!res.ok) return setError(res.error);
    toast({ title: "Saved. Future invoices in this series will use these details." });
    router.push(`/recurring/${series.id}`);
    router.refresh();
  }

  async function saveDraft() {
    setError("");
    setSaving("draft");
    const res = await save(input, "draft");
    setSaving("idle");
    if (!res.ok) return setError(res.error);
    toast({ title: draft ? `${res.number} saved` : repeat ? `${res.number} saved as a draft. The series carries on from it.` : `${res.number} saved as a draft` });
    router.push(`/invoices?view=drafts&fresh=${res.number}`);
  }

  const preview = {
    number: nextNumber,
    issued: formatDate(issue, { year: true }),
    due: Number(terms) ? formatDate(dueIso, { year: true }) : "On receipt",
    currency: cur,
    customer: { name: customer.name, email: customer.email, address: customer.address, currency: cur },
    items: parsed.map((l) => ({ description: l.description, quantity: l.quantity, price: l.unitPrice / 100 })),
    vatRate: vat ? 0.075 : 0,
    note,
    fields: customFields.filter((f) => f.print && fieldVals[f.id]?.trim()).map((f) => [f.label, fieldVals[f.id].trim()] as [string, string]),
  };

  return (
    <div className="ed">
      <div className="ed-form">
        <div className="ph" style={{ padding: "16px 0 8px" }}>
          <div>
            <h1 style={{ fontSize: "var(--fs-22)" }}>{series ? "Edit recurring invoice" : draft ? <>Edit draft <span className="iv-mono">{nextNumber}</span></> : repeat ? "New recurring invoice" : "New invoice"}</h1>
            <p className="sub">
              {series
                ? `Changes apply from the next invoice${series.nextRun ? `, on ${formatDate(series.nextRun, { year: true })}` : ""}. Invoices already made stay as they are.`
                : draft
                  ? "Nothing has been sent yet. Change anything, then save or send it."
                  : <>It will be numbered <span className="iv-mono">{nextNumber}</span> when you save or send it.</>}
            </p>
          </div>
        </div>

        <section className="ed-sec">
          <header><h2>Customer</h2><p>Who pays. Their currency and payment terms fill in for you.</p></header>
          <CustomerPicker
            customers={customers}
            value={customer}
            onPick={pickCustomer}
            onCreated={(id, v) => {
              const c = { id, ...v };
              setCustomers((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name)));
              pickCustomer(c);
              toast({ title: `${v.name} added and chosen` });
            }}
          />
        </section>

        <section className="ed-sec">
          <header><h2>Dates</h2><p>When it&apos;s sent and how long they have to pay.</p></header>
          <div className="fgrid">
            {!series && <TextField label={repeat ? "First invoice date" : "Invoice date"} type="date" value={issue} onChange={(e) => setIssue(e.target.value)} />}
            <CategoryField value={category} onChange={setCategory} options={defaults.categories ?? []} />
            <div className="iv-field full">
              <span className="iv-label">Time to pay</span>
              <Segmented label="Time to pay" value={terms} onChange={setTerms} options={[...TERMS]} fill />
              <span className="iv-hint">{series ? `Each invoice is due ${Number(terms) ? `${terms} days after it's made` : "on receipt"}.` : Number(terms) ? `Due ${formatDate(dueIso, { year: true })}. ${defaults.remindersNote ?? ""}` : "Due as soon as they get it."}</span>
            </div>
          </div>
        </section>

        {customFields.length > 0 && !series && (
          <section className="ed-sec">
            <header><h2>Details</h2><p>Your own fields. Ones marked private stay off the invoice.</p></header>
            <div className="fgrid">
              {customFields.map((f) => (
                <TextField
                  key={f.id}
                  label={f.label}
                  description={f.print ? "Printed on the invoice" : "Only you see this"}
                  maxLength={120}
                  value={fieldVals[f.id] ?? ""}
                  onChange={(e) => setFieldVals({ ...fieldVals, [f.id]: e.target.value })}
                />
              ))}
            </div>
          </section>
        )}

        {canRepeat && (
          <section className="ed-sec">
            <header><h2>Repeat</h2><p>For retainers and subscriptions. InVin makes the next one on time.</p></header>
            <div className="grid gap-4">
              <Switch checked={repeat} onCheckedChange={setRepeat} label={repeat ? "This invoice repeats" : "Make this a recurring invoice"} />
              {repeat && <ScheduleFields value={schedule} onChange={setSchedule} start={issue} />}
            </div>
          </section>
        )}

        <section className="ed-sec wide">
          <header><h2>Items</h2><p>Type something new or add from your catalogue.</p></header>
          <div>
            <div className="lh"><span>Description</span><span className="text-right">Qty</span><span className="text-right">Price</span><span className="text-right">Total</span><span /></div>
            {lines.map((l, i) => (
              <div key={l.key} className="lwrap" data-entering={l.entering || undefined}>
                <div>
                  <div className="li">
                    <input className="iv-input" data-line={l.key} placeholder="What did you do or sell?" aria-label={`Item ${i + 1} description`} value={l.description} onChange={(e) => setLines(lines.map((x) => (x.key === l.key ? { ...x, description: e.target.value } : x)))} />
                    <input className="iv-input iv-num text-right" inputMode="decimal" aria-label={`Item ${i + 1} quantity`} maxLength={9} value={l.quantity} onChange={(e) => setLines(lines.map((x) => (x.key === l.key ? { ...x, quantity: numeric(e.target.value) } : x)))} />
                    <input className="iv-input iv-num text-right" inputMode="decimal" placeholder="0.00" aria-label={`Item ${i + 1} price`} maxLength={16} value={l.price} onChange={(e) => setLines(lines.map((x) => (x.key === l.key ? { ...x, price: numeric(e.target.value) } : x)))} />
                    <span className="amt"><Money value={(parsed[i].quantity * parsed[i].unitPrice) / 100} currency={cur} /></span>
                    <span className="del">
                      <Tooltip label="Remove item">
                        <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label={`Remove item ${i + 1}`} disabled={lines.length === 1} onClick={() => removeLine(l.key)} />
                      </Tooltip>
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div className="mt-1.5 flex gap-1">
              <Button variant="ghost" icon="plus" onClick={() => addLine()}>Add item <Kbd>Ctrl ↵</Kbd></Button>
              {catalog.length > 0 && (
                <Menu>
                  <MenuTrigger><Button variant="ghost" icon="copy">From catalogue</Button></MenuTrigger>
                  <MenuContent>
                    <MenuLabel>Your catalogue</MenuLabel>
                    {catalog.map((c) => (
                      <MenuItem key={c.id} onClick={() => addLine(c)}>
                        <span>{c.name}<small>per {c.unit}</small></span>
                        <span className="iv-right iv-num">{formatMoney(c.unitPrice / 100, c.currency as Currency)}</span>
                      </MenuItem>
                    ))}
                  </MenuContent>
                </Menu>
              )}
            </div>
            {tooBig && <div className="form-error mt-3" role="alert"><Icon name="alert" />{tooBig}</div>}
            <div className="etot">
              <div><span className="text-text-2">Subtotal</span><Money value={totals.subtotal / 100} currency={cur} /></div>
              <div><Switch checked={vat} onCheckedChange={setVat} label={<span className="text-text-2">VAT 7.5%</span>} />{vat ? <Money value={totals.tax / 100} currency={cur} /> : <span className="text-text-2">—</span>}</div>
            </div>
          </div>
        </section>

        <section className="ed-sec">
          <header><h2>Getting paid</h2><p>These account details print on the invoice and the online invoice page.</p></header>
          <div className="grid gap-4">
            <div className="accts" role="radiogroup" aria-label="Bank account">
              {accounts.map((a) => (
                <button key={a.id} type="button" role="radio" aria-checked={a.id === accountId} className="acct" onClick={() => setAccountId(a.id)}>
                  <span className="rad" />
                  <span><b>{a.bank}</b><small>{a.currency} · ••{a.rows.find(([k]) => /number|IBAN/i.test(k))?.[1].slice(-4)}</small></span>
                  {a.currency === customer.currency && <span className="match">Matches {a.currency}</span>}
                </button>
              ))}
            </div>
            <TextArea label="Note to customer" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </section>

        {error && <div className="form-error"><Icon name="alert" />{error}</div>}

        <div className="ed-bar">
          <div className="total">
            <small>{series ? "Each invoice" : repeat ? `Total · repeats ${schedule.frequency === "quarterly" ? "every 3 months" : schedule.frequency}` : `Total · ${Number(terms) ? `due ${formatDate(dueIso)}` : "due on receipt"}`}</small>
            <b><Money value={totals.total / 100} currency={cur} /></b>
          </div>
          {series ? (
            <Button variant="primary" icon="check" onClick={saveSeries} disabled={saving !== "idle" || !input.lines.length || !!tooBig} style={{ minWidth: 140 }}>
              <MorphLabel id={saving}>{saving === "draft" ? "Saving…" : "Save changes"}</MorphLabel>
            </Button>
          ) : (
          <>
          <Button variant="ghost" onClick={saveDraft} disabled={saving !== "idle" || !!tooBig}>
            <MorphLabel id={saving}>{saving === "draft" ? "Saving…" : "Save draft"}</MorphLabel>
          </Button>
          <SendDialog
            disabled={!input.lines.length || !!tooBig}
            customer={customer}
            number={nextNumber}
            total={totals.total}
            currency={cur}
            due={Number(terms) ? formatDate(dueIso, { year: true }) : "on receipt"}
            business={business.name}
            sender={sender}
            brand={brand}
            onSend={async (email) => {
              setError("");
              const res = await save({ ...input, email }, "send");
              if (!res.ok) {
                setError(res.error);
                return false;
              }
              setTimeout(() => {
                router.push(`/invoices?fresh=${res.number}`);
                toast({ title: res.delivery === "sent" ? `${res.number} sent to ${customer.name}` : res.delivery === "failed" ? `${res.number} is marked sent, but the email failed. See Sent emails.` : `${res.number} is marked sent. Email is in test mode, see Sent emails.` });
                sheet.open(res.id);
              }, 650);
              return true;
            }}
          />
          </>
          )}
        </div>
      </div>

      <div className="ed-prev">
        <div className="stick">
          <div className="look">
            <TemplatePicker value={template} onChange={(t) => withTransition(() => setTemplate(t))} brand={brand} />
            <ColourSwatches colours={BRAND_COLOURS} value={brand} onChange={setBrand} />
          </div>
<div className="prev-wrap" data-invalid={tooBig ? true : undefined}>
            <InvoicePaper invoice={preview} business={business} account={account ? { ...account, currency: account.currency as Currency } : { id: "", currency: cur, bank: "No bank account", rows: [] }} template={template} brand={brand} fontSize={9.4} />
            {tooBig && <p className="prev-note"><Icon name="alert" />Fix the amount to see the preview</p>}
          </div>
          <p className="mt-3.5 text-center text-[12px] text-text-2">{series ? `Each invoice in the series will look like this, with its own number and dates.` : `This is exactly what ${customer.name} will see and download.`}</p>
        </div>
      </div>
    </div>
  );
}

function CustomerPicker({ customers, value, onPick, onCreated }: { customers: Customer[]; value: Customer; onPick: (c: Customer) => void; onCreated: (id: string, v: Omit<Customer, "id">) => void }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const list = customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.email.toLowerCase().includes(q.toLowerCase()));
  function choose(c: Customer) {
    onPick(c);
    setOpen(false);
    setQ("");
  }
  return (
    <>
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); setActive(0); }}>
      <PopoverTrigger>
        <button type="button" className="cust-pick">
          <Avatar name={value.name} size="lg" />
          <span className="min-w-0 flex-1"><b>{value.name}</b><small>{value.email} · pays in {value.currency}</small></span>
          <span className="flex items-center gap-1 text-[13px] text-text-2">Change <Icon name="chevron" /></span>
        </button>
      </PopoverTrigger>
      <PopoverContent width="anchor">
        <div className="mb-1 flex items-center gap-2 border-b border-line px-2 pb-2 text-text-2">
          <Icon name="search" />
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(list.length - 1, a + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              if (e.key === "Enter" && list[active]) { e.preventDefault(); choose(list[active]); }
            }}
            placeholder="Search customers"
            aria-label="Search customers"
            className="h-8 flex-1 bg-transparent text-text outline-none placeholder:text-text-2"
          />
        </div>
        <div className="max-h-[280px] overflow-auto">
          {list.map((c, i) => (
            <button key={c.id} type="button" className="iv-menu-item text-left" data-highlighted={i === active || undefined} onMouseMove={() => setActive(i)} onClick={() => choose(c)}>
              <Avatar name={c.name} size="md" />
              <span>{c.name}<small>{c.email}</small></span>
              <span className="iv-right">{c.currency}</span>
            </button>
          ))}
          {list.length === 0 && <div className="iv-menu-label">No customers match “{q}”.</div>}
        </div>
        <div className="mt-1 border-t border-line pt-1">
          <button
            type="button"
            className="iv-menu-item w-full text-left"
            onClick={() => {
              // Close the list first so the new-customer dialog has the screen to itself
              setNewName(q.trim());
              setOpen(false);
              setAdding(true);
            }}
          >
            <Icon name="plus" />
            <span>{q.trim() ? `Add “${q.trim()}” as a new customer` : "Add a new customer"}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
    <CustomerDialog open={adding} onOpenChange={setAdding} prefillName={newName} onSaved={(id, v) => onCreated(id, v)} />
    </>
  );
}

function SendDialog({
  disabled, customer, number, total, currency, due, business, sender, brand, onSend,
}: {
  disabled: boolean; customer: Customer; number: string; total: number; currency: Currency; due: string; business: string; sender: string; brand: string;
  onSend: (email: { to: string; subject: string; message: string; attachPdf: boolean }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(customer.email);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pdf, setPdf] = useState(true);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const amount = formatMoney(total / 100, currency);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (state !== "sending") setOpen(o);
      }}
    >
      <Button
        variant="primary"
        icon="send"
        disabled={disabled}
        onClick={() => {
          // Fill the email fresh each time, from what's on the invoice right now
          setTo(customer.email);
          setSubject(`Invoice ${number} from ${business}`);
          setMessage(`Hi ${customer.name.split(" ")[0]},\n\nHere's invoice ${number} for ${amount}, due ${due}. You'll find the bank details on the invoice.\n\nThanks,\n${sender}`);
          setState("idle");
          setOpen(true);
        }}
      >
        Review and send
      </Button>
      <DialogContent
        title={`Send ${number}`}
        description={<>{amount} to {customer.name}, due {due}.</>}
        footer={
          <>
            <span className="iv-sp" />
            <DialogClose render={<Button disabled={state !== "idle"}>Back to editing</Button>} />
            <Button
              variant="primary"
              style={{ minWidth: 136 }}
              disabled={state !== "idle" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)}
              onClick={async () => {
                setState("sending");
                const ok = await onSend({ to, subject, message, attachPdf: pdf });
                if (!ok) return setState("idle"), setOpen(false);
                setState("sent");
                setTimeout(() => setOpen(false), 600);
              }}
            >
              <MorphLabel id={state}>
                {state === "idle" && <><Icon name="send" />Send invoice</>}
                {state === "sending" && "Sending…"}
                {state === "sent" && <><Icon name="check" />Sent</>}
              </MorphLabel>
            </Button>
          </>
        }
      >
        <TextField label="To" type="email" value={to} onChange={(e) => setTo(e.target.value)} error={to && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to) ? "Check the email address, it looks incomplete." : undefined} />
        <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <TextArea label="Message" value={message} onChange={(e) => setMessage(e.target.value)} style={{ height: 150 }} />
        <div className="rounded-lg bg-surface-2 p-3 text-[13px] text-text-2">
          The email includes a <span className="rounded px-1.5 py-0.5 font-medium text-white" style={{ background: brand }}>View invoice</span> button. Your customer can download the PDF and see your bank details there.
        </div>
        <Switch checked={pdf} onCheckedChange={setPdf} label="Attach the invoice as a PDF" />
      </DialogContent>
    </Dialog>
  );
}

/** Pick one of the workspace's categories, or type a new one. New ones are remembered when the invoice is saved. */
function CategoryField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const all = options.includes(value) || !value ? options : [...options, value];
  const add = () => {
    const c = draft.trim().replace(/\s+/g, " ").slice(0, 30);
    if (!c) return;
    onChange(all.find((x) => x.toLowerCase() === c.toLowerCase()) ?? c);
    setDraft("");
    setOpen(false);
  };
  return (
    <div className="iv-field">
      <span className="iv-label">Category</span>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDraft(""); }}>
        <PopoverTrigger>
          <button type="button" className="iv-input cat-pick" aria-label={`Category: ${value || "none"}`}>
            <span className="cat-dot" style={{ background: tintFor(value || "General")[1] }} />
            <span className="min-w-0 flex-1 truncate text-left">{value || "Choose a category"}</span>
            <Icon name="chevron" />
          </button>
        </PopoverTrigger>
        <PopoverContent width="anchor">
          <div className="max-h-[240px] overflow-auto">
            {all.map((c) => (
              <button key={c} type="button" className="iv-menu-item w-full text-left" data-highlighted={c === value || undefined} onClick={() => { onChange(c); setOpen(false); }}>
                <span className="cat-dot" style={{ background: tintFor(c)[1] }} />
                <span>{c}</span>
                {c === value && <span className="iv-right"><Icon name="check" /></span>}
              </button>
            ))}
          </div>
          <form className="mt-1 flex items-center gap-2 border-t border-line px-2 pt-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
            <Icon name="plus" />
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={30} placeholder="New category" aria-label="New category" className="h-8 flex-1 bg-transparent text-text outline-none placeholder:text-text-2" />
            {draft.trim() && <Button size="sm" variant="primary" type="submit">Add</Button>}
          </form>
        </PopoverContent>
      </Popover>
      <span className="iv-hint">Groups invoices on Home and in reports.</span>
    </div>
  );
}
