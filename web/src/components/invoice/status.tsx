import type { ReactNode } from "react";

export type Status =
  | "draft"
  | "scheduled"
  | "sent"
  | "viewed"
  | "awaiting"
  | "partial"
  | "paid"
  | "overdue"
  | "failed"
  | "cancelled"
  | "skipped"
  | "queued"
  | "upcoming";

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sent: "Sent",
  viewed: "Opened",
  awaiting: "Awaiting payment",
  partial: "Partly paid",
  paid: "Paid",
  overdue: "Overdue",
  failed: "Failed",
  cancelled: "Cancelled",
  skipped: "Skipped",
  queued: "Queued",
  upcoming: "Upcoming",
};

const S = "var(--surface)";
const GLYPHS: Record<Status | "spark" | "invin", ReactNode> = {
  paid: (
    <>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M5 8.3 7 10.2 11 6" fill="none" stroke={S} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  failed: (
    <>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M8 4.6v4.2" stroke={S} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8" cy="11.2" r="1" fill={S} />
    </>
  ),
  cancelled: (
    <>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8" stroke={S} strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  skipped: (
    <>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m3.8 3.8 8.4 8.4" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  overdue: (
    <>
      <path d="M8 1.8a4.2 4.2 0 0 0-4.2 4.2c0 3.6-1.6 5-1.6 5h11.6s-1.6-1.4-1.6-5A4.2 4.2 0 0 0 8 1.8Z" fill="currentColor" />
      <path d="M6.6 13.4a1.6 1.6 0 0 0 2.8 0" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  ),
  partial: (
    <>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.6 2" />
      <path d="M5.4 8.2 7.2 10l3.4-3.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  awaiting: (
    <>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3.6a4.4 4.4 0 0 1 0 8.8Z" fill="currentColor" />
    </>
  ),
  queued: (
    <>
      <path d="M2 9.5h3.3l1 1.8h3.4l1-1.8H14V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" fill="currentColor" />
      <path d="M3.6 9.5 5 3.4h6l1.4 6.1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  upcoming: (
    <>
      <rect x="2.2" y="3" width="11.6" height="10.8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.2 6.6h11.6M5.5 1.6v2.6M10.5 1.6v2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  draft: <path d="M10.8 2.4a1.7 1.7 0 0 1 2.4 2.4L5.5 12.5 2.4 13.6l1.1-3.1Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
  sent: (
    <>
      <path d="M14 2 9.4 14l-2.2-5.2L2 6.6Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M14 2 7.2 8.8" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  viewed: (
    <>
      <path d="M1.5 8S3.8 3.6 8 3.6 14.5 8 14.5 8 12.2 12.4 8 12.4 1.5 8 1.5 8Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </>
  ),
  scheduled: (
    <>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.8V8l2.2 1.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  spark: <path d="M8 1.6v12.8M1.6 8h12.8M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="var(--signal)" strokeWidth="1.9" strokeLinecap="round" />,
  invin: (
    <>
      <rect x="1.5" y="1.5" width="13" height="13" rx="3.8" fill="var(--text-2)" />
      <rect x="5.2" y="4.8" width="5.6" height="2.2" rx="1.1" fill={S} />
    </>
  ),
};

export function Glyph({ status }: { status: keyof typeof GLYPHS }) {
  return (
    <svg className="iv-glyph" viewBox="0 0 16 16" aria-hidden="true">
      {GLYPHS[status]}
    </svg>
  );
}

/** Icon + label, never colour alone. Set `swapping` for the blur crossfade when status changes. */
export function StatusPill({ status, label, swapping }: { status: Status; label?: string; swapping?: boolean }) {
  return (
    <span className={`iv-pill st-${status}`} data-swap={swapping || undefined}>
      <Glyph status={status} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
