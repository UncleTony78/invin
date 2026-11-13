/* Display status is derived: "overdue" is never stored, it's sent/opened/partly paid past the due date. */
import type { Status } from "@/components/invoice/status";
import { daysBetween } from "./invoice-math";

export type StoredStatus = "draft" | "scheduled" | "sent" | "viewed" | "partial" | "paid" | "cancelled";
export const OPEN_STATUSES: StoredStatus[] = ["sent", "viewed", "partial"];

export function displayStatus(status: StoredStatus, dueDate: string | null, today: string): { status: Status; daysLate: number } {
  if (OPEN_STATUSES.includes(status) && dueDate && dueDate < today) return { status: "overdue", daysLate: daysBetween(dueDate, today) };
  return { status, daysLate: 0 };
}

/** Plain-language due line, e.g. "10 days late", "In 13 days", "Due today". */
export function dueText(status: StoredStatus, dueDate: string | null, today: string) {
  if (status === "paid") return "Paid";
  if (status === "draft") return "Not sent";
  if (status === "cancelled") return "Cancelled";
  if (!dueDate) return "—";
  const n = daysBetween(today, dueDate);
  if (status === "scheduled") return "Scheduled";
  if (n < 0) return `${-n} day${n === -1 ? "" : "s"} late`;
  if (n === 0) return "Due today";
  return `In ${n} day${n === 1 ? "" : "s"}`;
}
