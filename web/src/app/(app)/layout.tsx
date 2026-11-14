import { AppShell } from "@/components/shell/app-shell";
import { listInvoices, listPins } from "@/server/queries";
import { listMemberships, requireSession, requireUser } from "@/server/session";
import { unreadCount } from "@/server/notification-actions";

/* Signed-in area: every page reads live workspace data. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const user = await requireUser();
  const [rows, pins, unread, mine] = await Promise.all([listInvoices(session), listPins(session), unreadCount(), listMemberships(user.id)]);
  return (
    <AppShell
      workspace={{ name: session.workspace.name, mark: session.workspace.mark, brandColor: session.workspace.brandColor, currency: session.workspace.defaultCurrency }}
      member={{ name: session.member.name, role: session.member.role }}
      pins={pins}
      workspaces={mine.map((m) => ({ id: m.workspace.id, name: m.workspace.name, mark: m.workspace.mark, brandColor: m.workspace.brandColor, role: m.member.role, current: m.workspace.id === session.workspace.id }))}
      unread={unread}
      overdue={rows.filter((r) => r.status === "overdue").length}
      invoices={rows.map((r) => ({ id: r.id, number: r.number, customer: r.customer, total: r.total, currency: r.currency }))}
    >
      {children}
    </AppShell>
  );
}
