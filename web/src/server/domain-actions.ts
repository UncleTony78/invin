"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { requireRole } from "./session";

/*
 * Sending from your own domain, through Resend's Domains API.
 * Add the domain → copy the DNS records it gives you to your DNS host → check until Resend says it's verified.
 */

type Rec = { record?: string; name: string; type: string; value: string; status?: string; priority?: number };
const API = "https://api.resend.com";
const refresh = () => revalidatePath("/", "layout");

async function resend(path: string, init: RequestInit = {}) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false as const, error: "Email isn't connected yet. Add RESEND_API_KEY first." };
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return { ok: true as const, body };
  const name = String(body.name ?? "");
  const msg = String(body.message ?? `Resend returned ${res.status}`);
  if (res.status === 401 || res.status === 403 || name.includes("restricted")) return { ok: false as const, error: "Your Resend key can only send email. Create a full-access key in Resend to add a domain, then update RESEND_API_KEY." };
  return { ok: false as const, error: msg };
}

const toRecords = (body: Record<string, unknown>) =>
  ((body.records as Rec[] | undefined) ?? []).map((r) => ({ type: r.type, name: r.name, value: r.priority ? `${r.priority} ${r.value}` : r.value, status: r.status ?? "not_started" }));
const toStatus = (st: unknown) => (st === "verified" ? "verified" : st === "failed" || st === "temporary_failure" ? "failed" : "pending");

export async function addSendingDomain(domainIn: string, local: string) {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate;
  const domain = domainIn.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) return { ok: false as const, error: "Enter a domain like yourstudio.com, without www or https." };
  const from = local.trim().toLowerCase() || "invoices";
  if (!/^[a-z0-9._-]{1,40}$/.test(from)) return { ok: false as const, error: "Use letters, numbers, dots or dashes before the @." };
  const r = await resend("/domains", { method: "POST", body: JSON.stringify({ name: domain }) });
  if (!r.ok) return r;
  await db
    .update(s.workspaces)
    .set({ sendingDomain: domain, domainId: String(r.body.id), domainStatus: toStatus(r.body.status), domainRecords: toRecords(r.body), fromEmail: `${from}@${domain}` })
    .where(eq(s.workspaces.id, gate.session.workspace.id));
  refresh();
  return { ok: true as const };
}

/** Ask Resend to check the DNS records now, then save what it says. */
export async function checkSendingDomain() {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate;
  const id = gate.session.workspace.domainId;
  if (!id) return { ok: false as const, error: "Add a domain first." };
  await resend(`/domains/${id}/verify`, { method: "POST" });
  const r = await resend(`/domains/${id}`);
  if (!r.ok) return r;
  const status = toStatus(r.body.status);
  await db.update(s.workspaces).set({ domainStatus: status, domainRecords: toRecords(r.body) }).where(eq(s.workspaces.id, gate.session.workspace.id));
  refresh();
  return { ok: true as const, status };
}

export async function setFromAddress(local: string) {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate;
  const domain = gate.session.workspace.sendingDomain;
  const from = local.trim().toLowerCase();
  if (!domain) return { ok: false as const, error: "Add a domain first." };
  if (!/^[a-z0-9._-]{1,40}$/.test(from)) return { ok: false as const, error: "Use letters, numbers, dots or dashes before the @." };
  await db.update(s.workspaces).set({ fromEmail: `${from}@${domain}` }).where(eq(s.workspaces.id, gate.session.workspace.id));
  refresh();
  return { ok: true as const };
}

/** Stop using the domain. Emails go back to InVin's shared address. */
export async function removeSendingDomain() {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate;
  const id = gate.session.workspace.domainId;
  if (id) await resend(`/domains/${id}`, { method: "DELETE" });
  await db.update(s.workspaces).set({ sendingDomain: null, domainId: null, domainStatus: "none", domainRecords: [], fromEmail: null }).where(eq(s.workspaces.id, gate.session.workspace.id));
  refresh();
  return { ok: true as const };
}
