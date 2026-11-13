/* The welcome chat's questions and answer rules, shared by the chat and the server. */

export type Bank = { bank: string; rows: [string, string][] };
export type Answers = {
  name: string;
  business: string;
  /** What they bill for; becomes the workspace's invoice categories */
  work: string[];
  currency: string;
  email: string;
  /** "" when skipped */
  address: string;
  /** null when skipped */
  bank: Bank | null;
};
export type AnswerKey = keyof Answers;
export const ANSWER_KEYS: AnswerKey[] = ["name", "business", "work", "currency", "email", "address", "bank"];

export const CURRENCIES = [
  { value: "USD", label: "US dollar", symbol: "$" },
  { value: "GBP", label: "British pound", symbol: "£" },
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "NGN", label: "Nigerian naira", symbol: "₦" },
];

export const BANK_FIELDS: Record<string, string[]> = {
  USD: ["Account name", "Account number", "Routing number"],
  GBP: ["Account name", "Sort code", "Account number"],
  EUR: ["Account name", "IBAN", "BIC"],
  NGN: ["Account name", "Account number"],
};

export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Plain-language problem with an answer, or null when it's fine. */
export function validateAnswer(key: AnswerKey, value: unknown): string | null {
  const str = typeof value === "string" ? value.trim() : "";
  switch (key) {
    case "name":
      return str.length < 2 ? "Add your name so we know what to call you." : str.length > 80 ? "That's a long name. Keep it under 80 characters." : null;
    case "business":
      return !str ? "Add a business name, or use your own name." : str.length > 80 ? "Keep the business name under 80 characters." : null;
    case "work": {
      const list = Array.isArray(value) ? value : [];
      if (!list.length) return "Pick at least one, or add your own.";
      if (list.length > 12) return "Pick up to 12. You can add more later in Settings.";
      if (list.some((c) => typeof c !== "string" || !c.trim() || c.trim().length > 30)) return "Keep each one short, under 30 characters.";
      return null;
    }
    case "currency":
      return CURRENCIES.some((c) => c.value === value) ? null : "Pick a currency.";
    case "email":
      return emailOk(str) ? null : "That email looks incomplete. Check it and try again.";
    case "address":
      return str.length > 200 ? "Keep the address under 200 characters." : null;
    case "bank": {
      if (value === null) return null;
      const b = value as Bank;
      if (!b || typeof b.bank !== "string" || !Array.isArray(b.rows)) return "Add the bank details, or skip for now.";
      if (!b.bank.trim()) return "Add the bank's name.";
      if (!b.rows.some(([, v]) => typeof v === "string" && v.trim())) return "Add at least the account number.";
      return null;
    }
  }
}
