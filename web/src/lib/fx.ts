/* Placeholder rates for showing mixed currencies in one total on Home.
   Phase 3 (multi-currency reporting) replaces this with dated rates snapshotted per invoice. */
const TO_USD: Record<string, number> = { USD: 1, GBP: 1.27, EUR: 1.08, NGN: 0.00065 };

export function toUsdMinor(amountMinor: number, currency: string) {
  return Math.round(amountMinor * (TO_USD[currency] ?? 1));
}

/** Approximate an amount in the workspace's home currency, for totals that mix currencies. */
export function toHomeMinor(amountMinor: number, currency: string, home: string) {
  if (currency === home) return amountMinor;
  return Math.round(toUsdMinor(amountMinor, currency) / (TO_USD[home] ?? 1));
}
