/* Recurring schedules. Dates are ISO yyyy-mm-dd strings in the workspace's calendar (no times, no time zones). */

export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

export const FREQUENCIES: { value: Frequency; label: string; every: string }[] = [
  { value: "weekly", label: "Weekly", every: "week" },
  { value: "monthly", label: "Monthly", every: "month" },
  { value: "quarterly", label: "Every 3 months", every: "3 months" },
  { value: "yearly", label: "Yearly", every: "year" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parts = (date: string) => date.split("-").map(Number) as [number, number, number];
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The nth run after the anchor. Counting from the anchor keeps "the 31st" on each month's last day. */
export function runDate(anchor: string, frequency: Frequency, n: number): string {
  const [y, m, d] = parts(anchor);
  if (frequency === "weekly") {
    const t = new Date(Date.UTC(y, m - 1, d + 7 * n));
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  const months = n * (frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12);
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return iso(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export type Ending = { endAfter: number | null; endOn: string | null };

/** Whether run number `index` (0-based) is still inside the series' end rule. */
export function withinEnd(anchor: string, frequency: Frequency, index: number, end: Ending) {
  if (end.endAfter != null && index >= end.endAfter) return false;
  if (end.endOn && runDate(anchor, frequency, index) > end.endOn) return false;
  return true;
}

/** "Monthly on the 1st", "Weekly on Mondays", "Yearly on 4 March" */
export function describeSchedule(anchor: string, frequency: Frequency): string {
  const [y, m, d] = parts(anchor);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (frequency === "weekly") return `Weekly on ${date.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })}s`;
  const nth = d >= 29 && d === daysInMonth(y, m) ? "last day" : ordinal(d);
  if (frequency === "monthly") return `Monthly on the ${nth}`;
  if (frequency === "quarterly") return `Every 3 months on the ${nth}`;
  return `Yearly on ${date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}`;
}

export function describeEnding(end: Ending): string {
  if (end.endAfter != null) return `Ends after ${end.endAfter} invoice${end.endAfter === 1 ? "" : "s"}`;
  if (end.endOn) {
    const [y, m, d] = parts(end.endOn);
    return `Ends on ${new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
  }
  return "No end date";
}

function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}

/** Plain words for a reminder step: -3 → "3 days before it's due", 0 → "On the due date", 7 → "7 days late" */
export function describeOffset(days: number): string {
  if (days === 0) return "On the due date";
  const n = Math.abs(days);
  const unit = n === 1 ? "day" : "days";
  return days < 0 ? `${n} ${unit} before it's due` : `${n} ${unit} late`;
}

/** One line for the editor: "Automatic reminders: 3 days before, on the day, then 3, 7 and 14 days late." */
export function remindersNote(on: boolean, offsets: number[]): string {
  if (!on || offsets.length === 0) return "Automatic reminders are off. You can send one by hand any time.";
  const sorted = [...offsets].sort((a, b) => a - b);
  const before = sorted.filter((o) => o < 0).map((o) => `${-o} day${o === -1 ? "" : "s"} before`);
  const onDay = sorted.includes(0) ? ["on the day"] : [];
  const late = sorted.filter((o) => o > 0);
  const lateText = late.length ? [`${late.length > 1 ? `${late.slice(0, -1).join(", ")} and ${late.at(-1)}` : late[0]} days late`] : [];
  const parts = [...before, ...onDay, ...lateText];
  return `Automatic reminders go out ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]}.`;
}
