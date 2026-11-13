"use client";

import type { Currency } from "@/lib/format";
import { Money } from "./money";

export type PipelineKey = "draft" | "open" | "overdue" | "paid";
export type PipelineSegment = { key: PipelineKey; label: string; value: number; count: number; note?: string };

/**
 * The signature: all of a workspace's money in one bar, in its home currency.
 * Segments resize (520ms in-out) when money moves; hovering one dims the rest;
 * every segment and legend entry is a filter.
 */
export function MoneyPipeline({
  segments,
  variant = "full",
  currency = "USD",
  onSelect,
}: {
  currency?: Currency;
  segments: PipelineSegment[];
  variant?: "full" | "thin";
  onSelect?: (key: PipelineKey) => void;
}) {
  const bar = (
    <div className={`iv-bar ${variant === "thin" ? "iv-bar--thin" : ""}`} data-empty={segments.every((s) => !s.value) || undefined}>
      {segments.map((s) => (
        <button
          key={s.key}
          type="button"
          className={`iv-bar-seg seg-${s.key}`}
          style={{ ["--w" as string]: Math.max(s.value, 1) }}
          aria-label={`${s.label}: ${s.count} invoices`}
          onClick={() => onSelect?.(s.key)}
        />
      ))}
    </div>
  );
  if (variant === "thin") return bar;
  return (
    <div>
      {bar}
      <div className="iv-legend">
        {segments.map((s) => (
          <button key={s.key} type="button" onClick={() => onSelect?.(s.key)}>
            <span className="k">
              <i className={`seg-${s.key}`} />
              {s.label}
            </span>
            <div className="v">
              <Money value={s.value} currency={currency} />
            </div>
            <div className="n">
              {s.count} invoice{s.count === 1 ? "" : "s"}
              {s.note ? ` · ${s.note}` : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
