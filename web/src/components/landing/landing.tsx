"use client";

/*
 * InVin landing page.
 * Kind: software (page-type software, site-kind software).
 * Deal: hero triptych · type IBM Plex (the app's own) · palette: InVin's own ink, paper and tangerine
 * · nav-split (nav-cards dealt, no photographs to put in it) · footer-columns · close-type · rhythm dark-band
 * · buttons tonal · the one effect: a seeded line field behind the designs gallery (drawn once, still).
 * Sections: hero (1) · product, the app window (1) · features, three cards (1) · designs, dark band (1)
 * · steps (1) · faq (1) · footer.closing (1).
 */

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { InVinMark } from "@/components/brand/mark";
import { InvoicePaper, TEMPLATES, type PaperInvoice, type Template } from "@/components/invoice/paper";
import { StatusPill, type Status } from "@/components/invoice/status";
import { Avatar } from "@/components/ui/identity";
import { Icon, type IconName } from "@/components/ui/icon";
import type { BankAccount, Business } from "@/lib/sample";

/* ---------- sample data (coined names, .example addresses) ---------- */
const BIZ: Business = { name: "Ada Obi Studio", mark: "AO", address: "Admiralty Way, Lekki, Lagos", email: "studio@adaobi.example" };
const GBP: BankAccount = { id: "gbp", currency: "GBP", bank: "Wise · UK account", rows: [["Account name", "Ada Obi Studio"], ["Account number", "41286650"], ["Sort code", "23-14-70"]] };
const USD: BankAccount = { id: "usd", currency: "USD", bank: "Wise · US account", rows: [["Account name", "Ada Obi Studio"], ["Account number", "8310004721"], ["Routing (ACH)", "026073008"]] };
const EUR: BankAccount = { id: "eur", currency: "EUR", bank: "Wise · EU account", rows: [["Account name", "Ada Obi Studio"], ["IBAN", "BE68 9672 0001 2345"]] };

const INV_A: PaperInvoice = {
  number: "INV-0145", issued: "Nov 13, 2026", due: "Nov 27, 2026", currency: "GBP",
  customer: { name: "Northstar Advisory", email: "finance@northstar.example", address: "Shoreditch, London", currency: "GBP" },
  items: [{ description: "Brand identity, phase 2", quantity: 1, price: 1350 }, { description: "File export and handover", quantity: 5, price: 90 }],
};
const INV_B: PaperInvoice = {
  number: "INV-0146", issued: "Nov 14, 2026", due: "Nov 28, 2026", currency: "USD",
  customer: { name: "Halden Labs", email: "billing@halden.example", address: "Mission District, San Francisco", currency: "USD" },
  items: [{ description: "Monthly retainer · December", quantity: 1, price: 2800 }, { description: "Social media templates", quantity: 1, price: 450 }],
};
const INV_C: PaperInvoice = {
  number: "INV-0147", issued: "Nov 14, 2026", due: "Dec 12, 2026", currency: "EUR",
  customer: { name: "Bloom & Vale", email: "hello@bloomvale.example", address: "Prenzlauer Berg, Berlin", currency: "EUR" },
  items: [{ description: "Product photography, 2 days", quantity: 2, price: 680 }, { description: "Retouching", quantity: 24, price: 18 }],
};

const BRANDS = ["#0E5A52", "#1A1916", "#2453B8", "#B93A0B", "#7A4E2D"];

/* ---------- small pieces ---------- */
const MAIN = "Create your account";

function MainButton({ big, className = "" }: { big?: boolean; className?: string }) {
  return (
    <Link href="/sign-in" className={`lp-btn lp-btn--primary ${big ? "lp-btn--big" : ""} ${className}`}>
      {MAIN}
      <span className="lp-btn-arrow"><Icon name="chevron" size={16} /></span>
    </Link>
  );
}

function Note({ icon, tone, title, sub }: { icon: IconName; tone: "paid" | "viewed" | "sent" | "brand"; title: ReactNode; sub: string }) {
  return (
    <div className="lp-note" data-tone={tone}>
      <span className="lp-note-ic"><Icon name={icon} size={15} /></span>
      <span><b>{title}</b><small>{sub}</small></span>
    </div>
  );
}

