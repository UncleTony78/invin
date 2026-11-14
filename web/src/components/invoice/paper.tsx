"use client";

import type { CSSProperties, ReactNode } from "react";
import { formatMoney, type Currency } from "@/lib/format";
import type { BankAccount, Business, Customer, LineItem } from "@/lib/sample";

export type Template = "minimal" | "classic" | "stacked" | "bold" | "editorial" | "ledger" | "sidebar" | "swiss" | "soft";
export const TEMPLATES: { value: Template; label: string }[] = [
  { value: "stacked", label: "Stacked" },
  { value: "minimal", label: "Minimal" },
  { value: "classic", label: "Classic" },
  { value: "bold", label: "Bold" },
  { value: "editorial", label: "Editorial" },
  { value: "ledger", label: "Ledger" },
  { value: "sidebar", label: "Sidebar" },
  { value: "swiss", label: "Swiss" },
  { value: "soft", label: "Soft" },
];

export type PaperInvoice = {
  number: string;
  issued: string;
  due: string;
  currency: Currency;
  customer: Customer;
  items: LineItem[];
  vatRate?: number;
  paid?: number;
  note?: string;
  /** Paid in full or cancelled: no "amount due", no payment box */
  settled?: "paid" | "cancelled";
  /** Custom fields the business chose to print, e.g. ["PO number", "4471"] */
  fields?: [string, string][];
  /** An estimate: "Estimate" wording, "Valid until" instead of due, and no payment box */
  doc?: "invoice" | "estimate";
};

/**
 * One renderer for the editor preview, the sheet, the PDF and the customer's page,
 * so what you see is what they get. Every design prints the bank details.
 */
