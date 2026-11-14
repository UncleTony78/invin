import { AppShell } from "@/components/shell/app-shell";
import { listInvoices, listPins } from "@/server/queries";
import { requireSession } from "@/server/session";
import { unreadCount } from "@/server/notification-actions";

/* Signed-in area: every page reads live workspace data. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const [rows, pins, unread] = await Promise.all([listInvoices(session), listPins(session), unreadCount()]);
  return (
    <AppShell
      workspace={{ name: session.workspace.name, mark: session.workspace.mark, brandColor: session.workspace.brandColor, currency: session.workspace.defaultCurrency }}
      member={{ name: session.member.name, role: session.member.role }}
      pins={pins}
      unread={unread}
      overdue={rows.filter((r) => r.status === "overdue").length}
      invoices={rows.map((r) => ({ id: r.id, number: r.number, customer: r.customer, total: r.total, currency: r.currency }))}
    >
      {children}
    </AppShell>
  );
}
