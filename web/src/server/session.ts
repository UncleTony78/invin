import "server-only";
import { asc, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema as s } from "@/db";
import { getAuth } from "@/server/auth";

export type Session = {
  workspace: typeof s.workspaces.$inferSelect;
  member: typeof s.members.$inferSelect;
};

export type Role = "owner" | "admin" | "member";
const RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 };
/** Owners and admins manage settings, bank details and the team; members do the day-to-day billing. */
export const atLeast = (role: string, min: Role) => (RANK[role as Role] ?? 0) >= RANK[min];

/** Which workspace you're working in, when you belong to more than one. */
export const WS_COOKIE = "invin.ws";

/** The signed-in person, or null. Cached per request. */
export const getUser = cache(async () => {
  const res = await getAuth().api.getSession({ headers: await headers() });
  return res?.user ?? null;
});

/** Signed in, with or without a workspace yet. Sends visitors to sign-in. */
export const requireUser = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return user;
});

/** Every workspace this person belongs to, oldest first. */
export const listMemberships = cache(async (userId: string) =>
  db
    .select({ member: s.members, workspace: s.workspaces })
    .from(s.members)
    .innerJoin(s.workspaces, eq(s.workspaces.id, s.members.workspaceId))
    .where(eq(s.members.userId, userId))
    .orderBy(asc(s.members.createdAt)),
);

/** The seat in use: the workspace chosen in the switcher, else the first one joined. */
export const findMembership = cache(async (userId: string) => {
  const all = await listMemberships(userId);
  if (!all.length) return null;
  const chosen = (await cookies()).get(WS_COOKIE)?.value;
  return (all.find((m) => m.workspace.id === chosen) ?? all[0]).member;
});

/**
 * Every app page and server action starts here: signed in AND a member of a workspace.
 * New accounts without a workspace go to the welcome chat first.
 */
export const requireSession = cache(async (): Promise<Session> => {
  const user = await requireUser();
  const member = await findMembership(user.id);
  if (!member) redirect("/welcome");
  const [workspace] = await db.select().from(s.workspaces).where(eq(s.workspaces.id, member.workspaceId));
  if (!workspace) redirect("/welcome");
  return { workspace, member };
});

/** For actions only owners/admins may take. Returns the session, or an error message to show. */
export async function requireRole(min: Role): Promise<{ ok: true; session: Session } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!atLeast(session.member.role, min)) return { ok: false, error: min === "owner" ? "Only the workspace owner can do this." : "Only owners and admins can change this. Ask one of them." };
  return { ok: true, session };
}
