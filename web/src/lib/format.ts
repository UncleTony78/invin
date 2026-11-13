export type Currency = "USD" | "GBP" | "EUR" | "NGN";

const formatters = new Map<Currency, Intl.NumberFormat>();

function formatter(currency: Currency) {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "narrowSymbol" });
    formatters.set(currency, f);
  }
  return f;
}

/** Amount split into its currency symbol and the number, so the symbol can sit lighter. */
export function moneyParts(value: number, currency: Currency) {
  const parts = formatter(currency).formatToParts(value);
  const symbol = parts.filter((p) => p.type === "currency").map((p) => p.value).join("");
  const number = parts.filter((p) => p.type !== "currency").map((p) => p.value).join("");
  return { symbol, number };
}

export function formatMoney(value: number, currency: Currency = "USD") {
  return formatter(currency).format(value);
}

/** Compact USD figure for group totals, e.g. $3.26k */
/** Compact axis labels: $1.2k, ₦3.4M */
export function formatShort(value: number, currency: Currency = "USD") {
  const sym = moneyParts(0, currency).symbol;
  const trim = (n: number) => n.toFixed(n >= 10 ? 1 : 2).replace(/\.?0+$/, "");
  if (value >= 1_000_000) return sym + trim(value / 1_000_000) + "M";
  if (value >= 1000) return sym + trim(value / 1000) + "k";
  return sym + Math.round(value);
}

export function initials(name: string) {
  return name
    .replace(/&/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const TINTS: [string, string][] = [
  ["#E8EFFC", "#2453B8"],
  ["#E2F3F1", "#0E6A63"],
  ["#FCEFDD", "#94470A"],
  ["#EEF0F2", "#4C5663"],
  ["#E3F2E8", "#12713F"],
  ["#FBE8F1", "#A62C63"],
  ["#FFEEE5", "#B23F0E"],
];

/** Stable tint per name so a customer always gets the same avatar colour. */
export function tintFor(name: string): [string, string] {
  const sum = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return TINTS[sum % TINTS.length];
}