/* ---------- hero: the triptych collage, three sets crossfading every 2.8 s ---------- */
const SETS: { paper: { inv: PaperInvoice; acc: BankAccount; tpl: Template; brand: string }; notes: ReactNode[] }[] = [
  {
    paper: { inv: INV_A, acc: GBP, tpl: "stacked", brand: "#0E5A52" },
    notes: [
      <Note key="a" icon="eye" tone="viewed" title="Northstar opened INV-0145" sub="2 minutes ago" />,
      <Note key="m" icon="bell" tone="brand" title="Reminder set for Nov 24" sub="3 days before it's due" />,
      <Note key="b" icon="cash" tone="paid" title="Paid · £1,800.00" sub="Receipt sent to Northstar" />,
    ],
  },
  {
    paper: { inv: INV_B, acc: USD, tpl: "editorial", brand: "#B93A0B" },
    notes: [
      <Note key="a" icon="bell" tone="brand" title="Reminder sent to Halden Labs" sub="3 days before it's due" />,
      <Note key="m" icon="eye" tone="viewed" title="Halden Labs opened INV-0146" sub="Yesterday at 16:20" />,
      <Note key="b" icon="repeat" tone="sent" title="Next retainer invoice" sub="Made and sent on Dec 1" />,
    ],
  },
  {
    paper: { inv: INV_C, acc: EUR, tpl: "soft", brand: "#2453B8" },
    notes: [
      <Note key="a" icon="send" tone="sent" title="INV-0147 sent to Bloom & Vale" sub="PDF attached · €1,792.00" />,
      <Note key="m" icon="clock" tone="viewed" title="Due in 28 days" sub="Dec 12, 2026" />,
      <Note key="b" icon="check" tone="paid" title="Estimate EST-0012 accepted" sub="Turned into an invoice" />,
    ],
  },
];

function Collage() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (paused || still) return;
    const t = setInterval(() => setI((n) => (n + 1) % SETS.length), 2800);
    return () => clearInterval(t);
  }, [paused, still]);
  return (
    <div className="lp-collage" aria-label="Invoices made with InVin, and what happens after they're sent" role="img">
      {SETS.map((set, k) => (
        <div key={k} className="lp-set" data-on={k === i || undefined} aria-hidden={k !== i}>
          <div className="lp-set-paper">
            <InvoicePaper invoice={set.paper.inv} business={BIZ} account={set.paper.acc} template={set.paper.tpl} brand={set.paper.brand} />
          </div>
          <div className="lp-set-notes">{set.notes}</div>
        </div>
      ))}
      <button type="button" className="lp-pause" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play the examples" : "Pause the examples"} aria-pressed={paused}>
        {paused ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7-4.5z" fill="currentColor" /></svg> : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5h2v9H5zM9 3.5h2v9H9z" fill="currentColor" /></svg>}
      </button>
    </div>
  );
}

/* ---------- product: the app window ---------- */
const ROWS: { who: string; no: string; status: Status; label?: string; amount: string; due: string }[] = [
  { who: "Northstar Advisory", no: "INV-0145", status: "viewed", amount: "£1,800.00", due: "Nov 27" },
  { who: "Halden Labs", no: "INV-0146", status: "overdue", label: "3 days late", amount: "$3,493.75", due: "Nov 11" },
  { who: "Bloom & Vale", no: "INV-0147", status: "sent", amount: "€1,792.00", due: "Dec 12" },
  { who: "Kora Foods", no: "INV-0144", status: "partial", amount: "₦850,000.00", due: "Nov 30" },
  { who: "Fieldnote Press", no: "INV-0143", status: "paid", amount: "$1,250.00", due: "Nov 9" },
];

