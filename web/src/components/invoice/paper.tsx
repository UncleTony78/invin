"use client";

import type { CSSProperties, ReactNode } from "react";
import { formatMoney, type Currency } from "@/lib/format";
import type { BankAccount, Business, Customer, LineItem } from "@/lib/sample";

export type Template = "minimal" | "classic" | "stacked" | "bold";
export const TEMPLATES: { value: Template; label: string }[] = [
  { value: "minimal", label: "Minimal" },
  { value: "classic", label: "Classic" },
  { value: "stacked", label: "Stacked" },
  { value: "bold", label: "Bold" },
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
  const settled = invoice.settled;
  const dueWord = settled === "paid" ? "Paid in full" : settled === "cancelled" ? "Cancelled" : null;
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
  const mark = <span className="mk">{business.mark}</span>;

  let body: ReactNode = null;
  if (template === "minimal")
    body = (
      <div className="pad">
        <div className="ptop">
          <div className="biz">{mark}{business.name}</div>
          <div className="ttl">Invoice<br /><span className="iv-mono">{invoice.number}</span></div>
        </div>
        <div className="meta">
          <div><small className="l">Bill to</small>{billTo}</div>
          <div><small className="l">Issued</small>{invoice.issued}<br /><br /><small className="l">Due</small>{invoice.due}</div>
          <div><small className="l">{dueWord ?? "Amount due"}</small><div className="due iv-num">{m(settled ? total : due)}</div></div>
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
          <div><div className="word">INVOICE</div><div>{invoice.number}</div></div>
        </div>
        <div className="meta">
          <div><small className="l">Bill to</small>{billTo}</div>
          <div><small className="l">Invoice date</small>{invoice.issued}</div>
          <div><small className="l">Due date</small>{invoice.due}</div>
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
            <div className="ttl">Invoice {invoice.number} · issued {invoice.issued}</div>
          </div>
          <div className="big iv-num"><small>{dueWord ?? dueBy}</small>{m(settled ? total : due)}</div>
        </div>
        <div className="rows">
          <div className="rw"><small className="l">Billed to</small><div>{billTo}</div></div>
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
          <div style={{ textAlign: "right", color: "#5F5D58" }}>Invoice<br /><span className="iv-mono">{invoice.number}</span></div>
        </div>
        <div className="huge iv-num">{m(settled ? total : due)}</div>
        <p>{dueWord ? dueWord.toLowerCase() : onReceipt ? "due on receipt" : `due by ${invoice.due}`} · issued {invoice.issued}</p>
        <div className="meta">
          <div><small className="l">Bill to</small>{billTo}</div>
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
