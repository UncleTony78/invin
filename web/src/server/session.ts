import "server-only";
import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema as s } from "@/db";
import { getAuth } from "@/server/auth";

export type Session = {
  workspace: typeof s.workspaces.$inferSelect;
  member: typeof s.members.$inferSelect;
};

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

/** The seat this person holds, if any. */
export const findMembership = cache(async (userId: string) => {
  const [member] = await db.select().from(s.members).where(eq(s.members.userId, userId)).orderBy(asc(s.members.createdAt)).limit(1);
  return member ?? null;
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
