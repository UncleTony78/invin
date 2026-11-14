import "server-only";
import { db, schema as s } from "@/db";

export type NotifyKind = "viewed" | "claim" | "paid" | "overdue" | "recurring" | "failed" | "refund" | "credit";

/**
 * Add to the workspace's notification feed. Never throws: a feed entry must not break the action that caused it.
 * `dedupe` makes repeat events (the runner noticing the same overdue invoice every minute) land once.
 */
export async function notify(workspaceId: string, n: { kind: NotifyKind; title: string; body?: string; invoiceId?: string | null; href?: string; dedupe?: string }) {
  try {
    await db
      .insert(s.notifications)
      .values({ workspaceId, kind: n.kind, title: n.title, body: n.body ?? null, invoiceId: n.invoiceId ?? null, href: n.href ?? null, dedupe: n.dedupe ?? null })
      .onConflictDoNothing();
  } catch (e) {
    console.error("[invin] notification not saved:", e instanceof Error ? e.message : e);
  }
}
