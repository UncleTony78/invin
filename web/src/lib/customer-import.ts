/* Customer CSV import: parse, match columns, check each row. Shared by the preview and the server. */

export type ImportRow = { line: number; name: string; email: string; address: string; currency: string; termsDays: number; problem: string | null };

/** RFC 4180-ish CSV: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";" || ch === "\t") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((c) => c.trim())) rows.push(row);
      row = []; field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

/** Header names people actually use, in any case or spacing. */
const ALIASES: Record<"name" | "email" | "address" | "currency" | "terms", string[]> = {
  name: ["name", "customer", "customer name", "company", "company name", "client", "client name", "business"],
  email: ["email", "e-mail", "email address", "billing email", "contact email", "mail"],
  address: ["address", "billing address", "location", "city", "street"],
  currency: ["currency", "pays in", "ccy"],
  terms: ["terms", "payment terms", "terms (days)", "days to pay", "due in", "net"],
};

export type ColumnMap = Partial<Record<keyof typeof ALIASES, number>>;

export function matchColumns(header: string[]): ColumnMap {
  const norm = header.map((h) => h.trim().toLowerCase().replace(/[_\s]+/g, " "));
  const map: ColumnMap = {};
  for (const [key, names] of Object.entries(ALIASES) as [keyof typeof ALIASES, string[]][]) {
    const i = norm.findIndex((h) => names.includes(h));
    if (i >= 0) map[key] = i;
  }
  return map;
}

const CURRENCIES = ["USD", "GBP", "EUR", "NGN"];
const SYMBOLS: Record<string, string> = { "$": "USD", "£": "GBP", "€": "EUR", "₦": "NGN" };
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

/** Turn data rows into customers, each with a plain problem when it can't be imported as is. */
export function toCustomers(rows: string[][], map: ColumnMap, fallbackCurrency: string): ImportRow[] {
  return rows.map((r, k) => {
    const get = (key: keyof ColumnMap) => (map[key] != null ? (r[map[key]!] ?? "").trim() : "");
    const rawCur = get("currency").toUpperCase();
    const currency = CURRENCIES.includes(rawCur) ? rawCur : (SYMBOLS[rawCur] ?? fallbackCurrency);
    const days = parseInt(get("terms").replace(/\D/g, ""), 10);
    // Snap free-form terms to the ones InVin offers: on receipt, 7, 14 or 30 days
    const termsDays = Number.isNaN(days) ? 14 : [0, 7, 14, 30].reduce((a, b) => (Math.abs(b - days) < Math.abs(a - days) ? b : a), 14);
    const name = get("name").slice(0, 120);
    const email = get("email").toLowerCase();
    const problem = !name ? "No name" : !email ? "No email" : !emailOk(email) ? "Email looks incomplete" : rawCur && !CURRENCIES.includes(rawCur) && !SYMBOLS[rawCur] ? `Currency "${get("currency")}" isn't supported, used ${fallbackCurrency}` : null;
    return { line: k + 2, name, email, address: get("address").slice(0, 200), currency, termsDays, problem: problem?.startsWith("Currency") ? null : problem };
  });
}
