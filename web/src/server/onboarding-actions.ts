"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema as s } from "@/db";
import { getAuth } from "@/server/auth";
import { findMembership, requireUser } from "@/server/session";
import { ANSWER_KEYS, type Answers, validateAnswer } from "@/lib/onboarding";

/** Save one answer from the welcome chat. Called after every reply, so nothing is lost on refresh. */
export async function saveAnswer<K extends keyof Answers>(key: K, value: Answers[K]) {
  const user = await requireUser();
  if (!ANSWER_KEYS.includes(key)) return { ok: false as const, error: "Unknown question." };
  const problem = validateAnswer(key, value);
  if (problem) return { ok: false as const, error: problem };
  const [row] = await db.select().from(s.onboarding).where(eq(s.onboarding.userId, user.id));
  const answers = { ...(row?.answers ?? {}), [key]: value };
  await db
    .insert(s.onboarding)
    .values({ userId: user.id, answers, updatedAt: new Date() })
    .onConflictDoUpdate({ target: s.onboarding.userId, set: { answers, updatedAt: new Date() } });
  return { ok: true as const };
}

const initials = (name: string) =>
  name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "IV";

/** The last step: they confirmed everything, so create the workspace and their owner seat. */
export async function finishOnboarding() {
  const user = await requireUser();
  if (await findMembership(user.id)) return { ok: true as const };
  const [row] = await db.select().from(s.onboarding).where(eq(s.onboarding.userId, user.id));
  const a = (row?.answers ?? {}) as Partial<Answers>;
  for (const key of ["name", "business", "currency", "email"] as const) {
    if (!a[key]) return { ok: false as const, error: `We're missing your ${key === "business" ? "business name" : key}.` };
  }
  const [ws] = await db
    .insert(s.workspaces)
    .values({
      name: a.business!.trim(),
      mark: initials(a.business!),
      address: a.address?.trim() ?? "",
      email: a.email!.trim().toLowerCase(),
      defaultCurrency: a.currency!,
      // Older saved answers held one string; today it's a list
      work: (Array.isArray(a.work) ? a.work[0] : a.work) ?? "",
      categories: Array.isArray(a.work) && a.work.length ? [...new Set(a.work.map((c) => c.trim()))] : ["General"],
    })
    .returning();
  await db.insert(s.members).values({ workspaceId: ws.id, userId: user.id, name: a.name!.trim(), email: user.email, role: "owner" });
  if (a.bank) await db.insert(s.bankAccounts).values({ workspaceId: ws.id, currency: a.currency!, bank: a.bank.bank.trim(), rows: a.bank.rows.filter(([k, v]) => k.trim() && v.trim()) });
  await db.update(s.user).set({ name: a.name!.trim(), updatedAt: new Date() }).where(eq(s.user.id, user.id));
  await db.delete(s.onboarding).where(eq(s.onboarding.userId, user.id));
  return { ok: true as const };
}

export async function signOut() {
  await getAuth().api.signOut({ headers: await headers() });
}
