"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db, schema as s } from "@/db";
import { appUrl, sendEmail } from "./email";
import { inviteEmail } from "./email-templates";
import { notify } from "./notify";
import { listMemberships, requireRole, requireSession, requireUser, WS_COOKIE } from "./session";

const refresh = () => revalidatePath("/", "layout");
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const DAY = 86_400_000;

async function sendInvite(invite: typeof s.invites.$inferSelect, inviter: string, workspace: typeof s.workspaces.$inferSelect) {
  const mail = inviteEmail({ inviter, business: workspace.name, role: invite.role, url: `${appUrl()}/join/${invite.token}` });
  const res = await sendEmail({ workspaceId: workspace.id, to: invite.email, ...mail, replyTo: workspace.email, fromName: workspace.name });
  return res.status;
}

/** Invite someone by email. Re-inviting the same address refreshes the link instead of making a second one. */
export async function inviteMember(emailIn: string, role: "admin" | "member") {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate;
  const { session } = gate;
  const email = emailIn.trim().toLowerCase();
  if (!emailOk(email)) return { ok: false as const, error: "Check the email address, it looks incomplete." };
  if (!["admin", "member"].includes(role)) return { ok: false as const, error: "Choose a role." };
  const members = await db.select().from(s.members).where(eq(s.members.workspaceId, session.workspace.id));
  if (members.some((m) => m.email.toLowerCase() === email && m.userId)) return { ok: false as const, error: "They're already on the team." };
  const [open] = await db.select().from(s.invites).where(and(eq(s.invites.workspaceId, session.workspace.id), eq(s.invites.email, email), isNull(s.invites.acceptedAt)));
  const expiresAt = new Date(Date.now() + 14 * DAY);
  const [invite] = open
    ? await db.update(s.invites).set({ role, expiresAt, invitedBy: session.member.id }).where(eq(s.invites.id, open.id)).returning()
    : await db.insert(s.invites).values({ workspaceId: session.workspace.id, email, role, invitedBy: session.member.id, expiresAt }).returning();
  const delivery = await sendInvite(invite, session.member.name, session.workspace);
  refresh();
  return { ok: true as const, delivery, again: !!open };
}

export async function resendInvite(id: string) {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate;
  const [invite] = await db.update(s.invites).set({ expiresAt: new Date(Date.now() + 14 * DAY) }).where(and(eq(s.invites.id, id), eq(s.invites.workspaceId, gate.session.workspace.id))).returning();
  if (!invite) return { ok: false as const, error: "Invite not found." };
  const delivery = await sendInvite(invite, gate.session.member.name, gate.session.workspace);
  refresh();
  return { ok: true as const, delivery };
}

export async function revokeInvite(id: string) {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate;
  await db.delete(s.invites).where(and(eq(s.invites.id, id), eq(s.invites.workspaceId, gate.session.workspace.id), isNull(s.invites.acceptedAt)));
  refresh();
  return { ok: true as const };
}

/**
 * Change someone's role. Admins can switch members and admins; only the owner can hand over ownership,
 * and doing so makes them an admin (a workspace always has exactly one owner).
 */
export async function changeRole(memberId: string, role: "owner" | "admin" | "member") {
  const gate = await requireRole(role === "owner" ? "owner" : "admin");
  if (!gate.ok) return gate;
  const { session } = gate;
  const [target] = await db.select().from(s.members).where(and(eq(s.members.id, memberId), eq(s.members.workspaceId, session.workspace.id)));
  if (!target) return { ok: false as const, error: "Teammate not found." };
  if (target.role === "owner") return { ok: false as const, error: "The owner's role changes only when they hand ownership to someone else." };
  if (role === "owner") {
    await db.transaction(async (tx) => {
      await tx.update(s.members).set({ role: "owner" }).where(eq(s.members.id, target.id));
      await tx.update(s.members).set({ role: "admin" }).where(eq(s.members.id, session.member.id));
    });
  } else {
    await db.update(s.members).set({ role }).where(eq(s.members.id, target.id));
  }
  refresh();
  return { ok: true as const };
}

/** Remove a teammate (admins), or leave the workspace yourself. The owner can't leave without handing over first. */
export async function removeMember(memberId: string) {
  const session = await requireSession();
  const self = memberId === session.member.id;
  if (!self) {
    const gate = await requireRole("admin");
    if (!gate.ok) return gate;
  }
  const [target] = await db.select().from(s.members).where(and(eq(s.members.id, memberId), eq(s.members.workspaceId, session.workspace.id)));
  if (!target) return { ok: false as const, error: "Teammate not found." };
  if (target.role === "owner") return { ok: false as const, error: self ? "Hand ownership to someone else before you leave." : "The owner can't be removed." };
  // Their name stays on everything they did (the activity record keeps actor names)
  await db.delete(s.pins).where(eq(s.pins.memberId, target.id));
  await db.delete(s.members).where(eq(s.members.id, target.id));
  if (self) (await cookies()).delete(WS_COOKIE);
  refresh();
  return { ok: true as const, left: self };
}

/** Accept an invite as the signed-in person. The invite must be for their email. */
export async function acceptInvite(token: string) {
  const user = await requireUser();
  const [invite] = await db.select().from(s.invites).where(eq(s.invites.token, token));
  if (!invite || invite.acceptedAt) return { ok: false as const, error: "This invite has already been used." };
  if (invite.expiresAt.getTime() < Date.now()) return { ok: false as const, error: "This invite has expired. Ask for a new one." };
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) return { ok: false as const, error: `This invite is for ${invite.email}. Sign in with that email to accept it.` };
  const mine = await listMemberships(user.id);
  if (!mine.some((m) => m.workspace.id === invite.workspaceId)) {
    await db.insert(s.members).values({ workspaceId: invite.workspaceId, userId: user.id, name: user.name?.trim() || user.email.split("@")[0], email: user.email, role: invite.role });
    await notify(invite.workspaceId, { kind: "viewed", title: `${user.name?.trim() || user.email} joined the team`, body: `As ${invite.role === "admin" ? "an admin" : "a member"}`, href: "/settings#team" });
  }
  await db.update(s.invites).set({ acceptedAt: new Date() }).where(eq(s.invites.id, invite.id));
  (await cookies()).set(WS_COOKIE, invite.workspaceId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  refresh();
  return { ok: true as const };
}

/** Switch to another workspace you belong to. */
export async function switchWorkspace(workspaceId: string) {
  const user = await requireUser();
  const mine = await listMemberships(user.id);
  if (!mine.some((m) => m.workspace.id === workspaceId)) return { ok: false as const };
  (await cookies()).set(WS_COOKIE, workspaceId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  refresh();
  return { ok: true as const };
}