function AppWindow() {
  return (
    <div className="lp-app" aria-label="The InVin invoices screen" role="img">
      <div className="lp-app-bar"><i /><i /><i /><span>invin.app/invoices</span></div>
      <div className="lp-app-body">
        <aside className="lp-app-side" aria-hidden="true">
          <div className="lp-app-ws"><span className="lp-app-mk">AO</span>Ada Obi Studio</div>
          <span className="lp-app-new"><Icon name="plus" size={14} />New invoice</span>
          {(["home", "file", "clipboard", "repeat", "cash", "chart", "users"] as IconName[]).map((ic, k) => (
            <span key={ic} className="lp-app-ni" data-on={k === 1 || undefined}><Icon name={ic} size={15} />{["Home", "Invoices", "Estimates", "Recurring", "Payments", "Reports", "Customers"][k]}</span>
          ))}
        </aside>
        <div className="lp-app-main">
          <div className="lp-app-head">
            <b>Invoices</b>
            <span className="lp-app-sum"><span>Owed to you <b>$8,940.15</b></span><span className="late">Overdue <b>$3,493.75</b></span><span>Paid this month <b>$4,210.00</b></span></span>
          </div>
          <table className="lp-tbl">
            <thead><tr><th>Customer</th><th>Status</th><th>Due</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {ROWS.map((r, k) => (
                <tr key={r.no} data-on={k === 1 || undefined}>
                  <td><span className="cust"><Avatar name={r.who} size="md" /><span><b>{r.who}</b><small>{r.no}</small></span></span></td>
                  <td><StatusPill status={r.status} label={r.label} /></td>
                  <td className="lp-muted">{r.due}</td>
                  <td className="r"><b className="iv-num">{r.amount}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="lp-app-sheet">
          <div className="lp-sheet-top"><span className="iv-mono">INV-0146</span><StatusPill status="overdue" label="3 days late" /></div>
          <div className="lp-sheet-who"><Avatar name="Halden Labs" size="md" /><span><b>Halden Labs</b><small>billing@halden.example</small></span></div>
          <div className="lp-sheet-amt iv-num">$3,493.75</div>
          <div className="lp-sheet-bar"><i style={{ width: "0%" }} /></div>
          <div className="lp-sheet-acts">
            <span className="lp-chip lp-chip--dark"><Icon name="cash" size={14} />Record payment</span>
            <span className="lp-chip"><Icon name="bell" size={14} />Send reminder</span>
          </div>
          <ul className="lp-sheet-log">
            <li><Icon name="bell" size={13} />Reminder sent · 3 days late</li>
            <li><Icon name="eye" size={13} />Opened by Halden Labs · Nov 15</li>
            <li><Icon name="send" size={13} />Sent with PDF · Nov 14</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------- features: three cards with live fragments ---------- */
function ReminderFragment() {
  const steps = ["3 days before", "On the day", "3 days late", "7 days late", "14 days late"];
  return (
    <div className="lp-frag lp-frag--rem" aria-hidden="true">
      <div className="lp-frag-row"><span className="lp-frag-k">INV-0146 · Halden Labs</span><StatusPill status="overdue" label="3 days late" /></div>
      <ol className="lp-rem">
        {steps.map((s, k) => (
          <li key={s} style={{ ["--k" as string]: k } as CSSProperties} data-done={k < 3 || undefined}>
            <span className="lp-rem-dot"><Icon name="check" size={11} /></span>{s}
          </li>
        ))}
      </ol>
      <p className="lp-frag-foot">Stops as soon as it&apos;s paid</p>
    </div>
  );
}

function ReceiptFragment() {
  return (
    <div className="lp-frag lp-frag--mail" aria-hidden="true">
      <div className="lp-mail-head"><span className="lp-mail-from">Ada Obi Studio</span><small>to finance@northstar.example</small></div>
      <div className="lp-mail-band">Receipt for INV-0145</div>
      <div className="lp-mail-body">
        <div><small>Paid</small><b className="iv-num">£1,800.00</b></div>
        <div><small>Method</small><b>Bank transfer</b></div>
        <div><small>Left to pay</small><b className="iv-num">£0.00</b></div>
      </div>
      <span className="lp-chip"><Icon name="file" size={13} />Receipt PDF</span>
    </div>
  );
}

function RecurringFragment() {
  const runs = [["Dec 1", "INV-0151", "sent"], ["Jan 1", "Next", "upcoming"], ["Feb 1", "", "upcoming"]] as const;
  return (
    <div className="lp-frag lp-frag--rec" aria-hidden="true">
      <div className="lp-frag-row"><span className="lp-frag-k"><Icon name="repeat" size={14} />Monthly retainer · Halden Labs</span><b className="iv-num">$2,800.00</b></div>
      <ul className="lp-runs">
        {runs.map(([d, n, st]) => (
          <li key={d}><span className="lp-runs-d">{d}</span><span className="lp-muted">{n}</span><StatusPill status={st as Status} label={st === "upcoming" ? "Scheduled" : "Sent"} /></li>
        ))}
      </ul>
      <p className="lp-frag-foot">Sent for you, or saved as a draft</p>
    </div>
  );
}

/* ---------- designs: the one effect, a seeded line field drawn once ---------- */
function LineField({ seed, colour }: { seed: number; colour: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth, h = c.clientHeight;
      if (!w || !h) return;
      c.width = w * dpr;
      c.height = h * dpr;
      const g = c.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      // Seeded random (mulberry32) so a design always draws the same field
      let a = seed >>> 0;
      const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const f1 = 0.0016 + rnd() * 0.0016, f2 = 0.003 + rnd() * 0.003, ph = rnd() * 6.28;
      const angle = (x: number, y: number) => Math.sin(x * f1 + ph) * 1.6 + Math.cos(y * f2 - ph * 0.7) * 1.2 + Math.sin((x + y) * f1 * 0.6) * 0.8;
      const lines = Math.round((w * h) / 2600);
      g.lineCap = "round";
      for (let n = 0; n < lines; n++) {
        let x = rnd() * w, y = rnd() * h;
        const tint = rnd() < 0.14;
        g.strokeStyle = tint ? colour : "rgba(255,255,255,0.9)";
        g.globalAlpha = tint ? 0.55 : 0.05 + rnd() * 0.07;
        g.lineWidth = tint ? 1.1 : 0.8;
        g.beginPath();
        g.moveTo(x, y);
        const len = 30 + rnd() * 90;
        for (let s = 0; s < len; s++) {
          const ang = angle(x, y);
          x += Math.cos(ang) * 2;
          y += Math.sin(ang) * 2;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [seed, colour]);
  return <canvas ref={ref} className="lp-field" aria-hidden="true" />;
}

function Designs() {
  const [tpl, setTpl] = useState<Template>("editorial");
  const [brand, setBrand] = useState(BRANDS[0]);
  const seed = TEMPLATES.findIndex((t) => t.value === tpl) * 7919 + BRANDS.indexOf(brand) * 104729 + 17;
  return (
    <section className="lp-sec lp-dark" id="designs">
      <LineField seed={seed} colour={brand === "#1A1916" ? "#FF5A1F" : brand} />
      <div className="wrap lp-split">
        <div className="lp-split-text">
          <h2>Nine invoice designs in your colours</h2>
          <p className="lp-lead">Pick a design and a colour once, or change them on any invoice. The email, the customer&apos;s page and the PDF all match.</p>
          <div className="lp-picks" role="radiogroup" aria-label="Invoice design">
            {TEMPLATES.map((t) => (
              <button key={t.value} type="button" role="radio" aria-checked={t.value === tpl} onClick={() => setTpl(t.value)}>{t.label}</button>
            ))}
          </div>
          <div className="lp-swatches" role="radiogroup" aria-label="Invoice colour">
            {BRANDS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={c === brand} aria-label={`Colour ${c}`} style={{ background: c }} onClick={() => setBrand(c)} />
            ))}
          </div>
        </div>
        <div className="lp-design-paper">
          <InvoicePaper invoice={INV_A} business={BIZ} account={GBP} template={tpl} brand={brand} />
        </div>
      </div>
    </section>
  );
}

/* ---------- steps ---------- */
function StepCustomer() {
  return (
    <div className="lp-frag" aria-hidden="true">
      <div className="lp-field-l"><small>Name</small><span>Bloom &amp; Vale</span></div>
      <div className="lp-field-l"><small>Billing email</small><span>hello@bloomvale.example</span></div>
      <div className="lp-seg"><span>USD</span><span>GBP</span><span data-on>EUR</span><span>NGN</span></div>
      <div className="lp-seg"><span>On receipt</span><span>7 days</span><span data-on>14 days</span><span>30 days</span></div>
    </div>
  );
}
function StepSend() {
  return (
    <div className="lp-frag" aria-hidden="true">
      <div className="lp-field-l"><small>To</small><span>hello@bloomvale.example</span></div>
      <div className="lp-field-l"><small>Subject</small><span>Invoice INV-0147</span></div>
      <div className="lp-toggle"><i />Attach the invoice as a PDF</div>
      <span className="lp-chip lp-chip--dark lp-chip--wide"><Icon name="send" size={14} />Send invoice</span>
    </div>
  );
}
function StepPaid() {
  return (
    <div className="lp-frag" aria-hidden="true">
      <div className="lp-frag-row"><span className="lp-frag-k">INV-0147</span><StatusPill status="paid" /></div>
      <div className="lp-sheet-amt iv-num">€1,792.00</div>
      <div className="lp-sheet-bar"><i style={{ width: "100%" }} /></div>
      <p className="lp-frag-foot">Paid in full · Nov 21 · Bank transfer</p>
      <Note icon="mail" tone="paid" title="Receipt goes out in a minute" sub="Undo if you made a mistake" />
    </div>
  );
}

/* ---------- questions ---------- */
const FAQ: [string, string][] = [
  ["Who is InVin for?", "Creators, freelancers and small studios who bill clients and get paid by bank transfer. Invite teammates as admins or members when you grow."],
  ["Which currencies can I bill in?", "US dollars, British pounds, euros and Nigerian naira. Each customer has their own currency, and reports show totals per currency."],
  ["How do my customers pay?", "Each invoice has its own page with your bank details. Customers open it from the email, with no account to make, and can tell you they've paid."],
  ["Do I have to chase late payments?", "No. Turn on reminders in Settings and choose when they go: before the due date, on the day, or after. They stop when the invoice is paid."],
  ["Can emails come from my own address?", "Yes. Add your domain in Settings and copy the DNS records it shows. Once it's verified, invoices come from an address like invoices@yourstudio.com."],
  ["Does it work on my phone?", "Yes. InVin works in any browser, so you can send an invoice or record a payment from your phone."],
];

/* ---------- the page ---------- */
export function Landing() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="lp" id="top">
      <header className="lp-nav">
        <div className="wrap lp-nav-in">
          <nav className="lp-nav-links" aria-label="Sections">
            <a href="#features">Features</a>
            <a href="#designs">Designs</a>
            <a href="#steps">How it works</a>
            <a href="#faq">Questions</a>
          </nav>
          <a href="#top" className="lp-brand" aria-label="InVin, back to the top"><InVinMark size={26} />InVin</a>
          <div className="lp-nav-acts">
            <Link href="/sign-in" className="lp-link">Sign in</Link>
            <MainButton />
            <button type="button" className="lp-menu-btn" aria-expanded={menu} aria-controls="lp-menu" onClick={() => setMenu((m) => !m)} aria-label={menu ? "Close the menu" : "Open the menu"}>
              <span /><span />
            </button>
          </div>
        </div>
        <div className="lp-menu" id="lp-menu" data-open={menu || undefined}>
          <a href="#features" onClick={() => setMenu(false)}>Features</a>
          <a href="#designs" onClick={() => setMenu(false)}>Designs</a>
          <a href="#steps" onClick={() => setMenu(false)}>How it works</a>
          <a href="#faq" onClick={() => setMenu(false)}>Questions</a>
          <Link href="/sign-in">Sign in</Link>
        </div>
      </header>

      <main>
        <section className="lp-sec lp-hero">
          <div className="wrap lp-tri">
            <div className="lp-tri-text">
              <h1>Invoicing app for freelancers</h1>
              <p className="lp-hero-lead">For creators, freelancers and small studios. 9 invoice designs, 4 currencies, and reminders and receipts that send themselves.</p>
            </div>
            <Collage />
            <div className="lp-tri-act"><MainButton big /></div>
          </div>
        </section>

        <section className="lp-sec" id="product">
          <div className="wrap">
            <h2>Every invoice and payment on one screen</h2>
            <p className="lp-lead">See what you&apos;re owed, what&apos;s late and who opened your invoice. Open any invoice to record a payment or send a reminder.</p>
            <AppWindow />
          </div>
        </section>

        <section className="lp-sec lp-surface" id="features">
          <div className="wrap">
            <h2>Reminders, receipts and repeat invoices</h2>
            <p className="lp-lead">Set them up once in Settings. InVin sends each email at the right time and stops when the invoice is paid.</p>
            <div className="lp-cards">
              <article className="lp-card"><div className="lp-card-panel"><ReminderFragment /></div><h3>Reminds customers who haven&apos;t paid</h3><p>Polite emails before and after the due date, once per invoice.</p></article>
              <article className="lp-card"><div className="lp-card-panel"><ReceiptFragment /></div><h3>Sends a receipt when you&apos;re paid</h3><p>Record a payment and your customer gets a receipt with the PDF a minute later.</p></article>
              <article className="lp-card"><div className="lp-card-panel"><RecurringFragment /></div><h3>Makes retainer invoices on schedule</h3><p>Weekly, monthly, quarterly or yearly, sent for you or saved as a draft.</p></article>
            </div>
          </div>
        </section>

        <Designs />

        <section className="lp-sec" id="steps">
          <div className="wrap">
            <h2>From new customer to paid in three steps</h2>
            <p className="lp-lead">Add a customer once. Their currency and payment terms fill in on every invoice you send them.</p>
            <ol className="lp-steps">
              <li><div className="lp-card-panel"><StepCustomer /></div><h3><span className="lp-step-n">1</span>Add a customer</h3><p>Name, email, currency and how long they have to pay.</p></li>
              <li><div className="lp-card-panel"><StepSend /></div><h3><span className="lp-step-n">2</span>Send the invoice</h3><p>Pick the items, check the preview and send it with the PDF.</p></li>
              <li><div className="lp-card-panel"><StepPaid /></div><h3><span className="lp-step-n">3</span>Record the payment</h3><p>When the money arrives, mark it paid. The receipt goes out for you.</p></li>
            </ol>
          </div>
        </section>

        <section className="lp-sec lp-surface" id="faq">
          <div className="wrap lp-split lp-split--faq">
            <div className="lp-split-text">
              <h2>Questions about InVin</h2>
              <p className="lp-lead">Short answers to what people ask before they send their first invoice.</p>
            </div>
            <div className="lp-faq">
              {FAQ.map(([q, a], k) => (
                <details key={q} name="faq" open={k === 0}>
                  <summary>{q}<Icon name="plus" size={16} /></summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-sec lp-closing closing" id="contact">
        <div className="wrap lp-closing-in">
          <div className="lp-close">
            <h2>Send your first invoice today</h2>
            <p className="lp-lead">Sign in with your email and a 6-digit code. No password, and set-up takes about a minute.</p>
            <MainButton big className="lp-btn--wide" />
          </div>
          <div className="lp-foot">
            <div className="lp-foot-cols">
              <div><a href="#top" className="lp-brand"><InVinMark size={22} />InVin</a><p className="lp-muted">Invoicing for creators, freelancers and small studios.</p></div>
              <div><b>Product</b><a href="#product">Invoices screen</a><a href="#features">Features</a><a href="#designs">Designs</a></div>
              <div><b>Learn</b><a href="#steps">How it works</a><a href="#faq">Questions</a></div>
              <div><b>Account</b><Link href="/sign-in">Sign in</Link></div>
            </div>
            <div className="lp-legal"><span>© 2026 InVin</span></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
