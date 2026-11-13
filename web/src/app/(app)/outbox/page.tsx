import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db, schema as s } from "@/db";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Sent emails · InVin" };

/* Until an email provider is connected, every email InVin would send lands here. */
export default async function OutboxPage() {
  const session = await requireSession();
  const mails = await db.select().from(s.outbox).where(eq(s.outbox.workspaceId, session.workspace.id)).orderBy(desc(s.outbox.createdAt)).limit(50);
  return (
    <div className="wrap" style={{ maxWidth: 820 }}>
      <div className="ph">
        <div>
          <h1>Sent emails</h1>
          <p className="sub">Every email InVin sends for you, and what happened to it.</p>
        </div>
      </div>
      {mails.length === 0 ? (
        <div className="empty"><b>No emails yet.</b>Send an invoice or a reminder and it will show up here.</div>
      ) : (
        <ol className="grid gap-3">
          {mails.map((m) => (
            <li key={m.id} className="rounded-xl p-5 shadow-[inset_0_0_0_1px_var(--line)]">
              <div className="flex items-baseline justify-between gap-4">
                <b className="font-medium">{m.subject}</b>
                <time className="shrink-0 text-[12px] text-text-2">{m.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-text-2">
                <span>To {m.to}</span>
                {m.status === "sent" && <span className="iv-tag" style={{ background: "var(--st-paid-bg)", color: "var(--st-paid)" }}>{m.deliveredTo && m.deliveredTo !== m.to ? `Delivered to ${m.deliveredTo} (test mode)` : "Delivered"}</span>}
                {m.status === "held" && <span className="iv-tag iv-tag--neutral">Not delivered</span>}
                {m.status === "failed" && <span className="iv-tag" style={{ background: "var(--st-failed-bg)", color: "var(--st-failed)" }}>Failed</span>}
              </div>
              {m.status !== "sent" && m.error && <p className="mt-1 text-[12px] text-text-2">{m.error}</p>}
              <pre className="mt-3 whitespace-pre-wrap font-sans text-[13px] leading-relaxed">{m.body}</pre>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
