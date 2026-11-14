"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { buildDigest, type DigestKind } from "./digest";
import { sendEmail } from "./email";
import { requireSession } from "./session";

type Result = { ok: true } | { ok: false; error: string };

/** Your own summary setting. Anyone on the team can change their own. */
export async function setDigest(kind: DigestKind): Promise<Result> {
  const { member } = await requireSession();
  if (!["off", "daily", "weekly"].includes(kind)) return { ok: false, error: "Choose off, daily or weekly." };
  await db.update(s.members).set({ digest: kind }).where(eq(s.members.id, member.id));
  revalidatePath("/settings");
  return { ok: true };
}

/** Send this period's summary now, so you can see what it looks like. Doesn't change when the next one goes. */
export async function sendDigestNow(): Promise<Result & { to?: string }> {
  const { member } = await requireSession();
  const kind = member.digest === "daily" ? "daily" : "weekly";
  const now = new Date();
  const mail = await buildDigest(member.workspaceId, new Date(now.getTime() - (kind === "daily" ? 1 : 7) * 86_400_000), now, kind);
  if (!mail) return { ok: false, error: `Nothing happened in the last ${kind === "daily" ? "day" : "week"}, so there's nothing to send yet.` };
  try {
    await sendEmail({ workspaceId: member.workspaceId, to: member.email, ...mail });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The email didn't send. Try again." };
  }
  return { ok: true, to: member.email };
}
