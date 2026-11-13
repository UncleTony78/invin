/* Pure invoice arithmetic, shared by server and client. All values in minor units. */

export type Line = { quantity: number; unitPrice: number };

export function computeTotals(lines: Line[], vatBps: number) {
  const subtotal = lines.reduce((s, l) => s + Math.round(l.quantity * l.unitPrice), 0);
  const tax = Math.round((subtotal * vatBps) / 10000);
  return { subtotal, tax, total: subtotal + tax };
}

export const toMinor = (major: number) => Math.round(major * 100);

/* Limits that keep every amount exact in integer minor units and readable on the page.
   999,999,999,999.99 in any currency is far beyond a real invoice, and far inside what JavaScript counts exactly. */
export const MAX_TOTAL = 99_999_999_999_999; // minor units
export const MAX_QUANTITY = 1_000_000;

/** Plain-language problem with the amounts, or null when they're fine. */
export function amountProblem(lines: Line[], vatBps: number): string | null {
  for (const l of lines) {
    if (!Number.isFinite(l.quantity) || l.quantity < 0) return "Quantities can't be negative.";
    if (l.quantity > MAX_QUANTITY) return "Keep each quantity to 1,000,000 or less.";
    if (!Number.isFinite(l.unitPrice) || l.unitPrice < 0) return "Prices can't be negative.";
    if (l.unitPrice > MAX_TOTAL || l.quantity * l.unitPrice > MAX_TOTAL) return "That price is too large. One invoice can be up to 999,999,999,999.99.";
  }
  if (computeTotals(lines, vatBps).total > MAX_TOTAL) return "This invoice adds up to more than 999,999,999,999.99, the most one invoice can hold. Split it into two.";
  return null;
}
export const toMajor = (minor: number) => minor / 100;

/** ISO date (YYYY-MM-DD) n days from a base date, in local time. */
export function isoDate(base: Date, addDays = 0) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + addDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(fromIso: string, toIso: string) {
  const [a, b] = [fromIso, toIso].map((s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

export function formatDate(iso: string | null | undefined, opts: { year?: boolean } = {}) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(opts.year ? { year: "numeric" } : {}) });
}
