import { moneyParts, type Currency } from "@/lib/format";

/** Tabular figures with the currency symbol one step lighter. */
export function Money({ value, currency = "USD", className }: { value: number; currency?: Currency; className?: string }) {
  const { symbol, number } = moneyParts(value, currency);
  return (
    <span className={`iv-num ${className ?? ""}`}>
      <span className="iv-cur">{symbol}</span>
      {number}
    </span>
  );
}
