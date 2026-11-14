import "server-only";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { notify } from "./notify";

/**
 * Every email goes through here: it's logged in the outbox, then delivered with Resend.
 *
 * Safety: without a verified sending domain (EMAIL_FROM) nothing goes to real customers.
 *  - EMAIL_REDIRECT_TO set → delivered there instead, real recipient shown in the subject
 *  - neither set           → kept in Sent emails, not delivered
 */
export async function sendEmail(input: {
  workspaceId: string | null;
  invoiceId?: string | null;
  /** What the outbox keeps instead of the real text (e.g. never store sign-in codes) */
  logText?: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  fromName?: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  const key = process.env.RESEND_API_KEY?.trim();
  const redirect = process.env.EMAIL_REDIRECT_TO?.trim();
  // A workspace with its own verified domain sends from it; otherwise the app-wide EMAIL_FROM
  let wsFrom: string | null = null;
  if (input.workspaceId) {
    const [ws] = await db.select({ fromEmail: s.workspaces.fromEmail, status: s.workspaces.domainStatus }).from(s.workspaces).where(eq(s.workspaces.id, input.workspaceId));
    if (ws?.status === "verified" && ws.fromEmail) wsFrom = ws.fromEmail;
  }
  const from = wsFrom ? `${input.fromName ?? "InVin"} <${wsFrom}>` : process.env.EMAIL_FROM?.trim();

  const [row] = await db
    .insert(s.outbox)
    .values({ workspaceId: input.workspaceId, invoiceId: input.invoiceId ?? null, to: input.to, subject: input.subject, body: input.logText ?? input.text })
    .returning();

  let target: string | null = null;
  let held = "";
  if (!key) held = "Email isn't connected. Add RESEND_API_KEY.";
  else if (redirect) target = redirect;
  else if (from) target = input.to;
  else held = "Test mode: set EMAIL_REDIRECT_TO to your Resend email to receive these.";

  if (!target) {
    await db.update(s.outbox).set({ status: "held", error: held }).where(eq(s.outbox.id, row.id));
    return { status: "held" as const };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: from || `${input.fromName ?? "InVin"} <onboarding@resend.dev>`,
        to: [target],
        subject: redirect ? `[For ${input.to}] ${input.subject}` : input.subject,
        text: input.text,
        html: input.html,
        reply_to: input.replyTo,
        attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(body.message || `Resend returned ${res.status}`);
    await db.update(s.outbox).set({ status: "sent", providerId: body.id ?? null, deliveredTo: target, error: null }).where(eq(s.outbox.id, row.id));
    return { status: "sent" as const };
  } catch (e) {
    await db.update(s.outbox).set({ status: "failed", error: e instanceof Error ? e.message : String(e) }).where(eq(s.outbox.id, row.id));
    if (input.workspaceId) await notify(input.workspaceId, { kind: "failed", title: "An email didn't send", body: `${input.subject}, to ${input.to}`, invoiceId: input.invoiceId ?? null, href: "/outbox" });
    return { status: "failed" as const };
  }
}

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
