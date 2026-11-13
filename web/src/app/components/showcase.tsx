"use client";

import { flushSync } from "react-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Kbd, MorphLabel } from "@/components/ui/button";
import { CommandPalette, type Command } from "@/components/ui/command";
import { Checkbox, Segmented, Switch, TextArea, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { ActorChip, Avatar, Tag, Tabs, type Actor } from "@/components/ui/identity";
import {
  Dialog, DialogClose, DialogContent, DialogTrigger,
  Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger,
  Popover, PopoverContent, PopoverTrigger,
  Sheet, SheetClose, SheetContent, SheetStage, SheetTrigger,
  Tooltip, TooltipProvider,
} from "@/components/ui/overlay";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { Money } from "@/components/invoice/money";
import { ColourSwatches, InvoicePaper, TemplatePicker, type PaperInvoice, type Template } from "@/components/invoice/paper";
import { MoneyPipeline, type PipelineSegment } from "@/components/invoice/pipeline";
import { Glyph, STATUS_LABEL, StatusPill, type Status } from "@/components/invoice/status";
import { Timeline, type TimelineEvent } from "@/components/invoice/timeline";
import { formatMoney, type Currency } from "@/lib/format";
import { ACCOUNTS, BRAND_COLOURS, BUSINESS, CUSTOMERS } from "@/lib/sample";

/* ------------------------------------------------------------------ */
const SECTIONS = [
  ["foundations", "Foundations"],
  ["buttons", "Buttons"],
  ["forms", "Form controls"],
  ["tabs", "Tabs"],
  ["status", "Status"],
  ["people", "People and actors"],
  ["menus", "Menus and popovers"],
  ["dialogs", "Dialogs"],
  ["sheet", "Sheet"],
  ["toasts", "Toasts"],
  ["palette", "Command palette"],
  ["pipeline", "Money pipeline"],
  ["timeline", "Activity record"],
  ["paper", "Invoice designs"],
] as const;

export function Showcase() {
  return (
    <TooltipProvider>
      <ToastProvider>
        <SheetStage>
          <Page />
        </SheetStage>
      </ToastProvider>
    </TooltipProvider>
  );
}

function Page() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-line bg-canvas/90 px-6 backdrop-blur">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={theme === "dark" ? "/lockup-dark.svg" : "/lockup.svg"} alt="InVin" height={20} style={{ height: 20 }} />
        <span className="text-text-2">Components · v1.0</span>
        <span className="flex-1" />
        <Tooltip label={theme === "dark" ? "Light mode" : "Dark mode"}>
          <Button variant="ghost" iconOnly icon={theme === "dark" ? "sun" : "moon"} aria-label="Switch theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} />
        </Tooltip>
      </header>
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="hidden lg:block" aria-label="Sections">
          <ul className="sticky top-24 grid gap-1 text-[13px]">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-md px-2.5 py-1.5 text-text-2 transition-colors hover:bg-hover hover:text-text">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <main className="grid gap-14">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.02em]">InVin components</h1>
            <p className="mt-1 max-w-[62ch] text-text-2">
              The building blocks for every screen. Built on Base UI for accessibility, styled with InVin tokens. Every example here works: click, hover, press, swipe and use the keyboard.
            </p>
          </div>
          <Foundations />
          <Buttons />
          <Forms />
          <TabsDemo />
          <StatusDemo />
          <People />
          <Menus />
          <Dialogs />
          <SheetDemo />
          <Toasts />
          <Palette />
          <PipelineDemo />
          <TimelineDemo />
          <PaperDemo />
        </main>
      </div>
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-[18px] font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="mt-1 max-w-[70ch] text-[13px] text-text-2">{intro}</p>
      <div className="mt-4 rounded-xl bg-surface p-6 shadow-[0_0_0_1px_var(--line)]">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-3 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[140px_1fr]">
      <span className="text-[13px] text-text-2">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Foundations() {
  const colours: [string, string, string][] = [
    ["--canvas", "Canvas", "Rail and app frame"],
    ["--surface", "Surface", "Work areas"],
    ["--surface-2", "Inset", "Notes, details, forms"],
    ["--text", "Text", "17.4:1 on surface"],
    ["--text-2", "Secondary", "6.6:1 on surface"],
    ["--signal", "Tangerine", "Logo, focus, agent, highlights"],
  ];
  const motion: [string, string][] = [
    ["Press", "1px down, scale .985 · 90ms"],
    ["Hover", "1px up · 140ms in, 200ms out"],
    ["Menu, popover", "scale .96 from trigger · 160ms"],
    ["Dialog", "scale .96 from centre · 220ms in, 150ms out"],
    ["Sheet", "300ms drawer curve; page steps back with the swipe"],
    ["Never animated", "⌘K, J/K, tabs, typing, totals"],
  ];
  return (
    <Section id="foundations" title="Foundations" intro="Colour does a job or stays out. Tangerine is a signal, never a paint. Status colours always come with an icon.">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {colours.map(([v, n, j]) => (
          <div key={v}>
            <div className="h-14 rounded-lg shadow-[inset_0_0_0_1px_var(--line)]" style={{ background: `var(${v})` }} />
            <b className="mt-2 block text-[13px] font-medium">{n}</b>
            <span className="block font-mono text-[11px] text-text-2">{v}</span>
            <span className="block text-[12px] text-text-2">{j}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 border-t border-line pt-6 md:grid-cols-2">
        <div>
          <div className="text-[34px] font-medium tracking-[-0.025em] leading-none">
            <Money value={14056.2} />
          </div>
          <p className="mt-2 text-[22px] font-medium tracking-[-0.015em]">Owed to you</p>
          <p className="mt-1">IBM Plex Sans for everything people read. Scale ×1.2: 12 · 13 · 14 · 15 · 18 · 22 · 28 · 34.</p>
          <p className="iv-mono mt-1 text-text-2">INV-0145 · SER-0031 · IBM Plex Mono for codes</p>
        </div>
        <dl className="grid gap-2 text-[13px]">
          {motion.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line pb-2 last:border-0">
              <dt className="text-text-2">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

function Buttons() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  function send() {
    setState("sending");
    setTimeout(() => setState("sent"), 900);
    setTimeout(() => setState("idle"), 2600);
  }
  return (
    <Section id="buttons" title="Buttons" intro="One button, four looks. Primary is the single main action on a screen. Hover lifts 1px; press sinks and shrinks slightly, so every click is felt.">
      <Row label="Variants">
        <Button variant="primary" icon="plus">New invoice</Button>
        <Button icon="download">Export</Button>
        <Button variant="ghost">Save draft</Button>
        <Button variant="danger">Cancel invoice</Button>
      </Row>
      <Row label="Small · icon only">
        <Button size="sm">Remind</Button>
        <Tooltip label="Record payment">
          <Button size="sm" variant="ghost" iconOnly icon="cash" aria-label="Record payment" />
        </Tooltip>
        <Tooltip label="Copy invoice link">
          <Button iconOnly icon="link" aria-label="Copy invoice link" />
        </Tooltip>
        <Tooltip label="More actions">
          <Button variant="ghost" iconOnly icon="more" aria-label="More actions" />
        </Tooltip>
      </Row>
      <Row label="Keyboard hint">
        <Button variant="primary" icon="plus">
          New invoice <Kbd>C</Kbd>
        </Button>
      </Row>
      <Row label="Disabled">
        <Button variant="primary" disabled>Send</Button>
        <Button disabled>Export</Button>
      </Row>
      <Row label="Morphing label">
        <Button variant="primary" onClick={send} disabled={state !== "idle"} style={{ minWidth: 132 }} aria-live="polite">
          <MorphLabel id={state}>
            {state === "idle" && <><Icon name="send" />Send invoice</>}
            {state === "sending" && "Sending…"}
            {state === "sent" && <><Icon name="check" />Sent</>}
          </MorphLabel>
        </Button>
        <span className="text-[13px] text-text-2">Send → Sending… → Sent, with a blur bridge.</span>
      </Row>
    </Section>
  );
}

function Forms() {
  const [terms, setTerms] = useState<"0" | "7" | "14" | "30">("14");
  const [vat, setVat] = useState(true);
  const [email, setEmail] = useState("billing@acme");
  const invalid = email.length > 0 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (
    <Section id="forms" title="Form controls" intro="Labels above fields, hints below, errors that say what to fix. The focus ring is tangerine; the caret too.">
      <div className="grid gap-5 md:grid-cols-2">
        <TextField label="Invoice number" defaultValue="INV-0145" className="iv-mono-input" />
        <TextField label="Your reference (optional)" placeholder="e.g. a PO number" description="Printed on the invoice under the date." />
        <TextField label="Customer email" value={email} onChange={(e) => setEmail(e.target.value)} error={invalid ? "This email is missing something. Check it looks like name@company.com." : undefined} />
        <TextArea label="Note to customer" defaultValue="Thanks for a great quarter. Please use the invoice number as your payment reference." />
      </div>
      <div className="mt-6 grid gap-5 border-t border-line pt-6 md:grid-cols-2">
        <div className="grid gap-2">
          <span className="iv-label">Time to pay</span>
          <Segmented
            label="Time to pay"
            value={terms}
            onChange={setTerms}
            options={[
              { value: "0", label: "On receipt" },
              { value: "7", label: "7 days" },
              { value: "14", label: "14 days" },
              { value: "30", label: "30 days" },
            ]}
          />
          <span className="iv-hint">{terms === "0" ? "Due as soon as they get it." : `Due ${terms} days after it's sent. Reminders go out 3 days before and on the day.`}</span>
        </div>
        <div className="grid content-start gap-4">
          <Switch checked={vat} onCheckedChange={setVat} label={`VAT 7.5% ${vat ? "on" : "off"}`} />
          <Switch defaultChecked label="Let them tell you they've paid" description="Adds an “I've paid” button to the online invoice. You confirm before anything changes." />
          <label className="flex items-center gap-2.5">
            <Checkbox defaultChecked />
            Attach a PDF copy
          </label>
        </div>
      </div>
    </Section>
  );
}

function TabsDemo() {
  const [tab, setTab] = useState<"all" | "open" | "overdue" | "paid">("all");
  return (
    <Section id="tabs" title="Tabs" intro="Tabs switch instantly. People flick between them all day, so there's no animation to wait for.">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "all", label: "All", count: 13 },
          { value: "open", label: "Waiting for payment", count: 7 },
          { value: "overdue", label: "Overdue", count: 3 },
          { value: "paid", label: "Paid", count: 3 },
        ]}
      />
      <p className="mt-4 text-text-2">Showing: {tab === "all" ? "every invoice" : tab === "open" ? "invoices waiting for payment" : tab === "overdue" ? "overdue invoices" : "paid invoices"}.</p>
    </Section>
  );
}

function StatusDemo() {
  const order: Status[] = ["sent", "viewed", "partial", "paid"];
  const [i, setI] = useState(0);
  const [swap, setSwap] = useState(false);
  function next() {
    setSwap(true);
    setTimeout(() => {
      setI((v) => (v + 1) % order.length);
      requestAnimationFrame(() => setSwap(false));
    }, 140);
  }
  return (
    <Section id="status" title="Status" intro="One status model drives every pill, filter and timeline entry. Each status has a colour, an icon and plain words.">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <StatusPill key={s} status={s} />
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3 border-t border-line pt-6">
        <StatusPill status={order[i]} swapping={swap} />
        <Button size="sm" onClick={next}>Next status</Button>
        <span className="text-[13px] text-text-2">Changes crossfade through a 2px blur.</span>
      </div>
    </Section>
  );
}

const ADA: Actor = { kind: "person", name: "Ada Obi", short: "Ada O.", role: "Owner", email: "ada@adaobi.studio" };
const MOSES: Actor = { kind: "person", name: "Moses Adeyemi", short: "Moses A.", role: "Admin", email: "moses@adaobi.studio" };
const WEMIMO: Actor = { kind: "person", name: "Wemimo Ajayi", short: "Wemimo A.", role: "Member", email: "wemimo@adaobi.studio" };
const AGENT: Actor = { kind: "agent", name: "Ada's agent", owner: "Ada" };

function People() {
  return (
    <Section id="people" title="People and actors" intro="Every action names who did it: a teammate, the customer, InVin itself, or an AI agent. Agents are always labelled. Click a name for details.">
      <Row label="Avatars">
        <Avatar name="Acme Corp" />
        <Avatar name="Northstar Advisory Ltd" size="md" />
        <Avatar name="Kora Foods" size="lg" />
      </Row>
      <Row label="Actors">
        <ActorChip actor={ADA} />
        <ActorChip actor={AGENT} />
        <ActorChip actor={{ kind: "system" }} />
        <ActorChip actor={{ kind: "customer", name: "Lumen Labs" }} />
      </Row>
      <Row label="Tags · keys">
        <Tag tone="agent">Agent</Tag>
        <Tag>Customer</Tag>
        <Kbd>Ctrl K</Kbd>
        <Kbd>J</Kbd>
        <Kbd>K</Kbd>
      </Row>
    </Section>
  );
}

function Menus() {
  const toast = useToast();
  const [customer, setCustomer] = useState(CUSTOMERS[0]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const list = CUSTOMERS.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Section id="menus" title="Menus and popovers" intro="They grow out of the button you pressed. Opened by keyboard, they appear instantly. Arrow keys move, Enter picks, Esc closes.">
      <Row label="Action menu">
        <Menu>
          <MenuTrigger>
            <Button variant="ghost" iconOnly icon="more" aria-label="Actions for INV-0142" />
          </MenuTrigger>
          <MenuContent>
            <MenuItem onClick={() => toast({ title: "Opening INV-0142" })}><Icon name="eye" />Open</MenuItem>
            <MenuItem><Icon name="download" />Download PDF</MenuItem>
            <MenuItem onClick={() => toast({ title: "Invoice link copied" })}><Icon name="link" />Copy invoice link</MenuItem>
            <MenuItem onClick={() => toast({ title: "Pinned INV-0142 to the sidebar" })}><Icon name="pin" />Pin to sidebar</MenuItem>
            <MenuSeparator />
            <MenuItem danger><Icon name="x" />Cancel invoice…</MenuItem>
          </MenuContent>
        </Menu>
        <Menu>
          <MenuTrigger>
            <Button icon="users">Ada Obi Studio</Button>
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>Workspaces</MenuLabel>
            <MenuItem><span className="iv-avatar iv-avatar--md" style={{ background: "#0E5A52", color: "#fff", borderRadius: 7 }}>AO</span><span>Ada Obi Studio<small>Pro · 3 people</small></span><span className="iv-right"><Icon name="check" /></span></MenuItem>
            <MenuItem><span className="iv-avatar iv-avatar--md" style={{ background: "#FCEFDD", color: "#94470A", borderRadius: 7 }}>OB</span><span>Obi Photography<small>Free</small></span></MenuItem>
            <MenuSeparator />
            <MenuItem><Icon name="plus" />New workspace</MenuItem>
          </MenuContent>
        </Menu>
      </Row>
      <Row label="Picker popover">
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
          <PopoverTrigger>
            <button type="button" className="flex w-[340px] items-center gap-3 rounded-xl p-3 text-left shadow-[inset_0_0_0_1px_var(--line-2)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--text-2)]">
              <Avatar name={customer.name} size="lg" />
              <span className="min-w-0 flex-1">
                <b className="block font-medium">{customer.name}</b>
                <small className="text-[13px] text-text-2">{customer.email} · pays in {customer.currency}</small>
              </span>
              <span className="flex items-center gap-1 text-[13px] text-text-2">Change <Icon name="chevron" /></span>
            </button>
          </PopoverTrigger>
          <PopoverContent width="anchor">
            <div className="mb-1 flex items-center gap-2 border-b border-line px-2 pb-2 text-text-2">
              <Icon name="search" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers" aria-label="Search customers" className="h-8 flex-1 bg-transparent text-text outline-none placeholder:text-text-2" />
            </div>
            {list.map((c) => (
              <button key={c.name} type="button" className="iv-menu-item hover:bg-hover" onClick={() => { setCustomer(c); setOpen(false); toast({ title: `Currency and bank account switched to ${c.currency}` }); }}>
                <Avatar name={c.name} size="md" />
                <span className="text-left">{c.name}<small>{c.email}</small></span>
                <span className="iv-right">{c.currency}</span>
              </button>
            ))}
            {list.length === 0 && <div className="iv-menu-label">No customers match.</div>}
          </PopoverContent>
        </Popover>
      </Row>
    </Section>
  );
}

function Dialogs() {
  const toast = useToast();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [open, setOpen] = useState(false);
  function send() {
    setState("sending");
    setTimeout(() => setState("sent"), 900);
    setTimeout(() => {
      setOpen(false);
      setState("idle");
      toast({ title: "INV-0145 sent to Acme Corp", undo: () => toast({ title: "Sending cancelled" }) });
    }, 1500);
  }
  return (
    <Section id="dialogs" title="Dialogs" intro="Only for decisions that need full attention: reviewing before sending, or something that can't be undone. Focus stays inside and returns when they close.">
      <Row label="Review and send">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button variant="primary" icon="send">Review and send</Button>
          </DialogTrigger>
          <DialogContent
            title="Send INV-0145"
            description={<>$3,493.75 to Acme Corp, due Nov 27, 2026.</>}
            footer={
              <>
                <Button variant="ghost" icon="clock">Send later</Button>
                <span className="iv-sp" />
                <DialogClose render={<Button>Back to editing</Button>} />
                <Button variant="primary" onClick={send} disabled={state !== "idle"} style={{ minWidth: 132 }}>
                  <MorphLabel id={state}>
                    {state === "idle" && <><Icon name="send" />Send invoice</>}
                    {state === "sending" && "Sending…"}
                    {state === "sent" && <><Icon name="check" />Sent</>}
                  </MorphLabel>
                </Button>
              </>
            }
          >
            <TextField label="To" defaultValue="billing@acme.co" />
            <TextField label="Subject" defaultValue="Invoice INV-0145 from Ada Obi Studio" />
            <div className="rounded-lg bg-surface-2 p-4 text-[13px] leading-relaxed">
              Hi Acme team,
              <br />
              Here&apos;s invoice INV-0145 for $3,493.75, due Nov 27, 2026. The bank details are on the invoice.
              <br />
              Thanks, Ada
            </div>
            <Switch defaultChecked label="Attach a PDF copy" />
          </DialogContent>
        </Dialog>
      </Row>
      <Row label="Can't be undone">
        <Dialog>
          <DialogTrigger>
            <Button variant="danger">Cancel invoice…</Button>
          </DialogTrigger>
          <DialogContent
            title="Cancel INV-0142?"
            description="Acme Corp won't be able to pay it, and reminders stop. You can't undo this, but you can copy it to a new invoice."
            footer={
              <>
                <span className="iv-sp" />
                <DialogClose render={<Button>Keep invoice</Button>} />
                <DialogClose render={<Button variant="danger" onClick={() => toast({ title: "INV-0142 cancelled" })}>Cancel invoice</Button>} />
              </>
            }
          />
        </Dialog>
      </Row>
    </Section>
  );
}

const DEMO_INVOICE: PaperInvoice = {
  number: "INV-0139",
  issued: "Nov 6, 2026",
  due: "Nov 20, 2026",
  currency: "GBP",
  customer: CUSTOMERS[1],
  items: [
    { description: "Brand identity, phase 2", quantity: 1, price: 1350 },
    { description: "File export and handover", quantity: 5, price: 90 },
  ],
  paid: 900,
};

function SheetDemo() {
  const toast = useToast();
  const [paid, setPaid] = useState(900);
  const [stamp, setStamp] = useState(false);
  const total = 1800;
  const left = total - paid;
  return (
    <Section id="sheet" title="Sheet" intro="Invoice details open over the list, so you never lose your place. The page behind steps back. On touch, swipe right to close; a quick flick is enough.">
      <Sheet>
        <SheetTrigger>
          <Button icon="eye">Open INV-0139</Button>
        </SheetTrigger>
        <SheetContent
          label="Invoice INV-0139"
          top={
            <>
              <span className="iv-mono mr-auto ml-1 flex items-center gap-2.5 font-medium">
                INV-0139 <StatusPill status={left > 0 ? "partial" : "paid"} />
              </span>
              <Button variant="ghost" icon="pin" onClick={() => toast({ title: "Pinned INV-0139 to the sidebar" })}>Pin to sidebar</Button>
              <SheetClose render={<Button variant="ghost" iconOnly icon="x" aria-label="Close" />} />
            </>
          }
        >
          <div className="px-8 pt-6 pb-10">
            <div className="flex items-center gap-2.5 text-text-2">
              <Avatar name="Northstar Advisory Ltd" size="md" />
              <span><b className="font-medium text-text">Northstar Advisory Ltd</b><br /><span className="text-[13px]">finance@northstar.co.uk</span></span>
            </div>
            <div className="mt-3 text-[34px] font-medium tracking-[-0.025em] leading-tight"><Money value={total} currency="GBP" /></div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--secondary)]" aria-hidden="true">
              <i className="block h-full origin-left rounded-full bg-[var(--st-paid)] transition-transform duration-[600ms] ease-[var(--ease-in-out)]" style={{ transform: `scaleX(${paid / total})` }} />
            </div>
            <div className="mt-2 flex justify-between text-[13px] text-text-2">
              {left > 0 ? (
                <>
                  <span><b className="font-medium text-text">{formatMoney(paid, "GBP")}</b> paid · <b className="font-medium text-text">{formatMoney(left, "GBP")}</b> left</span>
                  <span>Due Nov 20 · in 7 days</span>
                </>
              ) : (
                <span><b className="font-medium text-text">Paid in full</b> · today</span>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              {left > 0 ? (
              <Button
                variant="primary"
                icon="cash"
                onClick={() => {
                  setPaid(total);
                  setStamp(true);
                  toast({ title: "INV-0139 is paid in full", undo: () => { setPaid(900); setStamp(false); } });
                }}
              >
                Record {formatMoney(left, "GBP")}
              </Button>
              ) : (
                <Button icon="mail" onClick={() => toast({ title: "Receipt sent to Northstar Advisory Ltd" })}>Send receipt</Button>
              )}
              {left > 0 ? <Button icon="bell">Send reminder</Button> : <Button icon="download">Download PDF</Button>}
            </div>
            <div className="mt-6">
              <InvoicePaper invoice={{ ...DEMO_INVOICE, paid: left > 0 ? paid : 0 }} business={BUSINESS} account={ACCOUNTS[1]} template="classic" brand="#0E5A52" fontSize={8.4} stamp={stamp ? { kind: "paid", press: true } : undefined} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </Section>
  );
}

function Toasts() {
  const toast = useToast();
  return (
    <Section id="toasts" title="Toasts" intro="Quiet confirmation at the bottom. Hover pauses the timer; swipe down to dismiss. Anything reversible offers Undo.">
      <Row label="Examples">
        <Button onClick={() => toast({ title: "Reminder sent to Kora Foods" })}>Simple</Button>
        <Button onClick={() => toast({ title: "Item removed", undo: () => toast({ title: "Item restored" }) })}>With undo</Button>
        <Button onClick={() => ["Reminder sent to Kora Foods", "Reminder sent to Bloom & Co", "Reminder sent to Halden & Sons"].forEach((t, i) => setTimeout(() => toast({ title: t }), i * 180))}>
          Stack of three
        </Button>
      </Row>
    </Section>
  );
}

function Palette() {
  const toast = useToast();
  const commands: Command[] = useMemo(
    () => [
      { id: "home", group: "Go to", label: "Home", icon: "home", run: () => toast({ title: "Going to Home" }) },
      { id: "inv", group: "Go to", label: "Invoices", icon: "file", run: () => toast({ title: "Going to Invoices" }) },
      { id: "new", group: "Actions", label: "New invoice", icon: "plus", hint: "C", run: () => toast({ title: "New invoice" }) },
      { id: "pay", group: "Actions", label: "Record a payment for INV-0138", icon: "cash", run: () => toast({ title: "Recording a payment" }) },
      { id: "0142", group: "Invoices", label: "INV-0142 · Acme Corp", icon: "file", hint: "$3,200.00", run: () => toast({ title: "Opening INV-0142" }) },
      { id: "0141", group: "Invoices", label: "INV-0141 · Northstar Advisory Ltd", icon: "file", hint: "£1,850.00", run: () => toast({ title: "Opening INV-0141" }) },
    ],
    [toast],
  );
  return (
    <Section id="palette" title="Command palette" intro="Jump anywhere or do anything from the keyboard. It appears instantly with no animation, because it's used many times a day.">
      <CommandPalette commands={commands} />
    </Section>
  );
}

function PipelineDemo() {
  const [moved, setMoved] = useState(false);
  const segments: PipelineSegment[] = [
    { key: "draft", label: "Drafts", value: 777.6, count: 1, note: "not sent" },
    { key: "open", label: "Not due yet", value: 10792.5, count: 4 },
    { key: "overdue", label: "Overdue", value: moved ? 2283.7 : 3263.7, count: moved ? 2 : 3 },
    { key: "paid", label: "Paid this month", value: moved ? 10330 : 9350, count: moved ? 4 : 3 },
  ];
  const owed = segments[1].value + segments[2].value;
  return (
    <Section id="pipeline" title="Money pipeline" intro="InVin's signature: all your money in one bar. Every part is a filter. When a payment lands, the money visibly moves from Overdue to Paid.">
      <div className="grid items-end gap-x-10 gap-y-4 md:grid-cols-[auto_1fr]">
        <div>
          <span className="text-[13px] text-text-2">Owed to you</span>
          <div className="mt-1 text-[34px] font-medium leading-tight tracking-[-0.025em]"><Money value={owed} /></div>
        </div>
        <MoneyPipeline segments={segments} />
      </div>
      <div className="mt-6 flex items-center gap-3 border-t border-line pt-6">
        <Button size="sm" icon="cash" onClick={() => setMoved((m) => !m)}>{moved ? "Undo payment" : "Record $980.00 from Halden & Sons"}</Button>
        <span className="text-[13px] text-text-2">Thin version for list headers:</span>
        <div className="min-w-[200px] flex-1"><MoneyPipeline segments={segments} variant="thin" /></div>
      </div>
    </Section>
  );
}

function TimelineDemo() {
  const events: TimelineEvent[] = [
    { id: "1", time: "Nov 8, 2026 · 10:42 AM", title: "Invoice cancelled", actor: ADA, note: "Sent to the wrong billing contact. We emailed the customer and paused their recurring invoices until the contact is fixed." },
    {
      id: "2", time: "Nov 8, 2026 · 10:36 AM", title: "Refund issued · £600.00", actor: AGENT,
      execution: [
        { label: "Started by", value: <><Glyph status="spark" />Ada&apos;s agent</> },
        { label: "Approved by", value: <ActorChip actor={ADA} /> },
        { label: "Connected through", value: <><Icon name="plug" />InVin MCP</> },
        { label: "Action", value: "Issue a refund" },
        { label: "Amount", value: "£600.00 to AJANK PLC" },
        { label: "Result", value: <><span style={{ color: "var(--st-paid)", display: "inline-flex" }}><Glyph status="paid" /></span>Refund processed</> },
      ],
    },
    { id: "3", time: "Nov 8, 2026 · 9:15 AM", title: "Payment recorded · £1,200.00", actor: MOSES },
    { id: "4", time: "Nov 1, 2026 · 9:00 AM", title: "Invoice sent to accounts@ajank.co.uk", actor: { kind: "system" } },
    { id: "5", time: "Oct 24, 2026 · 2:18 PM", title: "Recurring invoices set up for AJANK PLC", actor: WEMIMO },
  ];
  return (
    <Section id="timeline" title="Activity record" intro="Every change, who made it and why. An agent's action expands to show who started it, who approved it, how it connected and the result.">
      <div className="max-w-[620px]">
        <Timeline events={events} />
      </div>
    </Section>
  );
}

function PaperDemo() {
  const [tpl, setTpl] = useState<Template>("stacked");
  const [brand, setBrand] = useState(BRAND_COLOURS[0]);
  const [cur, setCur] = useState<Currency>("USD");
  const customer = CUSTOMERS.find((c) => c.currency === cur) ?? CUSTOMERS[0];
  const account = ACCOUNTS.find((a) => a.currency === cur) ?? ACCOUNTS[0];
  const rate = { USD: 1, GBP: 0.79, EUR: 0.93, NGN: 1540 }[cur];
  const invoice: PaperInvoice = {
    number: "INV-0145",
    issued: "Nov 13, 2026",
    due: "Nov 27, 2026",
    currency: cur,
    customer,
    items: [
      { description: "Monthly retainer · December", quantity: 1, price: 2800 * rate },
      { description: "Social media templates (set of 12)", quantity: 1, price: 450 * rate },
    ],
    vatRate: 0.075,
    note: "Thanks for a great quarter. Please use the invoice number as your payment reference.",
  };
  function change<T>(set: (v: T) => void, v: T) {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(() => flushSync(() => set(v)));
    else set(v);
  }
  return (
    <Section id="paper" title="Invoice designs" intro="Four designs, one renderer: the preview, the PDF and the customer's page are identical. Every design prints the bank details for the invoice's currency.">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-xl bg-surface-2 p-6 lg:p-8">
          <InvoicePaper invoice={invoice} business={BUSINESS} account={account} template={tpl} brand={brand} fontSize={9.4} />
        </div>
        <div className="grid content-start gap-6">
          <div className="grid gap-2">
            <span className="iv-label">Design</span>
            <TemplatePicker value={tpl} onChange={(t) => change(setTpl, t)} brand={brand} />
          </div>
          <div className="grid gap-2">
            <span className="iv-label">Colour</span>
            <ColourSwatches colours={BRAND_COLOURS} value={brand} onChange={setBrand} />
          </div>
          <div className="grid gap-2">
            <span className="iv-label">Customer currency</span>
            <Segmented label="Customer currency" value={cur} onChange={(c) => change(setCur, c)} options={(["USD", "GBP", "EUR", "NGN"] as Currency[]).map((c) => ({ value: c, label: c }))} />
            <span className="iv-hint">Switching currency picks the matching bank account: {account.bank}.</span>
          </div>
        </div>
      </div>
    </Section>
  );
}
