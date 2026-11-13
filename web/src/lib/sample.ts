/* Sample data for the component showcase. Not real people, companies or accounts. */
import type { Currency } from "./format";

export type BankAccount = { id: string; currency: Currency; bank: string; rows: [string, string][] };
export type Business = { name: string; mark: string; address: string; email: string };
export type Customer = { name: string; email: string; address: string; currency: Currency };
export type LineItem = { description: string; quantity: number; price: number };

export const BUSINESS: Business = { name: "Ada Obi Studio", mark: "AO", address: "Admiralty Way, Lekki, Lagos", email: "ada@adaobi.studio" };

export const ACCOUNTS: BankAccount[] = [
  { id: "usd", currency: "USD", bank: "Wise · US account", rows: [["Account name", "Ada Obi Studio"], ["Account number", "8310004721"], ["Routing (ACH)", "026073008"], ["SWIFT", "CMFGUS33"]] },
  { id: "gbp", currency: "GBP", bank: "Wise · UK account", rows: [["Account name", "Ada Obi Studio"], ["Account number", "41286650"], ["Sort code", "23-14-70"], ["IBAN", "GB33 TRWI 2314 7041 2866 50"]] },
  { id: "eur", currency: "EUR", bank: "Wise · EU account", rows: [["Account name", "Ada Obi Studio"], ["IBAN", "BE68 9672 0001 2345"], ["SWIFT / BIC", "TRWIBEB1XXX"]] },
  { id: "ngn", currency: "NGN", bank: "Guaranty Trust Bank", rows: [["Account name", "Ada Obi Studio"], ["Account number", "0123456789"], ["Bank code", "058"]] },
];

export const CUSTOMERS: Customer[] = [
  { name: "Acme Corp", email: "billing@acme.co", address: "Market Street, San Francisco", currency: "USD" },
  { name: "Northstar Advisory Ltd", email: "finance@northstar.co.uk", address: "Shoreditch, London", currency: "GBP" },
  { name: "Bloom & Co", email: "hello@bloom.co", address: "Prenzlauer Berg, Berlin", currency: "EUR" },
  { name: "Kora Foods", email: "accounts@korafoods.ng", address: "Ikeja, Lagos", currency: "NGN" },
];

export const BRAND_COLOURS = ["#0E5A52", "#1A1916", "#2453B8", "#B93A0B", "#7A4E2D"];
