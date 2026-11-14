/* Renders every invoice design to static HTML for the marketing page (public/home).
   Run from web/: npx tsx scripts/render-papers.tsx */
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoicePaper, TEMPLATES, type PaperInvoice } from "../src/components/invoice/paper";
import type { BankAccount, Business } from "../src/lib/sample";

const BIZ: Business = { name: "Ada Obi Studio", mark: "AO", address: "Admiralty Way, Lekki, Lagos", email: "" };
const GBP: BankAccount = { id: "gbp", currency: "GBP", bank: "Wise · UK account", rows: [["Account name", "Ada Obi Studio"], ["Account number", "41286650"], ["Sort code", "23-14-70"]] };
const INV: PaperInvoice = {
  number: "INV-0145", issued: "Nov 13, 2026", due: "Nov 27, 2026", currency: "GBP",
  customer: { name: "Northstar Advisory", email: "", address: "Shoreditch, London", currency: "GBP" },
  items: [{ description: "Brand identity, phase 2", quantity: 1, price: 1350 }, { description: "File export and handover", quantity: 5, price: 90 }],
};

const out: Record<string, string> = {};
for (const t of TEMPLATES) out[t.value] = renderToStaticMarkup(<InvoicePaper invoice={INV} business={BIZ} account={GBP} template={t.value} brand="#0E5A52" />);
out.paid = renderToStaticMarkup(<InvoicePaper invoice={{ ...INV, paid: 1800, settled: "paid" }} business={BIZ} account={GBP} template="stacked" brand="#0E5A52" stamp={{ kind: "paid", press: true }} />);
writeFileSync("public/home/papers.json", JSON.stringify({ labels: TEMPLATES, html: out }));
console.log(Object.keys(out).join(", "));
