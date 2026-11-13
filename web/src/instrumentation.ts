/*
 * Development scheduler: run InVin's background work every minute inside the dev server,
 * which is the only process allowed to open the local database.
 * Production uses a platform cron calling /api/cron instead (see that route).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "production" || process.env.INVIN_SCHEDULER === "off") return;
  const g = globalThis as unknown as { __invinScheduler?: NodeJS.Timeout };
  if (g.__invinScheduler) return;
  const tick = async () => {
    try {
      const { runDueWork } = await import("./server/automation");
      const r = await runDueWork();
      if ("recurring" in r && (r.recurring || r.reminders || r.receipts)) console.log(`[invin] made ${r.recurring} recurring invoice(s), sent ${r.reminders} reminder(s), ${r.receipts} receipt(s)`);
    } catch (e) {
      console.error("[invin] background work failed:", e instanceof Error ? e.message : e);
    }
  };
  setTimeout(tick, 15_000);
  g.__invinScheduler = setInterval(tick, 60_000);
}
