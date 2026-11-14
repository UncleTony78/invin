"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactElement, type ReactNode } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Segmented, Switch, TextArea, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Avatar, Tag } from "@/components/ui/identity";
import { Dialog, DialogClose, DialogContent, DialogTrigger, Tooltip } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { ColourSwatches, TemplatePicker, type Template } from "@/components/invoice/paper";
import { BRAND_COLOURS } from "@/lib/sample";
import { tintFor } from "@/lib/format";
import { deleteBankAccount, saveBankAccount, updateAutomation, updateBusiness, type AutomationInput, type BankInput, type BusinessInput } from "@/server/crm-actions";
import { describeOffset } from "@/lib/schedule";

type Account = { id: string; bank: string; currency: string; rows: [string, string][] };
type Member = { id: string; name: string; email: string; role: string; you: boolean };
type EmailState = { mode: "off" } | { mode: "test"; to: string } | { mode: "live"; from: string };
const CURRENCIES = ["USD", "GBP", "EUR", "NGN"] as const;

/** Reminder steps you can switch on, in days from the due date */
const STEPS = [-7, -3, -1, 0, 1, 3, 7, 14, 30];

export function SettingsView({ business, automation, accounts, team, email }: { business: BusinessInput; automation: AutomationInput; accounts: Account[]; team: Member[]; email: EmailState }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(business);
  const [base, setBase] = useState(business);
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");
  const [auto, setAuto] = useState(automation);
  const [autoBase, setAutoBase] = useState(automation);
  const bizDirty = JSON.stringify(v) !== JSON.stringify(base);
  const autoDirty = JSON.stringify(auto) !== JSON.stringify(autoBase);
  const dirty = bizDirty || autoDirty;
  const toggleStep = (n: number) => setAuto((a) => ({ ...a, reminderOffsets: a.reminderOffsets.includes(n) ? a.reminderOffsets.filter((x) => x !== n) : [...a.reminderOffsets, n].sort((x, y) => x - y) }));
  const set = (patch: Partial<BusinessInput>) => setV((x) => ({ ...x, ...patch }));
  const sample = `${v.numberPrefix}${String(v.nextNumber || 1).padStart(4, "0")}`;

  async function save() {
    setError("");
    setState("saving");
    const res = bizDirty ? await updateBusiness(v) : { ok: true as const };
    if (!res.ok) {
      setState("idle");
      return setError(res.error);
    }
    setBase(v);
    const res2 = autoDirty ? await updateAutomation(auto) : { ok: true as const };
    setState("idle");
    if (!res2.ok) return setError(res2.error);
    setAutoBase(auto);
    toast({ title: "Settings saved" });
    router.refresh();
  }

  return (
    <div className="wrap set" style={{ maxWidth: 880 }}>
      <div className="ph">
        <div>
          <h1>Settings</h1>
          <p className="sub">How your business appears on invoices, and where customers pay you.</p>
        </div>
      </div>

      <Section title="Business" hint="Shown at the top of every invoice and in the emails customers get.">
        <div className="fgrid">
          <TextField label="Business name" value={v.name} onChange={(e) => set({ name: e.target.value })} />
          <TextField label="Mark" description="1 to 3 letters, used when there's no logo." maxLength={3} value={v.mark} onChange={(e) => set({ mark: e.target.value.toUpperCase() })} />
          <TextField label="Business email" type="email" description="Customer replies and payment notices go here." value={v.email} onChange={(e) => set({ email: e.target.value })} />
          <TextArea label="Address" rows={3} value={v.address} onChange={(e) => set({ address: e.target.value })} />
        </div>
      </Section>

      <Section title="Invoice look" hint="The default for new invoices. You can still change it on any single invoice.">
        <TemplatePicker value={v.template as Template} onChange={(t) => set({ template: t })} brand={v.brandColor} />
        <div className="iv-field mt-5">
          <span className="iv-label">Colour</span>
          <ColourSwatches colours={BRAND_COLOURS} value={v.brandColor} onChange={(c) => set({ brandColor: c })} />
        </div>
      </Section>

      <Section title="Numbering" hint={<>Your next invoice will be <b className="iv-mono">{sample}</b>.</>}>
        <div className="fgrid">
          <TextField label="Prefix" maxLength={8} placeholder="INV-" value={v.numberPrefix} onChange={(e) => set({ numberPrefix: e.target.value })} />
          <TextField label="Next number" inputMode="numeric" description="Can only move to numbers you haven't used." value={String(v.nextNumber || "")} onChange={(e) => set({ nextNumber: parseInt(e.target.value.replace(/\D/g, "")) || 0 })} />
        </div>
      </Section>

      <Section title="Categories" hint="What you bill for. Pick one on each invoice to see what earns the most. Removing one doesn't change invoices that already use it.">
        <CategoryList value={auto.categories} onChange={(categories) => setAuto((a) => ({ ...a, categories }))} />
      </Section>

      <Section title="Invoice fields" hint="Extra details you fill in on each invoice, like a PO number or project. Choose which ones customers see.">
        <FieldList value={auto.customFields} onChange={(customFields) => setAuto((a) => ({ ...a, customFields }))} />
      </Section>

      <Section id="reminders" title="Reminders" hint="Polite emails to customers who haven't paid yet. Each one goes once per invoice, and stops as soon as it's paid.">
        <Switch checked={auto.remindersOn} onCheckedChange={(on) => setAuto((a) => ({ ...a, remindersOn: on }))} label="Send payment reminders for me" />
        <div className="iv-field" data-off={!auto.remindersOn || undefined}>
          <span className="iv-label">When to send them</span>
          <div className="set-steps" role="group" aria-label="Reminder steps">
            {STEPS.map((n) => (
              <button key={n} type="button" className="wc-chip" aria-pressed={auto.reminderOffsets.includes(n)} disabled={!auto.remindersOn} onClick={() => toggleStep(n)}>
                {auto.reminderOffsets.includes(n) && <Icon name="check" size={14} />}
                {describeOffset(n)}
              </button>
            ))}
          </div>
          <span className="iv-hint">You can pause them for one invoice or one customer at any time.</span>
        </div>
      </Section>

      <Section title="Receipts" hint="A short thank-you with the amount and what's left, so customers know their money arrived.">
        <Switch checked={auto.receiptsOn} onCheckedChange={(on) => setAuto((a) => ({ ...a, receiptsOn: on }))} label="Email a receipt when I record a payment" />
        <span className="iv-hint">It goes about a minute after you record the payment, so Undo can still stop it.</span>
      </Section>

      <Section
        title="Bank accounts"
        hint="Printed on invoices so customers know where to pay. Each invoice uses the account that matches its currency."
        action={<BankDialog trigger={<Button size="sm" icon="plus">Add account</Button>} onSaved={() => { toast({ title: "Account added" }); router.refresh(); }} />}
      >
        {accounts.length === 0 ? (
          <div className="empty"><b>No accounts yet.</b>Add one so customers can see where to send money.</div>
        ) : (
          <ul className="set-accts">
            {accounts.map((a) => (
              <li key={a.id}>
                <span className="set-cur iv-mono">{a.currency}</span>
                <div className="min-w-0 flex-1">
                  <b>{a.bank}</b>
                  <dl>
                    {a.rows.map(([k, val]) => (
                      <div key={k}><dt>{k}</dt><dd className={/\d/.test(val) ? "iv-mono" : undefined}>{val}</dd></div>
                    ))}
                  </dl>
                </div>
                <div className="ra" style={{ opacity: 1 }}>
                  <BankDialog
                    id={a.id}
                    initial={a}
                    trigger={<Button size="sm" variant="ghost" iconOnly icon="pencil" aria-label={`Edit ${a.bank} ${a.currency}`} />}
                    onSaved={() => { toast({ title: "Account saved" }); router.refresh(); }}
                  />
                  <Tooltip label="Remove">
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon="trash"
                      aria-label={`Remove ${a.bank} ${a.currency}`}
                      onClick={async () => {
                        const res = await deleteBankAccount(a.id);
                        if (!res.ok) return toast({ title: res.error });
                        router.refresh();
                        toast({ title: `${a.bank} ${a.currency} removed`, undo: async () => { await saveBankAccount(null, a); router.refresh(); } });
                      }}
                    />
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Email delivery" hint="How invoices and reminders reach your customers.">
        <div className="set-mail" data-mode={email.mode}>
          <Icon name={email.mode === "off" ? "alert" : "mail"} />
          <div>
            {email.mode === "test" && (
              <>
                <b>Test mode</b>
                <p>Every email goes to <span className="iv-mono">{email.to}</span> instead of the customer, so you can check them safely.</p>
              </>
            )}
            {email.mode === "live" && (
              <>
                <b>Live</b>
                <p>Emails go to customers from <span className="iv-mono">{email.from}</span>.</p>
              </>
            )}
            {email.mode === "off" && (
              <>
                <b>Not set up</b>
                <p>Emails are saved in the outbox but not sent. Add a sending address to deliver them.</p>
              </>
            )}
          </div>
          <Link className="iv-btn iv-btn--ghost iv-btn--sm" href="/outbox">See outbox</Link>
        </div>
      </Section>

      <Section title="Team" hint="Everyone here can create and send invoices. Inviting teammates comes next.">
        <ul className="set-team">
          {team.map((m) => (
            <li key={m.id}>
              <Avatar name={m.name} size="md" />
              <span className="min-w-0 flex-1"><b>{m.name}{m.you && <span className="text-text-2 font-normal"> (you)</span>}</b><small>{m.email}</small></span>
              <Tag>{m.role[0].toUpperCase() + m.role.slice(1)}</Tag>
            </li>
          ))}
        </ul>
      </Section>

      <AnimatePresence>
        {dirty && (
          <motion.div
            className="set-bar"
            role="region"
            aria-label="Unsaved changes"
            initial={{ opacity: 0, transform: "translate(-50%, 12px)" }}
            animate={{ opacity: 1, transform: "translate(-50%, 0px)" }}
            exit={{ opacity: 0, transform: "translate(-50%, 12px)" }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            {error ? <span className="set-err"><Icon name="alert" />{error}</span> : <span>You have unsaved changes.</span>}
            <Button size="sm" variant="ghost" onClick={() => { setV(base); setAuto(autoBase); setError(""); }}>Discard</Button>
            <Button size="sm" variant="primary" onClick={save} disabled={state === "saving"} style={{ minWidth: 112 }}>
              <MorphLabel id={state}>{state === "saving" ? "Saving…" : "Save changes"}</MorphLabel>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ id, title, hint, action, children }: { id?: string; title: string; hint: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="set-sec" id={id}>
      <header>
        <h2 className="sec-h">{title}</h2>
        <p className="sec-hint">{hint}</p>
        {action && <div className="set-act">{action}</div>}
      </header>
      <div>{children}</div>
    </section>
  );
}

const PRESETS: Record<string, [string, string][]> = {
  USD: [["Account name", ""], ["Account number", ""], ["Routing number", ""]],
  GBP: [["Account name", ""], ["Sort code", ""], ["Account number", ""]],
  EUR: [["Account name", ""], ["IBAN", ""], ["BIC", ""]],
  NGN: [["Account name", ""], ["Account number", ""]],
};

function BankDialog({ trigger, initial, id, onSaved }: { trigger: ReactElement; initial?: BankInput; id?: string; onSaved: () => void }) {
  const blank: BankInput = { currency: "USD", bank: "", rows: PRESETS.USD };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<BankInput>(initial ?? blank);
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");
  const setRow = (i: number, j: 0 | 1, val: string) => setV((x) => ({ ...x, rows: x.rows.map((r, k) => (k === i ? (j === 0 ? [val, r[1]] : [r[0], val]) : r)) }));

  async function save() {
    setError("");
    setState("saving");
    const res = await saveBankAccount(id ?? null, v);
    setState("idle");
    if (!res.ok) return setError(res.error);
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(initial ?? blank); setError(""); } }}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent
        title={id ? "Edit bank account" : "Add a bank account"}
        description="Customers see these details on invoices in this currency. Double-check the numbers."
        footer={
          <>
            <span className="iv-sp" />
            <DialogClose render={<Button>Cancel</Button>} />
            <Button variant="primary" onClick={save} disabled={state === "saving"} style={{ minWidth: 120 }}>
              <MorphLabel id={state}>{state === "saving" ? "Saving…" : <><Icon name="check" />{id ? "Save" : "Add account"}</>}</MorphLabel>
            </Button>
          </>
        }
      >
        <div className="iv-field">
          <span className="iv-label">Currency</span>
          <Segmented
            label="Currency"
            value={v.currency as (typeof CURRENCIES)[number]}
            onChange={(c) => setV((x) => ({ ...x, currency: c, rows: x.rows.every(([, val]) => !val) ? PRESETS[c] : x.rows }))}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            fill
          />
        </div>
        <TextField label="Bank" placeholder="e.g. Barclays" autoFocus value={v.bank} onChange={(e) => setV({ ...v, bank: e.target.value })} />
        <div className="iv-field">
          <span className="iv-label">Details</span>
          <div className="set-rows">
            {v.rows.map(([k, val], i) => (
              <div key={i}>
                <input className="iv-input" aria-label={`Detail ${i + 1} label`} placeholder="Label" value={k} onChange={(e) => setRow(i, 0, e.target.value)} />
                <input className="iv-input iv-mono" aria-label={k || `Detail ${i + 1}`} placeholder="Value" value={val} onChange={(e) => setRow(i, 1, e.target.value)} />
                <Button size="sm" variant="ghost" iconOnly icon="x" aria-label={`Remove ${k || "detail"}`} onClick={() => setV((x) => ({ ...x, rows: x.rows.filter((_, n) => n !== i) }))} />
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" icon="plus" className="justify-self-start -ml-2" onClick={() => setV((x) => ({ ...x, rows: [...x.rows, ["", ""]] }))}>Add a detail</Button>
        </div>
        {error && <div className="form-error"><Icon name="alert" />{error}</div>}
      </DialogContent>
    </Dialog>
  );
}

function CategoryList({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const c = draft.trim().replace(/\s+/g, " ");
    if (!c || value.some((x) => x.toLowerCase() === c.toLowerCase())) return setDraft("");
    onChange([...value, c.slice(0, 30)]);
    setDraft("");
  };
  return (
    <div className="grid gap-3">
      <ul className="cat-list">
        {value.map((c) => (
          <li key={c}>
            <span className="cat-dot" style={{ background: tintFor(c)[1] }} />
            {c}
            <button type="button" aria-label={`Remove ${c}`} disabled={value.length === 1} onClick={() => onChange(value.filter((x) => x !== c))}>
              <Icon name="x" size={12} />
            </button>
          </li>
        ))}
      </ul>
      <form className="field-s" style={{ width: "100%", maxWidth: 320 }} onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Icon name="plus" />
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={30} placeholder="Add a category" aria-label="Add a category" />
        {draft.trim() && <Button size="sm" variant="ghost" type="submit">Add</Button>}
      </form>
    </div>
  );
}

function FieldList({ value, onChange }: { value: AutomationInput["customFields"]; onChange: (v: AutomationInput["customFields"]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const label = draft.trim().slice(0, 30);
    if (!label || value.length >= 8 || value.some((f) => f.label.toLowerCase() === label.toLowerCase())) return setDraft("");
    onChange([...value, { id: Math.random().toString(36).slice(2, 10), label, print: true }]);
    setDraft("");
  };
  return (
    <div className="grid gap-3">
      {value.length > 0 && (
        <ul className="fld-list">
          {value.map((f) => (
            <li key={f.id}>
              <input value={f.label} maxLength={30} aria-label="Field name" onChange={(e) => onChange(value.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))} />
              <Switch checked={f.print} onCheckedChange={(on) => onChange(value.map((x) => (x.id === f.id ? { ...x, print: on } : x)))} label={<span className="text-[13px] text-text-2">{f.print ? "On the invoice" : "Private"}</span>} />
              <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label={`Remove ${f.label}`} onClick={() => onChange(value.filter((x) => x.id !== f.id))} />
            </li>
          ))}
        </ul>
      )}
      {value.length < 8 && (
        <form className="field-s" style={{ width: "100%", maxWidth: 320 }} onSubmit={(e) => { e.preventDefault(); add(); }}>
          <Icon name="plus" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={30} placeholder="Add a field, e.g. PO number" aria-label="Add a field" />
          {draft.trim() && <Button size="sm" variant="ghost" type="submit">Add</Button>}
        </form>
      )}
    </div>
  );
}
