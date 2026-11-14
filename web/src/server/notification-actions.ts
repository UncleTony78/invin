"use server";

import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireSession } from "./session";

export type NotificationDTO = { id: string; kind: string; title: string; body: string | null; invoiceId: string | null; href: string | null; at: string; unread: boolean };

/** Everyone in a workspace sees the same feed; "unread" is per person, from when they last opened it. */
async function seenAt(memberId: string, memberCreated: Date) {
  const [row] = await db.select().from(s.notificationSeen).where(eq(s.notificationSeen.memberId, memberId));
  return row?.seenAt ?? memberCreated;
}

export async function fetchNotifications(): Promise<{ items: NotificationDTO[]; unread: number }> {
  const session = await requireSession();
  const seen = await seenAt(session.member.id, session.member.createdAt);
  const [rows, [{ n }]] = await Promise.all([
    db.select().from(s.notifications).where(eq(s.notifications.workspaceId, session.workspace.id)).orderBy(desc(s.notifications.createdAt)).limit(40),
    db.select({ n: sql<number>`count(*)` }).from(s.notifications).where(and(eq(s.notifications.workspaceId, session.workspace.id), gt(s.notifications.createdAt, seen))),
  ]);
  return {
    items: rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, invoiceId: r.invoiceId, href: r.href, at: r.createdAt.toISOString(), unread: r.createdAt > seen })),
    unread: Number(n),
  };
}

export async function unreadCount() {
  const session = await requireSession();
  const seen = await seenAt(session.member.id, session.member.createdAt);
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(s.notifications).where(and(eq(s.notifications.workspaceId, session.workspace.id), gt(s.notifications.createdAt, seen)));
  return Number(n);
}

export async function markNotificationsSeen() {
  const session = await requireSession();
  const now = new Date();
  await db.insert(s.notificationSeen).values({ memberId: session.member.id, seenAt: now }).onConflictDoUpdate({ target: s.notificationSeen.memberId, set: { seenAt: now } });
}