export function InvoicePaper({
  invoice,
  business,
  account,
  template,
  brand,
  fontSize = 10,
  stamp,
}: {
  invoice: PaperInvoice;
  business: Business;
  account: BankAccount;
  template: Template;
  brand: string;
  fontSize?: number;
  stamp?: { kind: "paid" | "cancelled"; press?: boolean };
}) {
  const m = (v: number) => formatMoney(v, invoice.currency);
  const sub = invoice.items.reduce((s, l) => s + l.quantity * l.price, 0);
  const vat = invoice.vatRate ? sub * invoice.vatRate : 0;
  const total = sub + vat;
  const due = total - (invoice.paid ?? 0);
  const c = invoice.customer;
  const estimate = invoice.doc === "estimate";
  // Estimates never show how to pay: nothing is owed until it becomes an invoice
  const settled = invoice.settled ?? (estimate ? ("paid" as const) : undefined);
  const word = estimate ? "Estimate" : "Invoice";
  const dueWord = estimate ? `Valid until ${invoice.due}` : settled === "paid" ? "Paid in full" : settled === "cancelled" ? "Cancelled" : null;
  // "On receipt" reads as a phrase, not a date: "Due on receipt", never "due by On receipt"
  const onReceipt = /receipt/i.test(invoice.due);
  const dueBy = onReceipt ? "Due on receipt" : `Amount due by ${invoice.due}`;
  // Very long totals step the hero figure down so it never runs off the page
  const heroLen = m(settled ? total : due).length;
  const heroSize = heroLen > 22 ? "xl" : heroLen > 16 ? "l" : undefined;

  const items = (
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th className="r" style={{ width: "10%" }}>Qty</th>
          <th className="r" style={{ width: "20%" }}>Price</th>
          <th className="r" style={{ width: "20%" }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {invoice.items.map((l, i) => (
          <tr key={i}>
            <td>{l.description || <span className="muted">Item description</span>}</td>
            <td className="r">{l.quantity}</td>
            <td className="r iv-num">{m(l.price)}</td>
            <td className="r iv-num">{m(l.quantity * l.price)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const totals = (
    <div className="tot">
      <div><span>Subtotal</span><span className="iv-num">{m(sub)}</span></div>
      {vat > 0 && <div><span>VAT {Math.round((invoice.vatRate ?? 0) * 1000) / 10}%</span><span className="iv-num">{m(vat)}</span></div>}
      {!!invoice.paid && <div><span>Paid</span><span className="iv-num">−{m(invoice.paid)}</span></div>}
      <div className="t"><span>{invoice.paid ? "Left to pay" : "Total"}</span><span className="iv-num">{m(due)}</span></div>
    </div>
  );
  const bank = (
    <>
      <dl className="bank">
        <dt>Bank</dt>
        <dd className="sans">{account.bank}</dd>
        {account.rows.map(([k, v]) => (
          <Row key={k} k={k} v={v} />
        ))}
      </dl>
      <p className="ref">Use <b>{invoice.number}</b> as the payment reference.</p>
    </>
  );
  const billTo = (
    <>
      <b style={{ fontWeight: 600 }}>{c.name}</b>
      <br />
      {c.address && <>{c.address}<br /></>}
      {c.email}
    </>
  );
  const from = (
    <>
      {business.address}
      <br />
      {business.email}
    </>
  );
  const note = invoice.note || "Thank you for your business.";
  const extra = invoice.fields?.length ? (
    <dl className="xf">
      {invoice.fields.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  ) : null;
  const mark = <span className="mk">{business.mark}</span>;

  let body: ReactNode = null;
  if (template === "minimal")
    body = (
      <div className="pad">
        <div className="ptop">
          <div className="biz">{mark}{business.name}</div>
          <div className="ttl">{word}<br /><span className="iv-mono">{invoice.number}</span></div>
        </div>
        <div className="meta">
          <div><small className="l">Bill to</small>{billTo}{extra}</div>
          <div><small className="l">Issued</small>{invoice.issued}<br /><br /><small className="l">{estimate ? "Valid until" : "Due"}</small>{invoice.due}</div>
          <div><small className="l">{estimate ? "Total" : dueWord ?? "Amount due"}</small><div className="due iv-num">{m(settled ? total : due)}</div></div>
        </div>
        {items}
        {totals}
        <div className="payb">
          {settled ? <div /> : <div><small className="l">How to pay</small>{bank}</div>}
          <div><small className="l">Note</small>{note}<br /><br /><small className="l">From</small>{from}</div>
        </div>
      </div>
    );
  if (template === "classic")
    body = (
      <div className="pad">
        <div className="head">
          <div className="biz">{mark}<div><b>{business.name}</b><span>{from}</span></div></div>
          <div><div className="word">{word.toUpperCase()}</div><div>{invoice.number}</div></div>
        </div>
        <div className="meta">
          <div><small className="l">Bill to</small>{billTo}{extra}</div>
          <div><small className="l">Invoice date</small>{invoice.issued}</div>
          <div><small className="l">{estimate ? "Valid until" : "Due date"}</small>{invoice.due}</div>
        </div>
        {items}
        {totals}
        <div className="foot">
          {settled ? <div /> : <div><b>Payment details</b>{bank}</div>}
          <div><b>Note</b>{note}</div>
        </div>
      </div>
    );
  if (template === "stacked")
    body = (
      <div className="pad">
        <div className="band">
          <div>
            <div className="biz">{mark}{business.name}</div>
            <div className="ttl">{word} {invoice.number} · issued {invoice.issued}</div>
          </div>
          <div className="big iv-num"><small>{dueWord ?? dueBy}</small>{m(settled ? total : due)}</div>
        </div>
        <div className="rows">
          <div className="rw"><small className="l">Billed to</small><div>{billTo}{extra}</div></div>
          <div className="rw"><small className="l">Items</small><div>{items}{totals}</div></div>
          {!settled && <div className="rw"><small className="l">How to pay</small><div className="paycard">{bank}</div></div>}
          <div className="rw"><small className="l">From</small><div>{business.name}<br />{from}<br /><br /><span className="muted">{note}</span></div></div>
        </div>
      </div>
    );
  if (template === "bold")
    body = (
      <div className="pad">
        <div className="ptop">
          <div className="biz">{mark}{business.name}</div>
          <div style={{ textAlign: "right", color: "#5F5D58" }}>{word}<br /><span className="iv-mono">{invoice.number}</span></div>
        </div>
        <div className="huge iv-num">{m(settled ? total : due)}</div>
        <p>{estimate ? `Valid until ${invoice.due}` : dueWord ? dueWord.toLowerCase() : onReceipt ? "due on receipt" : `due by ${invoice.due}`} · issued {invoice.issued}</p>
        <div className="meta">
          <div><small className="l">Bill to</small>{billTo}{extra}</div>
          <div><small className="l">From</small>{business.name}<br />{from}</div>
          <div><small className="l">Note</small>{note}</div>
        </div>
        {items}
        {totals}
        <div className="payb">
          {!settled && <div><small className="l">How to pay</small><span className="muted">Bank transfer. Please use the invoice number as the reference.</span></div>}
          {!settled && <div className="bankcard">{bank}</div>}
        </div>
      </div>
    );

  const hero = m(settled ? total : due);
  const heroLabel = estimate ? "Estimate total" : dueWord ?? "Amount due";
  const dueLine = estimate ? `Valid until ${invoice.due}` : dueWord ?? (onReceipt ? "Due on receipt" : `Due ${invoice.due}`);
  const issuedLabel = estimate ? "Date" : "Issued";
  const dueLabel = estimate ? "Valid until" : "Due";

  if (template === "editorial")
    body = (
      <div className="pad">
        <div className="e-top">
          <div className="biz">{mark}{business.name}</div>
          <div className="e-no">No. <span className="iv-mono">{invoice.number}</span></div>
        </div>
        <div className="e-word">{word}<span>.</span></div>
        <div className="e-meta">
          <div><small className="l">Billed to</small>{billTo}{extra}</div>
          <div><small className="l">From</small>{business.name}<br />{from}</div>
          <div><small className="l">{issuedLabel}</small>{invoice.issued}<small className="l e-gap">{dueLabel}</small>{invoice.due}</div>
          <div className="e-amt"><small className="l">{heroLabel}</small><span className="amt iv-num">{hero}</span></div>
        </div>
        {items}
        {totals}
        <div className="e-foot">
          {settled ? <div /> : <div><small className="l">How to pay</small>{bank}</div>}
          <p className="e-note">{note}</p>
        </div>
      </div>
    );
  if (template === "ledger")
    body = (
      <div className="pad">
        <div className="g-head">
          <div><div className="biz">{mark}{business.name}</div><div className="g-from">{from}</div></div>
          <div className="g-doc"><b>{word.toUpperCase()}</b><span>{invoice.number}</span></div>
        </div>
        <div className="g-cut" aria-hidden="true" />
        <dl className="g-kv">
          <div><dt>Billed to</dt><dd>{billTo}{extra}</dd></div>
          <div><dt>{issuedLabel}</dt><dd>{invoice.issued}</dd></div>
          <div><dt>{dueLabel}</dt><dd>{invoice.due}</dd></div>
          <div><dt>{heroLabel}</dt><dd className="amt iv-num">{hero}</dd></div>
        </dl>
        <table>
          <thead><tr><th style={{ width: "7%" }}>#</th><th>Item</th><th className="r" style={{ width: "9%" }}>Qty</th><th className="r" style={{ width: "19%" }}>Price</th><th className="r" style={{ width: "19%" }}>Total</th></tr></thead>
          <tbody>
            {invoice.items.map((l, i) => (
              <tr key={i}>
                <td className="g-i">{String(i + 1).padStart(2, "0")}</td>
                <td>{l.description || <span className="muted">Item description</span>}</td>
                <td className="r">{l.quantity}</td>
                <td className="r iv-num">{m(l.price)}</td>
                <td className="r iv-num">{m(l.quantity * l.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totals}
        <div className="g-foot">
          {settled ? <div /> : <div className="g-pay"><small className="l">Pay to</small>{bank}</div>}
          <div className="g-end"><p>{note}</p><Barcode value={invoice.number} /></div>
        </div>
      </div>
    );
  if (template === "sidebar")
    body = (
      <div className="pad">
        <aside className="s-side">
          <div className="biz">{mark}{business.name}</div>
          <div className="s-doc"><span>{word}</span><b className="iv-mono">{invoice.number}</b></div>
          <div><small className="l">Billed to</small>{billTo}{extra}</div>
          <div className="s-dates"><div><small className="l">{issuedLabel}</small>{invoice.issued}</div><div><small className="l">{dueLabel}</small>{invoice.due}</div></div>
          {!settled && <div className="s-bank"><small className="l">How to pay</small>{bank}</div>}
          <div className="s-from"><small className="l">From</small>{from}</div>
        </aside>
        <div className="s-main">
          <small className="l">{heroLabel}</small>
          <div className="amt iv-num">{hero}</div>
          {!settled || estimate ? <p className="s-due">{dueLine}</p> : null}
          {items}
          {totals}
          <p className="s-note">{note}</p>
        </div>
      </div>
    );
  if (template === "swiss")
    body = (
      <div className="pad">
        <div className="w-top">
          <div className="w-word">{word}</div>
          <div className="w-id"><div className="biz">{business.name}{mark}</div><span className="iv-mono">{invoice.number}</span></div>
        </div>
        <div className="w-grid">
          <section><small className="w-n">01</small><small className="l">Billed to</small>{billTo}{extra}</section>
          <section><small className="w-n">02</small><small className="l">Dates</small>{issuedLabel} {invoice.issued}<br />{dueLabel} {invoice.due}</section>
          <section className="w-amt"><small className="w-n">03</small><small className="l">{heroLabel}</small><span className="amt iv-num">{hero}</span></section>
        </div>
        <div className="w-sec"><small className="w-n">04</small><small className="l">Items</small></div>
        {items}
        {totals}
        <div className="w-foot">
          {settled ? <div /> : <section><small className="w-n">05</small><small className="l">How to pay</small>{bank}</section>}
          <section><small className="w-n">{settled ? "05" : "06"}</small><small className="l">From</small>{business.name}<br />{from}<br /><br /><span className="muted">{note}</span></section>
        </div>
      </div>
    );
  if (template === "soft")
    body = (
      <div className="pad">
        <div className="o-card o-hero">
          <div className="o-row">
            <div className="biz">{mark}{business.name}</div>
            <span className="o-pill">{word} <span className="iv-mono">{invoice.number}</span></span>
          </div>
          <small className="l o-lab">{heroLabel}</small>
          <div className="amt iv-num">{hero}</div>
          {(!settled || estimate) && <span className="o-pill o-pill--due">{dueLine}</span>}
        </div>
        <div className="o-two">
          <div className="o-card"><small className="l">Billed to</small>{billTo}{extra}</div>
          <div className="o-card"><small className="l">From</small>{business.name}<br />{from}<small className="l o-gap">{issuedLabel}</small>{invoice.issued}</div>
        </div>
        <div className="o-card o-items">{items}{totals}</div>
        <div className="o-two o-end">
          {settled ? <div /> : <div className="o-card o-pay"><small className="l">How to pay</small>{bank}</div>}
          <div className="o-card"><small className="l">Note</small>{note}</div>
        </div>
      </div>
    );

  return (
    <div
      className={`iv-paper t-${template}`} data-hero={heroSize}
      style={{ ["--brand" as string]: brand, ["--pfs" as string]: `${fontSize}px` } as CSSProperties}
      role="img"
      aria-label={`Invoice ${invoice.number} for ${c.name}, ${m(due)} due ${invoice.due}`}
    >
      {body}
      {stamp && (
        <div className={`iv-stamp iv-stamp--${stamp.kind}`} data-press={stamp.press || undefined}>
          {stamp.kind === "paid" ? "PAID" : "CANCELLED"}
        </div>
      )}
    </div>
  );
}

/** A decorative barcode drawn from the invoice number, so every invoice gets its own. */
function Barcode({ value }: { value: string }) {
  let h = 2166136261;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < 46; i++) {
    h = Math.imul(h ^ value.charCodeAt(i % value.length) ^ i, 16777619) >>> 0;
    const w = 1 + (h % 3);
    if (i % 2 === 0) bars.push({ x, w });
    x += w + (h % 2) + 0.6;
  }
  return (
    <figure className="g-bar" aria-hidden="true">
      <svg viewBox={`0 0 ${x.toFixed(1)} 20`} preserveAspectRatio="none">{bars.map((b, i) => <rect key={i} x={b.x.toFixed(1)} y="0" width={b.w} height="20" />)}</svg>
      <figcaption className="iv-mono">{value}</figcaption>
    </figure>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd className={/\d/.test(v) ? undefined : "sans"}>{v}</dd>
    </>
  );
}

/** Design and colour pickers sit with the preview they change. */
export function TemplatePicker({ value, onChange, brand }: { value: Template; onChange: (t: Template) => void; brand: string }) {
  return (
    <div className="iv-tpl" role="radiogroup" aria-label="Invoice design">
      {TEMPLATES.map((t) => (
        <button key={t.value} type="button" role="radio" aria-checked={t.value === value} onClick={() => onChange(t.value)}>
          <TemplateThumb kind={t.value} brand={brand} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

function TemplateThumb({ kind, brand }: { kind: Template; brand: string }) {
  const line = (y: number, w: number, fill = "#D9D8D3", h = 2) => <rect key={`${y}-${w}`} x="5" y={y} width={w} height={h} rx="1" fill={fill} />;
  const parts: Record<Template, ReactNode> = {
    minimal: [line(6, 8, brand, 4), line(16, 24), line(20, 18), line(26, 24), <rect key="b" x="5" y="34" width="24" height="6" rx="1.5" fill="#EEECE7" />],
    classic: [line(6, 8, brand, 4), <rect key="r" x="5" y="12" width="24" height="1" fill={brand} />, line(16, 12), <rect key="t" x="5" y="21" width="24" height="3" fill={brand} opacity=".15" />, line(26, 24), line(30, 24), line(36, 14)],
    stacked: [<rect key="b" x="0" y="0" width="34" height="13" fill={brand} />, <rect key="a" x="18" y="6" width="11" height="3" rx="1" fill="#fff" />, line(17, 24), line(22, 24), <rect key="c" x="5" y="28" width="24" height="7" rx="1.5" fill={brand} opacity=".15" />],
    bold: [line(5, 8, "#1A1916"), <rect key="h" x="5" y="11" width="20" height="7" rx="1" fill={brand} />, line(22, 24), line(27, 24), line(32, 24), line(37, 14)],
    editorial: [line(5, 7, brand, 3), <text key="w" x="4.5" y="18.5" fontFamily="Georgia, serif" fontSize="9.5" fill="#1A1916">Inv</text>, <rect key="d" x="21" y="16.6" width="1.8" height="1.8" fill={brand} />, <rect key="r" x="5" y="22" width="24" height="0.5" fill="#1A1916" />, line(25, 10), <rect key="a" x="19" y="25" width="10" height="3" rx="0.5" fill="#1A1916" />, line(32, 24), line(36, 24)],
    ledger: [line(5, 10, "#1A1916"), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => <rect key={`c${i}`} x={5 + i * 2} y="11" width="1.1" height="0.6" fill="#1A1916" opacity=".6" />), line(15, 14), line(19, 14), line(23, 24), <rect key="t" x="17" y="27" width="12" height="3" fill={brand} />, ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={`b${i}`} x={18 + i * 1.4} y="35" width={i % 3 ? 0.6 : 1} height="5" fill="#1A1916" />)],
    sidebar: [<rect key="s" x="0" y="0" width="12" height="44" fill={brand} />, <rect key="s1" x="2.5" y="5" width="5" height="3" rx="0.6" fill="#fff" opacity=".9" />, <rect key="s2" x="2.5" y="12" width="7" height="1.4" fill="#fff" opacity=".6" />, <rect key="s3" x="2.5" y="30" width="7" height="1.4" fill="#fff" opacity=".6" />, <rect key="h" x="15" y="6" width="14" height="4" rx="0.8" fill="#1A1916" />, <rect key="l1" x="15" y="15" width="14" height="1.6" rx="0.8" fill="#D9D8D3" />, <rect key="l2" x="15" y="19" width="14" height="1.6" rx="0.8" fill="#D9D8D3" />, <rect key="l3" x="15" y="23" width="14" height="1.6" rx="0.8" fill="#D9D8D3" />],
    swiss: [<rect key="w" x="5" y="5" width="15" height="5" fill="#1A1916" />, <rect key="r1" x="5" y="14" width="24" height="1" fill="#1A1916" />, <rect key="a" x="21" y="17" width="8" height="5" fill={brand} />, line(17, 6), line(20, 6), <rect key="r2" x="5" y="25" width="24" height="1" fill="#1A1916" />, line(29, 24), line(33, 24), line(37, 24)],
    soft: [<rect key="bg" x="0" y="0" width="34" height="44" fill={brand} opacity=".12" />, <rect key="c1" x="3" y="3" width="28" height="13" rx="2.5" fill="#fff" />, <rect key="a" x="6" y="9" width="12" height="3.5" rx="0.8" fill={brand} />, <rect key="c2" x="3" y="18" width="13.5" height="8" rx="2" fill="#fff" />, <rect key="c3" x="17.5" y="18" width="13.5" height="8" rx="2" fill="#fff" />, <rect key="c4" x="3" y="28" width="28" height="13" rx="2.5" fill="#fff" />],
  };
  return <svg viewBox="0 0 34 44" aria-hidden="true">{parts[kind]}</svg>;
}

export function ColourSwatches({ colours, value, onChange }: { colours: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div className="iv-swatches" role="radiogroup" aria-label="Invoice colour">
      {colours.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={c === value} aria-label={`Colour ${c}`} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}
