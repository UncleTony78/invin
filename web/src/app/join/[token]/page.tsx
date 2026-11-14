import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { JoinView } from "@/components/screens/join-view";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Join a workspace · InVin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const isPast = (d: Date) => d.getTime() < Date.now();

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const user = await requireUser();
  const [invite] = /^[0-9a-f]{48}$/.test(token) ? await db.select().from(s.invites).where(eq(s.invites.token, token)) : [];
  if (!invite) return <JoinView state={{ kind: "missing" }} />;
  const [[ws], [inviter]] = await Promise.all([
    db.select().from(s.workspaces).where(eq(s.workspaces.id, invite.workspaceId)),
    invite.invitedBy ? db.select().from(s.members).where(eq(s.members.id, invite.invitedBy)) : Promise.resolve([]),
  ]);
  const base = { token, workspace: { name: ws.name, mark: ws.mark, brand: ws.brandColor }, inviter: inviter?.name ?? "Someone", role: invite.role, email: invite.email, you: user.email };
  if (invite.acceptedAt) return <JoinView state={{ kind: "used", ...base }} />;
  if (isPast(invite.expiresAt)) return <JoinView state={{ kind: "expired", ...base }} />;
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) return <JoinView state={{ kind: "wrong-email", ...base }} />;
  return <JoinView state={{ kind: "ready", ...base }} />;
}
