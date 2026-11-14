import "server-only";
import { after } from "next/server";

/*
 * Hosts whose cron can only run daily (Vercel Hobby) would leave receipts and reminders waiting.
 * So while people use the app, each server instance also nudges the background work along,
 * at most once every two minutes. Every job is idempotent, so overlapping runs are harmless.
 */
const EVERY = 2 * 60_000;
const g = globalThis as unknown as { __invinKick?: number };

export function kickDueWork() {
  if (process.env.NODE_ENV !== "production" || process.env.INVIN_SCHEDULER === "off") return; // dev has its own timer
  const now = Date.now();
  if (g.__invinKick && now - g.__invinKick < EVERY) return;
  g.__invinKick = now;
  after(async () => {
    try {
      const { runDueWork } = await import("./automation");
      await runDueWork();
    } catch (e) {
      console.error("[invin] background work failed:", e instanceof Error ? e.message : e);
    }
  });
}
